// 「無料引取」候補かどうかを判定するモック関数。
//
// MVP: 品目 label の文字列マッチで判定。家電リサイクル法対象 + リユース市場で流通しやすい品目を候補とする。
// 将来: 産廃カテゴリ・年式・状態など実ルールに差し替え。

import type { Item } from '@/lib/slots/types';

const FREE_PROVIDER_PATTERN =
  /冷蔵庫|冷凍庫|洗濯機|乾燥機|エアコン|テレビ|電子レンジ|オーブンレンジ|自転車|電動アシスト|バイク|スクーター/;

export function isFreeProviderEligible(item: Item): boolean {
  return FREE_PROVIDER_PATTERN.test(item.label);
}
