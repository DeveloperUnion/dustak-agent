// PredictCostModel モック。
// spec: 数量を聞く時点で常に「PredictCostModel + 類似事業者データ」から
// 予測値をデフォルト候補として提示する。
//
// 実装は ../PredictCostModel/predict-cost-model に存在予定。
// 仕様未確定のため固定値で組み、後から差し替える。

import 'server-only';

export interface QuantityPrediction {
  itemLabel: string;
  quantityText: string; // 例: "45L × 3袋/日"
  source: string; // 例: "ラーメン屋平均"
}

const TABLE: Record<string, Record<string, QuantityPrediction>> = {
  ラーメン屋: {
    生ゴミ: { itemLabel: '生ゴミ', quantityText: '45L × 3袋/日', source: 'ラーメン屋平均' },
    段ボール: { itemLabel: '段ボール', quantityText: '週1回 まとめて10kg程度', source: 'ラーメン屋平均' },
    廃油: { itemLabel: '廃油', quantityText: '月1回 18L缶 1本', source: 'ラーメン屋平均' },
  },
  カフェ: {
    生ゴミ: { itemLabel: '生ゴミ', quantityText: '45L × 1袋/日', source: 'カフェ平均' },
    段ボール: { itemLabel: '段ボール', quantityText: '週1回 まとめて5kg程度', source: 'カフェ平均' },
  },
};

/**
 * 業態と品目から予測数量を返す。ヒットしない場合は null。
 */
export function predictQuantity(
  occupation: string | undefined,
  itemLabel: string,
): QuantityPrediction | null {
  if (!occupation) return null;
  // 部分一致で寛容にマッチ
  const occKey = Object.keys(TABLE).find((k) => occupation.includes(k));
  if (!occKey) return null;
  const itemKey = Object.keys(TABLE[occKey]).find((k) => itemLabel.includes(k));
  if (!itemKey) return null;
  return TABLE[occKey][itemKey];
}

/**
 * 業態だけを与えると、その業態の典型品目セットを返す（業態テンプレ提案用）。
 */
export function predictTemplate(occupation: string | undefined): QuantityPrediction[] {
  if (!occupation) return [];
  const occKey = Object.keys(TABLE).find((k) => occupation.includes(k));
  if (!occKey) return [];
  return Object.values(TABLE[occKey]);
}
