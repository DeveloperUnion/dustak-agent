'use client';

import { create } from 'zustand';
import type { ChatMessage, AssistantPart } from '@/types/messages';
import type { FlowKind, Slots } from '@/lib/slots/types';
import { emptySlots } from '@/lib/slots/types';
import { applySlotPatch, type SlotPatch } from '@/lib/slots/merge';

type ChatResponseInput =
  | { kind: 'init' }
  | { kind: 'step'; stepId: string; value: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'image'; detectedNames: string[] };

interface ApiResult {
  /** サーバーが確定/継続している flow。null=まだ未確定。 */
  flow: FlowKind | null;
  slotPatch: SlotPatch;
  ackText?: string;
  assistantParts: AssistantPart[];
  done: boolean;
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

  /** チャット画面の初期化。初回挨拶を取りに行く。 */
  initSession: () => Promise<void>;

  /** 自由入力テキストを送る */
  sendText: (text: string) => Promise<void>;
  /** チップ/カレンダー等の構造化応答を送る */
  sendStepResponse: (stepId: string, value: unknown, displayLabel: string) => Promise<void>;
  /** ImageModel の検出結果を送る */
  sendImageDetection: (detectedNames: string[]) => Promise<void>;

  reset: () => void;
}

async function callApi(
  flow: FlowKind | null,
  slots: Slots | null,
  response: ChatResponseInput,
): Promise<ApiResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ flow, slots, response }),
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

  reset: () =>
    set({
      flow: null,
      slots: INITIAL_SLOTS_PLACEHOLDER,
      messages: [],
      loading: false,
      done: false,
      error: null,
    }),

  initSession: async () => {
    set({
      flow: null,
      slots: INITIAL_SLOTS_PLACEHOLDER,
      messages: [],
      loading: true,
      done: false,
      error: null,
    });
    try {
      const r = await callApi(null, null, { kind: 'init' });
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendText: async (text) => {
    const { flow, slots, messages } = get();
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      role: 'user',
      text,
      createdAt: Date.now(),
      meta: { source: 'free_text' },
    };
    set({ messages: [...messages, userMsg], loading: true, error: null });
    try {
      const r = await callApi(flow, flow ? slots : null, { kind: 'text', text });
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendStepResponse: async (stepId, value, displayLabel) => {
    const { flow, slots, messages } = get();
    const userMsg: ChatMessage = {
      role: 'user',
      text: displayLabel,
      createdAt: Date.now(),
      meta: { source: 'chips' },
    };
    set({ messages: [...messages, userMsg], loading: true, error: null });
    try {
      const r = await callApi(flow, flow ? slots : null, { kind: 'step', stepId, value });
      handleApiResult(set, get, r, null);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendImageDetection: async (detectedNames) => {
    const { flow, slots, messages } = get();
    if (!flow || detectedNames.length === 0) return;
    const summary = `【画像から検出】${detectedNames.join(', ')}`;
    const userMsg: ChatMessage = {
      role: 'user',
      text: summary,
      createdAt: Date.now(),
      meta: { source: 'image' },
    };
    set({ messages: [...messages, userMsg], loading: true, error: null });
    try {
      const r = await callApi(flow, slots, { kind: 'image', detectedNames });
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
  set({
    flow: nextFlow,
    slots: newSlots,
    messages: newMessages,
    loading: false,
    done: r.done,
  });
}
