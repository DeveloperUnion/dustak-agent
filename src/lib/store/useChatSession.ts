'use client';

import { create } from 'zustand';
import type { ChatMessage, AssistantPart } from '@/types/messages';
import type { FlowKind, Slots } from '@/lib/slots/types';
import { emptySlots } from '@/lib/slots/types';
import { applySlotPatch, type SlotPatch } from '@/lib/slots/merge';

export interface DetectedItemInput {
  name: string;
  info?: string;
}

type ChatResponseInput =
  | { kind: 'init' }
  | { kind: 'step'; stepId: string; value: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'image'; detectedItems: DetectedItemInput[] };

interface ApiResult {
  /** サーバーが確定/継続している flow。null=まだ未確定。 */
  flow: FlowKind | null;
  slotPatch: SlotPatch;
  ackText?: string;
  assistantParts: AssistantPart[];
  done: boolean;
}

/** 「やり直す」用の状態スナップショット。各ユーザー応答を送る直前にスタックに積む。 */
interface HistorySnapshot {
  flow: FlowKind | null;
  slots: Slots;
  /** スナップショット時点での messages.length。undo 時にここまで slice する。 */
  messagesLength: number;
  done: boolean;
  pendingDetectedItems: DetectedItemInput[] | null;
  pendingInitialText: string | null;
}

interface ChatState {
  /** 確定済みの flow。null=まだ自由発話で flow 推定中。 */
  flow: FlowKind | null;
  /** flow 確定後の slots。flow=null のときも空 slots を持つ（型を簡単にするため）。 */
  slots: Slots;
  messages: ChatMessage[];
  loading: boolean;
  done: boolean;
  error: string | null;

  /** ユーザー応答の直前に積むスナップショット履歴。空なら undo 不可。 */
  slotsHistory: HistorySnapshot[];

  /**
   * flow=null 中に画像ピッカーで蓄積された検出品目（name + info）。
   * flow が確定するタイミングでサーバー側 extractor に同梱され、items[] に投入される。
   */
  pendingDetectedItems: DetectedItemInput[] | null;

  /**
   * flow=null 中のユーザーの最初の自由発話。
   * flow.pick chip 押下時にサーバへ同梱され、extractor 経由で items[] 等に投入される。
   * 最初の発話のみ保持し、その後の発話では上書きしない。
   */
  pendingInitialText: string | null;

  /** チャット画面の初期化。初回挨拶を取りに行く。 */
  initSession: () => Promise<void>;

  /** 自由入力テキストを送る */
  sendText: (text: string) => Promise<void>;
  /** チップ/カレンダー等の構造化応答を送る */
  sendStepResponse: (stepId: string, value: unknown, displayLabel: string) => Promise<void>;
  /** ImageModel の検出結果を送る */
  sendImageDetection: (detectedItems: DetectedItemInput[]) => Promise<void>;

  /** 直近のユーザー応答を取り消し、その応答を送る前の状態に戻す。スタック式なので連打で複数回戻れる。 */
  undo: () => void;

  /**
   * 確認画面の「編集」ボタンから呼ばれる。slots を mutate で書き換え、
   * done=false にしてサーバーから次の step を取りに行く（state machine が空き field を質問してくれる）。
   */
  editField: (mutate: (s: Slots) => Slots) => Promise<void>;

  /**
   * 確認画面内で完結する編集。slots を mutate で更新し、history snapshot を積むだけ。
   * done は維持、API は叩かない、メッセージも追加しない。
   */
  applyConfirmationEdit: (mutate: (s: Slots) => Slots) => void;

  reset: () => void;
}

async function callApi(
  flow: FlowKind | null,
  slots: Slots | null,
  response: ChatResponseInput,
  pendingDetectedItems?: DetectedItemInput[] | null,
  pendingInitialText?: string | null,
): Promise<ApiResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      flow,
      slots,
      response,
      ...(pendingDetectedItems && pendingDetectedItems.length > 0
        ? { pendingDetectedItems }
        : {}),
      ...(pendingInitialText ? { pendingInitialText } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ApiResult;
}

