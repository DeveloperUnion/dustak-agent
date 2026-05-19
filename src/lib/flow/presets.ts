// flow ごとの品目プリセットと、ユーザー発話との決定論的マッチング。

export const BUSINESS_RECURRING_ITEM_PRESETS = [
  '可燃ゴミ',
  '段ボール・古紙',
  'ビン・缶・ペットボトル',
  '不燃ゴミ',
  '汚泥',
] as const;

/** ひらがな (U+3041–U+3096) をカタカナ (U+30A1–U+30F6) に変換。 */
function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (m) =>
    String.fromCharCode(m.charCodeAt(0) + 0x60),
  );
}

/** プリセットマッチ用の正規化: trim → hiragana→katakana → 半角空白除去 → 小文字化。 */
function normalize(s: string): string {
  return hiraToKata(s.trim()).replace(/\s+/g, '').toLowerCase();
}

/**
 * 入力テキストが事業者定期回収のプリセット品目と完全一致するか判定し、
 * マッチしたプリセットの正規ラベルを返す。例: "可燃ごみ" → "可燃ゴミ"。
 * 単独発話のみマッチさせる（"可燃ゴミ出したい" のように余分な語があれば null）。
 */
export function matchBusinessRecurringPreset(text: string): string | null {
  if (!text) return null;
  const norm = normalize(text);
  for (const p of BUSINESS_RECURRING_ITEM_PRESETS) {
    if (normalize(p) === norm) return p;
  }
  return null;
}
