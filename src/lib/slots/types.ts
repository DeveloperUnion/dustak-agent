// specs/chat.md のフォーム項目とスロット定義を 1:1 で TypeScript に写す

export type FlowKind = 'household_spot' | 'business_spot' | 'business_recurring';

export type BuildingKind =
  // household 向け
  | '戸建て'
  | 'マンション・アパート'
  | '倉庫'
  // business 向け
  | '路面店・独立店舗'
  | 'ビル内テナント・事務所'
  | '商業施設内'
  | '工場・倉庫'
  // 共通
  | 'その他';
export type YesNo = 'あり' | 'なし';
export type DischargeMode = '自分で排出' | '排出を希望';

// Google Places / Geocoding から取得した構造化住所データ
export interface AddressComponents {
  postalCode?: string;    // 〒xxx-xxxx
  prefecture?: string;    // 都道府県
  city?: string;          // 市区町村
  ward?: string;          // 区（政令指定都市）
  town?: string;          // 町名
  block?: string;         // 番地
  building?: string;      // 建物名・部屋番号
  placeId?: string;       // Google Place ID
  lat?: number;
  lng?: number;
}

// ステップ1: 回収・排出場所
export interface LocationSlot {
  address?: string;
  addressComponents?: AddressComponents;
  storeName?: string;
  buildingKind?: BuildingKind;
  /** 回収品の置き場の階。"1階" "2階" "3階" "4階以上" もしくは自由表現（"地下1階" など）。 */
  floor?: string;
  parking?: YesNo;
  elevator?: YesNo;
  dischargeMode?: DischargeMode;
  note?: string;
}

// ステップ2: 品目（定期/スポット共通）
// chip の値・ユーザー自由入力どちらも文字列で保持する（"毎日" "毎週水曜" "週3日" "月末締め" 等）。
// extractor / FrequencySchema も非空文字列で受ける。
export type Frequency = string;

export interface Item {
  id: string;
  label: string; // 品目内容（自由表現）
  industrialCategory?: string; // 産廃20分類のいずれか（事業者のみ）
  estimatedQuantity?: string; // 例: "45L × 3袋/日"
  frequency?: Frequency; // 定期回収のみ
  startDate?: string; // YYYY-MM-DD（定期回収のみ）
  // 無料引取候補（家電等）の追加情報。画像検知から取得できればデフォルト埋め
  manufacturer?: string; // メーカー名（例: "Panasonic"）
  yearOfManufacture?: string; // 製造年（例: "2020"、自由表現も許容）
  capacity?: string; // 容量（例: "300L" "8kg" "20畳"）
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
  /** ユーザーが品目ごとの産廃20分類を確認したか（事業者向け） */
  confirmedCategories?: boolean;
  /** 事業者フロー先頭のマニフェスト交付義務に関する説明をユーザーが確認したか */
  acknowledgedManifest?: boolean;
  /** 品目確定後の「品目リスト総覧 → 無料引取候補がある旨」ステップを通過したか */
  itemsReviewed?: boolean;
  /** 無料引取候補の家電情報フォームで確定/キャンセル済の itemId 一覧 */
  freeProviderReviewedItemIds?: string[];
  /** 1品目目の希望回収日時選択後、「他の品目も同じ日時にする?」を1度問い合わせ済みか */
  bulkDateAsked?: boolean;
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
