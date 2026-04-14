// 会話の進行を決定論的に駆動する state machine の型定義。
//
// 設計方針:
// - 会話の「次に何を聞くか」は slots を入力にした純関数 nextStep(flow, slots) で決まる
// - 各 Step は AssistantPart を render し、ユーザー応答を受けて SlotPatch を返す
// - 自由入力（free text）に対応する step は acceptText を持つ
// - チップ/ウィジェット応答に対応する step は acceptResponse を持つ
// - acceptText が無く、ユーザーが自由入力してきた場合は LLM extractor にフォールバック

import type { Slots } from '@/lib/slots/types';
import type { SlotPatch } from '@/lib/slots/merge';
import type { AssistantPart } from '@/types/messages';

export interface Step {
  /** ステップ識別子。クライアントが応答に付けて送り返す。 */
  id: string;
  /** このステップで表示する AssistantPart 配列を返す */
  render: (slots: Slots) => AssistantPart[];
  /**
   * ユーザーが Composer から自由入力を返してきた場合の処理。
   * undefined の場合、自由入力は LLM extractor にフォールバックする。
   */
  acceptText?: (text: string, slots: Slots) => SlotPatch;
  /**
   * チップ選択 / カレンダーウィジェット決定 / 画像検出結果 などの構造化応答処理。
   * acceptResponse が無い step は構造化応答を受け取らない（free text 専用）。
   */
  acceptResponse?: (value: unknown, slots: Slots) => SlotPatch;
  /**
   * LLM extractor にフォールバックする際に使う、このステップ固有の指示。
   * 例: 「数量を『45L × 3袋/日』のような形式に正規化してください」。
   */
  llmHint?: string;
}

/** flow ごとの「次のstep計算関数」。null を返したら全項目埋まった (= done)。 */
export type NextStepFn = (slots: Slots) => Step | null;
