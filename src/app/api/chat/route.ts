// State machine 主導の chat API。
//
// 入力: { flow, slots, response }
//   response.kind === 'init'  → state machine を1ターン進めて next step を返す（初回専用）
//   response.kind === 'step'  → step.acceptResponse(value) で slotPatch 計算 → 適用 → next step
//   response.kind === 'text'  → 現 step.acceptText があればそれを使い、なければ LLM extractor にフォールバック
//   response.kind === 'image' → ImageModel 検出結果（品目名の配列）をテキスト化して LLM extractor に渡す
//
// 出力: { slotPatch, assistantParts, done }
//   slotPatch:    今回適用されたパッチ（クライアントもローカルで再現できるよう返す）
//   assistantParts: 次の step を render したもの（done なら空配列）
//   done:         全項目埋まり確認画面に遷移すべきなら true

import { NextResponse } from 'next/server';
import { getOpenAI, CHAT_MODEL } from '@/lib/llm/openai';
import { extractorPrompt } from '@/lib/llm/prompts';
import { EXTRACTOR_JSON_SCHEMA } from '@/lib/llm/schema';
import { nextStep } from '@/lib/flow/runFlow';
import { applySlotPatch, type SlotPatch } from '@/lib/slots/merge';
import {
  predictQuantity,
  predictTemplate,
  type QuantityPrediction,
} from '@/lib/mocks/predictCost';
import type { FlowKind, Slots } from '@/lib/slots/types';
import type { AssistantPart } from '@/types/messages';

export const runtime = 'nodejs';

type ChatResponseInput =
  | { kind: 'init' }
  | { kind: 'step'; stepId: string; value: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'image'; detectedNames: string[] };

interface ChatRequest {
  flow: FlowKind;
  slots: Slots;
  response: ChatResponseInput;
}

interface ChatApiResult {
  slotPatch: SlotPatch;
  ackText?: string;
  assistantParts: AssistantPart[];
  done: boolean;
}

async function callExtractor(
  flow: FlowKind,
  slots: Slots,
  text: string,
): Promise<{ ackText?: string; slotPatch: SlotPatch }> {
  const currentStep = nextStep(flow, slots);

  // PredictCostModel ヒント
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
  return JSON.parse(content) as { ackText?: string; slotPatch: SlotPatch };
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { flow, slots, response } = body;
  if (!flow || !slots || !response) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  let appliedPatch: SlotPatch = {};
  let ackText: string | undefined;
  let workingSlots = slots;

  try {
    if (response.kind === 'init') {
      // 何もしない（state machine は今の slots から next step を返すだけ）
    } else if (response.kind === 'step') {
      const current = nextStep(flow, slots);
      if (!current || current.id !== response.stepId) {
        // クライアントとサーバーで step がずれた。古い応答 → 黙って無視して現 step を返す。
      } else if (!current.acceptResponse) {
        return NextResponse.json(
          { error: `step ${current.id} does not accept structured response` },
          { status: 400 },
        );
      } else {
        appliedPatch = current.acceptResponse(response.value, slots);
        workingSlots = applySlotPatch(workingSlots, appliedPatch);
      }
    } else if (response.kind === 'text') {
      const current = nextStep(flow, slots);
      if (current?.acceptText) {
        // 決定論パス: 現 step が free text を期待しているのでそのまま適用
        appliedPatch = current.acceptText(response.text, slots);
        workingSlots = applySlotPatch(workingSlots, appliedPatch);
      } else {
        // フォールバック: LLM extractor で解釈
        const result = await callExtractor(flow, slots, response.text);
        appliedPatch = result.slotPatch ?? {};
        ackText = result.ackText;
        workingSlots = applySlotPatch(workingSlots, appliedPatch);
      }
    } else if (response.kind === 'image') {
      // 画像検出結果は常に LLM extractor に渡す（産廃分類の自動付与もここで起きる）
      const text = `【画像から検出された品目】\n${response.detectedNames
        .map((n, i) => `${i + 1}. ${n}`)
        .join('\n')}`;
      const result = await callExtractor(flow, slots, text);
      appliedPatch = result.slotPatch ?? {};
      ackText = result.ackText;
      workingSlots = applySlotPatch(workingSlots, appliedPatch);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'processing failed', message }, { status: 502 });
  }

  // 次の step を計算して render
  const next = nextStep(flow, workingSlots);
  const assistantParts: AssistantPart[] = next ? next.render(workingSlots) : [];

  const result: ChatApiResult = {
    slotPatch: appliedPatch,
    ackText,
    assistantParts,
    done: next === null,
  };
  return NextResponse.json(result);
}
