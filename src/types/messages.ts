// チャットメッセージとアシスタント返答の UI プリミティブ型。
// LLM はこの形を JSON で返す（assistantParts）。

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface ChipOption {
  label: string;
  value: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ChipsPart {
  kind: 'chips';
  /** ステートマシンが生成した step の id。クライアントは応答時にこれを送り返す。 */
  stepId?: string;
  prompt?: string;
  options: ChipOption[];
  multi?: boolean;
  /** true の場合、選択肢の下に自由入力欄を表示する */
  allowFreeText?: boolean;
}

// Widget は将来 image_uploader などにも拡張可能。
export interface CalendarWidgetPart {
  kind: 'widget';
  widget: 'calendar';
  stepId?: string;
  prompt?: string;
  mode: 'single' | 'multi';
  maxSelections?: number;
}

export interface AddressPickerWidgetPart {
  kind: 'widget';
  widget: 'address_picker';
  stepId?: string;
  prompt?: string;
}

export type WidgetPart = CalendarWidgetPart | AddressPickerWidgetPart;

export type AssistantPart = TextPart | ChipsPart | WidgetPart;

// 会話履歴のメッセージ
export interface UserMessage {
  role: 'user';
  // ユーザーは自由入力テキスト or チップ選択 or ウィジェット結果を返す
  text: string;
  createdAt: number; // epoch ms
  // 自由入力以外のメタ情報（LLM が文脈を理解しやすくするため）
  meta?: {
    source: 'free_text' | 'chips' | 'widget' | 'image';
  };
}

export interface AssistantMessage {
  role: 'assistant';
  parts: AssistantPart[];
  createdAt: number; // epoch ms
}

export type ChatMessage = UserMessage | AssistantMessage;
