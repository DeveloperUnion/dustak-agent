// State machine 主導の chat API。
//
// 入力: { flow, slots, response }
//   flow=null の場合は「flow 未確定」状態。最初の自由発話から flow 分類器で判定する。
//   response.kind === 'init'  → 初回挨拶。flow=null なら自由発話プロンプトを返すだけ
//   response.kind === 'step'  → step.acceptResponse(value) で slotPatch 計算 → 適用 → next step
//                              flow_pick stepId なら flow を確定して state machine の最初の step を返す
//   response.kind === 'text'  → 常に LLM extractor で解釈。flow=null なら先に flow 分類器を回す
//   response.kind === 'image' → ImageModel 検出結果（品目名の配列）をテキスト化して LLM extractor に渡す
//
// 出力: { flow, slotPatch, assistantParts, done }
//   flow:         今回確定/継続中の flow（null=まだ未確定）
//   slotPatch:    今回適用されたパッチ
//   assistantParts: 次の step を render したもの（done なら空配列）
//   done:         全項目埋まり確認画面に遷移すべきなら true

import { NextResponse } from 'next/server';
import { getOpenAI, CHAT_MODEL } from '@/lib/llm/openai';
import { extractorPrompt, flowClassifierPrompt } from '@/lib/llm/prompts';
import { EXTRACTOR_JSON_SCHEMA, FLOW_CLASSIFIER_JSON_SCHEMA } from '@/lib/llm/schema';
import { nextStep } from '@/lib/flow/runFlow';
import { matchBusinessRecurringPreset } from '@/lib/flow/presets';
import { applySlotPatch, type SlotPatch } from '@/lib/slots/merge';
import { validateSlotPatch } from '@/lib/slots/schema';
import {
  predictQuantity,
  predictTemplate,
  type QuantityPrediction,
} from '@/lib/mocks/predictCost';
import { emptySlots, type FlowKind, type Slots } from '@/lib/slots/types';
import type { AssistantPart } from '@/types/messages';
import { parseDetectedInfo } from '@/lib/imageDetectionParser';

export const runtime = 'nodejs';

interface DetectedItemInput {
  name: string;
  info?: string;
}

type ChatResponseInput =
  | { kind: 'init' }
  | { kind: 'step'; stepId: string; value: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'image'; detectedItems: DetectedItemInput[] };

interface ChatRequest {
  flow: FlowKind | null;
  slots: Slots | null;
  response: ChatResponseInput;
  /** flow=null 中に画像ピッカーで蓄積された検出品目（name + info）。flow 確定タイミングで items[] に投入される。 */
  pendingDetectedItems?: DetectedItemInput[];
  /** flow=null 中の最初のユーザー自由発話。flow.pick chip 押下時に extractor へ同梱される。 */
  pendingInitialText?: string;
}

interface ChatApiResult {
  flow: FlowKind | null;
  slotPatch: SlotPatch;
  ackText?: string;
  assistantParts: AssistantPart[];
  done: boolean;
}

/** flow 未確定時に出す「個人/事業者」確認 chips。クライアントは stepId="flow.pick" の応答として返す。 */
const FLOW_PICK_STEP_ID = 'flow.pick';

function flowPickParts(prefixText?: string): AssistantPart[] {
  const parts: AssistantPart[] = [];
  if (prefixText) parts.push({ kind: 'text', text: prefixText });
  parts.push({
    kind: 'chips',
    stepId: FLOW_PICK_STEP_ID,
    options: [
      { label: '個人スポット', value: 'household_spot' },
      { label: '事業者スポット', value: 'business_spot' },
      { label: '事業者定期回収', value: 'business_recurring' },
    ],
  });
  return parts;
}

function bootstrapParts(): AssistantPart[] {
  return [
    {
      kind: 'text',
      text:
        'こんにちは。Dustalk のゴミ回収申し込みアシスタントです。\nご用件をお聞かせください（例: "自転車を捨てたい" / "ラーメン屋で生ゴミが毎日出る" など）。',
    },
  ];
}

