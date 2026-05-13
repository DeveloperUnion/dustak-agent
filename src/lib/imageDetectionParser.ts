// ImageModel の DetectedItem.info を構造化属性に分解する。
//
// 期待フォーマット例:
//   "メーカー:Panasonic,年式:2020,容量:300L"
//   "メーカー: Panasonic, 製造年: 2020, 容量: 300L"
//   "manufacturer:Panasonic;year:2020;capacity:300L"
// 区切りは "," ";" 改行のいずれか。key の表記揺れ（日本語/英語）に寛容に対応。
// 該当 key が見つからなければそのフィールドは undefined。

const MANUFACTURER_KEYS = /^(メーカー|製造元|brand|manufacturer)$/i;
const YEAR_KEYS = /^(年式|製造年|year|year_of_manufacture)$/i;
const CAPACITY_KEYS = /^(容量|サイズ|capacity|size)$/i;

export interface ParsedDetectionInfo {
  manufacturer?: string;
  yearOfManufacture?: string;
  capacity?: string;
}

export function parseDetectedInfo(info: string | undefined | null): ParsedDetectionInfo {
  if (!info || typeof info !== 'string') return {};
  const parts = info.split(/[,;\n]+/);
  const out: ParsedDetectionInfo = {};
  for (const raw of parts) {
    const m = raw.match(/^\s*([^:：]+)[:：]\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    if (!value) continue;
    if (MANUFACTURER_KEYS.test(key)) out.manufacturer = value;
    else if (YEAR_KEYS.test(key)) out.yearOfManufacture = value;
    else if (CAPACITY_KEYS.test(key)) out.capacity = value;
  }
  return out;
}
