// specs/chat.md のフォーム項目とスロット定義を 1:1 で TypeScript に写す

export type FlowKind = 'household_spot' | 'business_spot' | 'business_recurring';

export type BuildingKind = '戸建て' | 'マンション・アパート' | '倉庫' | 'その他';
export type YesNo = 'あり' | 'なし';
export type DischargeMode = '自分で排出' | '排出を希望';

// ステップ1: 回収・排出場所
export interface LocationSlot {
  address?: string;
  storeName?: string;
  buildingKind?: BuildingKind;
  parking?: YesNo;
  elevator?: YesNo;
  dischargeMode?: DischargeMode;
  note?: string;
}

// ステップ2: 品目（定期/スポット共通）
export type Frequency =
  | '毎日'
  | '週6'
  | '週5'
  | '毎週○曜'
  | '隔週○曜'
  | '月2回'
  | '毎月第○○曜'
  | 'その他';

export interface Item {
  id: string;
  label: string; // 品目内容（自由表現）
  industrialCategory?: string; // 産廃20分類のいずれか（事業者のみ）
  estimatedQuantity?: string; // 例: "45L × 3袋/日"
  frequency?: Frequency; // 定期回収のみ
  startDate?: string; // YYYY-MM-DD（定期回収のみ）
}

// 依頼先選択（個人/事業者スポット時）
export type ProviderChoice =
  | '無料引取'
  | '自治体に依頼'
  | '訪問買取'
  | 'ネット買取'
  | '民間事業者に依頼';

export interface ItemProviderAssignment {
  itemId: string;
  provider?: ProviderChoice;
  preferredDates?: PreferredDate[]; // 民間事業者選択時
}

export interface PreferredDate {
  date: string; // YYYY-MM-DD
  timeSlot: '希望なし' | '9-12時' | '12-15時' | '15-18時';
}

// ステップ3: 申込者情報
export type BusinessForm = '個人事業主' | '株式会社' | '有限会社' | 'その他法人';

export interface RequesterSlot {
  // 事業者のみ
  businessForm?: BusinessForm;
  storeName?: string; // 屋号
  businessName?: string;
  businessNameKana?: string;
  // 共通
  contactName?: string;
  contactNameKana?: string;
  phone?: string; // E.164
  email?: string;
}

/** 制御フラグ。スロット値ではなく「ユーザーがこのstepを通過した」記録に使う。 */
export interface SlotsMeta {
  /** 「他に品目はありますか?」で「これで全部です」を選んだ */
  noMoreItems?: boolean;
  /** ユーザーが確認したか（事業者向け産廃分類など） */
  confirmedCategories?: boolean;
}

export interface Slots {
  flow: FlowKind;
  /** 業態（自由表現。例: "ラーメン屋", "カフェ"）。事業者向けで PredictCostModel への入力に使う */
  occupation?: string;
  location: LocationSlot;
  items: Item[];
  providerAssignments: ItemProviderAssignment[];
  requester: RequesterSlot;
  meta: SlotsMeta;
}

export function emptySlots(flow: FlowKind): Slots {
  return {
    flow,
    location: {},
    items: [],
    providerAssignments: [],
    requester: {},
    meta: {},
  };
}