const INITIAL_SLOTS_PLACEHOLDER: Slots = emptySlots('household_spot');

export const useChatSession = create<ChatState>((set, get) => ({
  flow: null,
  slots: INITIAL_SLOTS_PLACEHOLDER,
  messages: [],
  loading: false,
  done: false,
  error: null,
  slotsHistory: [],
  pendingDetectedItems: null,
  pendingInitialText: null,

  reset: () =>
    set({
      flow: null,
      slots: INITIAL_SLOTS_PLACEHOLDER,
      messages: [],
      loading: false,
      done: false,
      error: null,
      slotsHistory: [],
      pendingDetectedItems: null,
      pendingInitialText: null,
    }),

  initSession: async () => {
    set({
      flow: null,
      slots: INITIAL_SLOTS_PLACEHOLDER,
      messages: [],
      loading: true,
      done: false,
      error: null,
      slotsHistory: [],
      pendingDetectedItems: null,
      pendingInitialText: null,
    });
    try {
      const r = await callApi(null, null, { kind: 'init' });
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendText: async (text) => {
    const { flow, slots, messages, done, slotsHistory, pendingDetectedItems, pendingInitialText } = get();
    if (!text.trim()) return;
    const snapshot: HistorySnapshot = {
      flow,
      slots,
      messagesLength: messages.length,
      done,
      pendingDetectedItems,
      pendingInitialText,
    };
    const userMsg: ChatMessage = {
      role: 'user',
      text,
      createdAt: Date.now(),
      meta: { source: 'free_text' },
    };
    // flow=null かつ未保持なら、この text を「最初の発話」として保持
    // （後で flow.pick 押下時に extractor へ同梱送信される）
    const nextPendingInitialText =
      flow === null && !pendingInitialText ? text : pendingInitialText;
    set({
      messages: [...messages, userMsg],
      slotsHistory: [...slotsHistory, snapshot],
      loading: true,
      error: null,
      pendingInitialText: nextPendingInitialText,
    });
    try {
      const r = await callApi(
        flow,
        flow ? slots : null,
        { kind: 'text', text },
        pendingDetectedItems,
      );
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendStepResponse: async (stepId, value, displayLabel) => {
    const { flow, slots, messages, done, slotsHistory, pendingDetectedItems, pendingInitialText } = get();
    const snapshot: HistorySnapshot = {
      flow,
      slots,
      messagesLength: messages.length,
      done,
      pendingDetectedItems,
      pendingInitialText,
    };
    const userMsg: ChatMessage = {
      role: 'user',
      text: displayLabel,
      createdAt: Date.now(),
      meta: { source: 'chips' },
    };
    set({
      messages: [...messages, userMsg],
      slotsHistory: [...slotsHistory, snapshot],
      loading: true,
      error: null,
    });
    // flow.pick chip 押下時のみ、保持済の初回テキストを extractor へ流す
    const includeInitialText = flow === null && stepId === 'flow.pick';
    try {
      const r = await callApi(
        flow,
        flow ? slots : null,
        { kind: 'step', stepId, value },
        pendingDetectedItems,
        includeInitialText ? pendingInitialText : undefined,
      );
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendImageDetection: async (detectedItems) => {
    const { flow, slots, messages, done, slotsHistory, pendingInitialText } = get();
    if (detectedItems.length === 0) return;
    const snapshot: HistorySnapshot = {
      flow,
      slots,
      messagesLength: messages.length,
      done,
      pendingDetectedItems: get().pendingDetectedItems,
      pendingInitialText,
    };
    const summary = `【画像から検出】${detectedItems.map((d) => d.name).join(', ')}`;
    const userMsg: ChatMessage = {
      role: 'user',
      text: summary,
      createdAt: Date.now(),
      meta: { source: 'image' },
    };
    // flow=null のときは pendingDetectedItems に蓄積（次の API 呼び出しで送信）
    const isFlowResolved = flow !== null;
    set({
      messages: [...messages, userMsg],
      slotsHistory: [...slotsHistory, snapshot],
      loading: true,
      error: null,
      pendingDetectedItems: isFlowResolved ? get().pendingDetectedItems : detectedItems,
    });
    try {
      const r = await callApi(
        flow,
        isFlowResolved ? slots : null,
        { kind: 'image', detectedItems },
        // flow 確定済みなら通常通り extractor が処理する。flow=null なら server 側で flow pick chips を返す
        // （pendingDetectedItems はこの呼び出しでは送らない。蓄積はクライアント側に保持し、flow.pick 時に同梱される）
        undefined,
      );
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  undo: () => {
    const { slotsHistory, messages, loading } = get();
    if (loading || slotsHistory.length === 0) return;
    const last = slotsHistory[slotsHistory.length - 1];
    set({
      flow: last.flow,
      slots: last.slots,
      done: last.done,
      messages: messages.slice(0, last.messagesLength),
      slotsHistory: slotsHistory.slice(0, -1),
      pendingDetectedItems: last.pendingDetectedItems,
      pendingInitialText: last.pendingInitialText,
      error: null,
    });
  },

  applyConfirmationEdit: (mutate) => {
    const { flow, slots, messages, done, slotsHistory, loading, pendingDetectedItems, pendingInitialText } = get();
    if (loading || !flow) return;
    const snapshot: HistorySnapshot = {
      flow,
      slots,
      messagesLength: messages.length,
      done,
      pendingDetectedItems,
      pendingInitialText,
    };
    set({
      slots: mutate(slots),
      slotsHistory: [...slotsHistory, snapshot],
      error: null,
    });
  },

  editField: async (mutate) => {
    const { flow, slots, messages, done, slotsHistory, loading, pendingInitialText } = get();
    if (loading || !flow) return;
    const snapshot: HistorySnapshot = {
      flow,
      slots,
      messagesLength: messages.length,
      done,
      pendingDetectedItems: get().pendingDetectedItems,
      pendingInitialText,
    };
    const newSlots = mutate(slots);
    set({
      slots: newSlots,
      done: false,
      loading: true,
      error: null,
      slotsHistory: [...slotsHistory, snapshot],
    });
    try {
      // kind:'init' は flow 確定後だと「現在の slots から next step を計算して返す」だけの動き。
      const r = await callApi(flow, newSlots, { kind: 'init' });
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

type SetFn = (
  partial:
    | Partial<ChatState>
    | ((state: ChatState) => Partial<ChatState>),
) => void;
type GetFn = () => ChatState;

function handleApiResult(set: SetFn, get: GetFn, r: ApiResult, _unused: null) {
  void _unused;
  const { flow: prevFlow, slots: prevSlots, messages } = get();

  // flow 確定の遷移: サーバーが新しい flow を返したら slots をその flow で初期化
  let nextFlow = prevFlow;
  let baseSlots = prevSlots;
  if (r.flow !== null && prevFlow === null) {
    nextFlow = r.flow;
    baseSlots = emptySlots(r.flow);
  } else if (r.flow !== null && prevFlow !== null && r.flow !== prevFlow) {
    // 想定外: flow が変わった。安全側で base を作り直す。
    nextFlow = r.flow;
    baseSlots = emptySlots(r.flow);
  }

  const newSlots = applySlotPatch(baseSlots, r.slotPatch);
  const newMessages = [...messages];
  const parts: AssistantPart[] = [];
  if (r.ackText) parts.push({ kind: 'text', text: r.ackText });
  parts.push(...r.assistantParts);
  if (parts.length > 0) {
    newMessages.push({ role: 'assistant', parts, createdAt: Date.now() });
  }
  // flow が今回確定したタイミングで pendingDetectedItems / pendingInitialText をクリア
  // （サーバー側で extractor を通って items[] に投入済み）
  const flowJustResolved = prevFlow === null && nextFlow !== null;
  const pendingDetectedItems = flowJustResolved ? null : get().pendingDetectedItems;
  const pendingInitialText = flowJustResolved ? null : get().pendingInitialText;

  set({
    flow: nextFlow,
    slots: newSlots,
    messages: newMessages,
    loading: false,
    done: r.done,
    pendingDetectedItems,
    pendingInitialText,
  });
}