async function classifyFlow(
  text: string,
): Promise<{ flow: FlowKind | null; clarifyText?: string }> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: flowClassifierPrompt() },
      { role: 'user', content: text },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: FLOW_CLASSIFIER_JSON_SCHEMA,
    },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) return { flow: null };
  try {
    const raw = JSON.parse(content) as { flow?: unknown; clarifyText?: unknown };
    const flow =
      raw.flow === 'household_spot' ||
      raw.flow === 'business_spot' ||
      raw.flow === 'business_recurring'
        ? raw.flow
        : null;
    const clarifyText = typeof raw.clarifyText === 'string' ? raw.clarifyText : undefined;
    return { flow, clarifyText };
  } catch {
    return { flow: null };
  }
}

/**
 * LLM extractor を呼び、返された patch を field 単位で検証する。
 * 不正フィールドは drop し、ackText に補足を足す。
 */
async function callExtractor(
  flow: FlowKind,
  slots: Slots,
  text: string,
): Promise<{ ackText?: string; slotPatch: SlotPatch }> {
  const currentStep = nextStep(flow, slots);

  const template = slots.items.length === 0 ? predictTemplate(slots.occupation) : [];
  const perItem: QuantityPrediction[] = [];
  for (const item of slots.items) {
    if (item.estimatedQuantity) continue;
    const p = predictQuantity(slots.occupation, item.label);
    if (p) perItem.push(p);
  }

  const system = extractorPrompt(flow, slots, currentStep, { template, perItem });

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: EXTRACTOR_JSON_SCHEMA,
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('empty extractor response');
  const raw = JSON.parse(content) as { ackText?: string; slotPatch?: unknown };

  const { patch, droppedFields } = validateSlotPatch(raw.slotPatch);
  let ackText = raw.ackText;
  if (droppedFields.length > 0) {
    const note = formatDroppedFieldsNote(droppedFields);
    ackText = ackText ? `${ackText} ${note}` : note;
  }
  return { ackText, slotPatch: patch };
}

