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
  slotPatch: SlotPatch;
  ackText?: string;
  assistantParts: AssistantPart[];
  done: boolean;
}

interface ChatState {
  flow: FlowKind | null;
  slots: Slots;
  messages: ChatMessage[];
  loading: boolean;
  done: boolean;
  error: string | null;

  /** チャット画面の初期化（フロー未選択状態）。 */
  initSession: () => void;

  /**
   * チャット内のフロー選択チップから呼ばれる。
   * - user メッセージを追加
   * - flow を設定
   * - state machine の最初の step を取りに行く
   */
  pickFlow: (flow: FlowKind, displayLabel: string) => Promise<void>;

  /** 自由入力テキストを送る */
  sendText: (text: string) => Promise<void>;
  /** チップ/カレンダー等の構造化応答を送る */
  sendStepResponse: (stepId: string, value: unknown, displayLabel: string) => Promise<void>;
  /** ImageModel の検出結果を送る */
  sendImageDetection: (detectedNames: string[]) => Promise<void>;

  reset: () => void;
}

async function callApi(
  flow: FlowKind,
  slots: Slots,
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

export const useChatSession = create<ChatState>((set, get) => ({
  flow: null,
  slots: emptySlots('household_spot'),
  messages: [],
  loading: false,
  done: false,
  error: null,

  reset: () =>
    set({
      flow: null,
      slots: emptySlots('household_spot'),
      messages: [],
      loading: false,
      done: false,
      error: null,
    }),

  initSession: () =>
    set({
      flow: null,
      slots: emptySlots('household_spot'),
      messages: [],
      loading: false,
      done: false,
      error: null,
    }),

  pickFlow: async (flow, displayLabel) => {
    const userMsg: ChatMessage = {
      role: 'user',
      text: displayLabel,
      createdAt: Date.now(),
      meta: { source: 'chips' },
    };
    set({
      flow,
      slots: emptySlots(flow),
      messages: [userMsg],
      loading: true,
      error: null,
      done: false,
    });
    try {
      const r = await callApi(flow, emptySlots(flow), { kind: 'init' });
      handleApiResult(set, get, r);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendText: async (text) => {
    const { flow, slots, messages } = get();
    if (!flow || !text.trim()) return;
    const userMsg: ChatMessage = {
      role: 'user',
      text,
      createdAt: Date.now(),
      meta: { source: 'free_text' },
    };
    set({ messages: [...messages, userMsg], loading: true, error: null });
    try {
      const r = await callApi(flow, slots, { kind: 'text', text });
      handleApiResult(set, get, r);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  sendStepResponse: async (stepId, value, displayLabel) => {
    const { flow, slots, messages } = get();
    if (!flow) return;
    const userMsg: ChatMessage = {
      role: 'user',
      text: displayLabel,
      createdAt: Date.now(),
      meta: { source: 'chips' },
    };
    set({ messages: [...messages, userMsg], loading: true, error: null });
    try {
      const r = await callApi(flow, slots, { kind: 'step', stepId, value });
      handleApiResult(set, get, r);
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
      handleApiResult(set, get, r);
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

function handleApiResult(set: SetFn, get: GetFn, r: ApiResult) {
  const { slots, messages } = get();
  const newSlots = applySlotPatch(slots, r.slotPatch);
  const newMessages = [...messages];
  // assistant 返答を組み立て: ackText（あれば）+ render された parts
  const parts: AssistantPart[] = [];
  if (r.ackText) parts.push({ kind: 'text', text: r.ackText });
  parts.push(...r.assistantParts);
  if (parts.length > 0) {
    newMessages.push({ role: 'assistant', parts, createdAt: Date.now() });
  }
  set({
    slots: newSlots,
    messages: newMessages,
    loading: false,
    done: r.done,
  });
}