function formatDroppedFieldsNote(dropped: string[]): string {
  const has = (key: string) =>
    dropped.some((d) => d === key || d.startsWith(`${key}.`) || d.startsWith(`${key}[`));
  const msgs: string[] = [];
  if (has('requester.phone')) msgs.push('電話番号の形式');
  if (has('requester.email')) msgs.push('メールアドレスの形式');
  const enumDropped = dropped.some((d) =>
    /(buildingKind|parking|elevator|dischargeMode|frequency|provider|businessForm)/.test(d),
  );
  if (enumDropped) msgs.push('選択肢の値');
  if (msgs.length === 0) return '一部の項目を反映できませんでした。もう一度ご入力ください。';
  return `${msgs.join(' / ')}を確認できませんでした。もう一度ご入力ください。`;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const {
    flow: incomingFlow,
    slots: incomingSlots,
    response,
    pendingDetectedItems,
    pendingInitialText,
  } = body;
  if (!response) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  const hasPendingImages =
    Array.isArray(pendingDetectedItems) && pendingDetectedItems.length > 0;
  const hasPendingInitialText =
    typeof pendingInitialText === 'string' && pendingInitialText.trim().length > 0;
  /**
   * 検出品目を LLM extractor 用テキストに整形。
   * info に key:value が入っていれば構造化属性として一緒に渡す。
   */
  const detectedItemsToText = (items: DetectedItemInput[]) => {
    const lines = items.map((it, i) => {
      const parsed = parseDetectedInfo(it.info);
      const attrs: string[] = [];
      if (parsed.manufacturer) attrs.push(`メーカー: ${parsed.manufacturer}`);
      if (parsed.yearOfManufacture) attrs.push(`年式: ${parsed.yearOfManufacture}`);
      if (parsed.capacity) attrs.push(`容量: ${parsed.capacity}`);
      const suffix = attrs.length > 0 ? ` (${attrs.join(', ')})` : '';
      return `${i + 1}. ${it.name}${suffix}`;
    });
    return `【画像から検出された品目】\n${lines.join('\n')}`;
  };

  // ----- flow 未確定 (incomingFlow=null) のハンドリング -----
  if (incomingFlow === null) {
    if (response.kind === 'init') {
      const result: ChatApiResult = {
        flow: null,
        slotPatch: {},
        assistantParts: bootstrapParts(),
        done: false,
      };
      return NextResponse.json(result);
    }

    if (response.kind === 'step' && response.stepId === FLOW_PICK_STEP_ID) {
      const picked = response.value;
      if (
        picked === 'household_spot' ||
        picked === 'business_spot' ||
        picked === 'business_recurring'
      ) {
        const initialSlots = emptySlots(picked);
        let workingSlots = initialSlots;
        let slotPatch: SlotPatch = {};
        let ackText: string | undefined;

        // flow=null 期間中に蓄積された情報を items[] 等に投入する:
        //  - pendingInitialText: 最初のユーザー自由発話
        //  - pendingDetectedItems: 画像から検出された品目
        const sources: string[] = [];
        if (hasPendingInitialText) sources.push(pendingInitialText!.trim());
        if (hasPendingImages) sources.push(detectedItemsToText(pendingDetectedItems!));
        if (sources.length > 0) {
          try {
            const extracted = await callExtractor(
              picked,
              initialSlots,
              sources.join('\n\n'),
            );
            slotPatch = extracted.slotPatch;
            ackText = extracted.ackText;
            workingSlots = applySlotPatch(initialSlots, slotPatch);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return NextResponse.json({ error: 'processing failed', message }, { status: 502 });
          }
        }

        // 決定論的なプリセットマッチ: extractor が「総称ワード」として落とした場合の救済。
        // 初回発話が business_recurring のプリセット品目と完全一致したら items[] に直接投入する。
        if (
          picked === 'business_recurring' &&
          workingSlots.items.length === 0 &&
          hasPendingInitialText
        ) {
          const matched = matchBusinessRecurringPreset(pendingInitialText!.trim());
          if (matched) {
            const itemPatch = [{ id: 'item-1', label: matched }];
            slotPatch = { ...slotPatch, items: [...(slotPatch.items ?? []), ...itemPatch] };
            workingSlots = applySlotPatch(workingSlots, { items: itemPatch });
          }
        }

        const next = nextStep(picked, workingSlots);
        const result: ChatApiResult = {
          flow: picked,
          slotPatch,
          ackText,
          assistantParts: next ? next.render(workingSlots) : [],
          done: next === null,
        };
        return NextResponse.json(result);
      }
      return NextResponse.json({ error: 'invalid flow value' }, { status: 400 });
    }

    if (response.kind === 'text') {
      // 1. flow 分類
      let classified: { flow: FlowKind | null; clarifyText?: string };
      try {
        classified = await classifyFlow(response.text);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: 'flow classification failed', message }, { status: 502 });
      }

      if (classified.flow === null) {
        // 確認質問 + chips fallback
        const result: ChatApiResult = {
          flow: null,
          slotPatch: {},
          assistantParts: flowPickParts(
            classified.clarifyText ?? 'もう少し詳しく教えてください。個人ですか? 事業者ですか?',
          ),
          done: false,
        };
        return NextResponse.json(result);
      }

      // 2. flow 確定 → 同じテキスト（+ あれば画像で蓄積した品目）で extractor を回す
      const determinedFlow = classified.flow;
      const initialSlots = emptySlots(determinedFlow);
      const combinedText = hasPendingImages
        ? `${response.text}\n\n${detectedItemsToText(pendingDetectedItems!)}`
        : response.text;
      let extracted: { ackText?: string; slotPatch: SlotPatch };
      try {
        extracted = await callExtractor(determinedFlow, initialSlots, combinedText);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: 'processing failed', message }, { status: 502 });
      }
      let workingSlots = applySlotPatch(initialSlots, extracted.slotPatch);
      let outgoingSlotPatch = extracted.slotPatch;

      // 決定論的なプリセットマッチ: extractor が落とした場合の救済（business_recurring のみ）
      if (
        determinedFlow === 'business_recurring' &&
        workingSlots.items.length === 0
      ) {
        const matched = matchBusinessRecurringPreset(response.text.trim());
        if (matched) {
          const itemPatch = [{ id: 'item-1', label: matched }];
          outgoingSlotPatch = {
            ...outgoingSlotPatch,
            items: [...(outgoingSlotPatch.items ?? []), ...itemPatch],
          };
          workingSlots = applySlotPatch(workingSlots, { items: itemPatch });
        }
      }

      const next = nextStep(determinedFlow, workingSlots);
      const result: ChatApiResult = {
        flow: determinedFlow,
        slotPatch: outgoingSlotPatch,
        ackText: extracted.ackText,
        assistantParts: next ? next.render(workingSlots) : [],
        done: next === null,
      };
      return NextResponse.json(result);
    }

    if (response.kind === 'image') {
      // flow 未確定で画像を受けた: items[] への投入は flow.pick 後に行うため、ここでは
      // bot が「品目を確認しました。個人/事業者どちらですか?」と返して flow pick chips を出す
      const names = response.detectedItems
        .map((d) => d.name)
        .filter((n) => typeof n === 'string' && n.length > 0);
      const ack =
        names.length > 0
          ? `画像から ${names.join('、')} を確認しました。これらを処分されたいということでよろしいですか?\nご利用シーンを教えてください。`
          : 'ご利用シーンを教えてください。';
      const result: ChatApiResult = {
        flow: null,
        slotPatch: {},
        assistantParts: flowPickParts(ack),
        done: false,
      };
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'invalid response kind' }, { status: 400 });
  }

  // ----- flow 確定後の通常フロー -----
  if (!incomingSlots) {
    return NextResponse.json({ error: 'missing slots' }, { status: 400 });
  }
  const flow = incomingFlow;
  const slots = incomingSlots;

  let appliedPatch: SlotPatch = {};
  let ackText: string | undefined;
  let workingSlots = slots;

  try {
    if (response.kind === 'init') {
      // state machine は今の slots から next step を返すだけ
    } else if (response.kind === 'step') {
      const current = nextStep(flow, slots);
      if (!current || current.id !== response.stepId) {
        // クライアントとサーバーで step がずれた → 黙って無視して現 step を返す
      } else if (!current.acceptResponse) {
        return NextResponse.json(
          { error: `step ${current.id} does not accept structured response` },
          { status: 400 },
        );
      } else {
        const raw = current.acceptResponse(response.value, slots);
        const { patch } = validateSlotPatch(raw);
        appliedPatch = patch;
        workingSlots = applySlotPatch(workingSlots, appliedPatch);
      }
    } else if (response.kind === 'text') {
      const result = await callExtractor(flow, slots, response.text);
      appliedPatch = result.slotPatch;
      ackText = result.ackText;
      workingSlots = applySlotPatch(workingSlots, appliedPatch);
    } else if (response.kind === 'image') {
      const text = detectedItemsToText(response.detectedItems);
      const result = await callExtractor(flow, slots, text);
      appliedPatch = result.slotPatch;
      ackText = result.ackText;
      workingSlots = applySlotPatch(workingSlots, appliedPatch);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'processing failed', message }, { status: 502 });
  }

  const next = nextStep(flow, workingSlots);
  const assistantParts: AssistantPart[] = next ? next.render(workingSlots) : [];

  const result: ChatApiResult = {
    flow,
    slotPatch: appliedPatch,
    ackText,
    assistantParts,
    done: next === null,
  };
  return NextResponse.json(result);
}
