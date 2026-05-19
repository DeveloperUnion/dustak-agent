// LLM extractor が返す slotPatch のフィールド単位バリデーション。
//
// 方針:
// - enum / 形式が壊れていたら **そのフィールドだけ drop**（patch全体は捨てない）
// - drop したフィールドは呼び出し側で集計し、ackText に補足を足す or 同じ step を再質問する

import { z } from 'zod';
import type { SlotPatch } from './merge';

const BuildingKindSchema = z.enum([
  '戸建て',
  'マンション・アパート',
  '倉庫',
  '路面店・独立店舗',
  'ビル内テナント・事務所',
  '商業施設内',
  '工場・倉庫',
  'その他',
]);
const YesNoSchema = z.enum(['あり', 'なし']);
const DischargeModeSchema = z.enum(['自分で排出', '排出を希望']);
// frequency は固定 enum ではなく自由表現（"週3日" "土日のみ" 等）も許容するため
// 非空文字列でゆるく受ける。chip 選択時の固定値も同じパスを通る。
const FrequencySchema = z.string().min(1);
const ProviderSchema = z.enum([
  '無料引取', '自治体に依頼', '訪問買取', 'ネット買取', '民間事業者に依頼',
]);
const BusinessFormSchema = z.enum(['個人事業主', '株式会社', '有限会社', 'その他法人']);
const TimeSlotSchema = z.enum(['希望なし', '9-12時', '12-15時', '15-18時']);

// 電話: E.164 (+...) または日本国内の数字10〜11桁を許容
const PhoneSchema = z
  .string()
  .trim()
  .refine((s) => /^\+[1-9]\d{7,14}$/.test(s) || /^0\d{9,10}$/.test(s.replace(/[-\s()]/g, '')), {
    message: 'phone must be E.164 (+81...) or JP 10-11 digits',
  });

// メール: シンプルな RFC 風チェック
const EmailSchema = z.string().trim().toLowerCase().email();

const AddressComponentsSchema = z
  .object({
    postalCode: z.string().optional(),
    prefecture: z.string().optional(),
    city: z.string().optional(),
    ward: z.string().optional(),
    town: z.string().optional(),
    block: z.string().optional(),
    building: z.string().optional(),
    placeId: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .partial();

const LocationSchema = z
  .object({
    address: z.string().min(1).optional(),
    addressComponents: AddressComponentsSchema.optional(),
    storeName: z.string().min(1).optional(),
    buildingKind: BuildingKindSchema.optional(),
    floor: z.string().min(1).optional(),
    parking: YesNoSchema.optional(),
    elevator: YesNoSchema.optional(),
    dischargeMode: DischargeModeSchema.optional(),
    note: z.string().optional(),
  })
  .partial();

const ItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  industrialCategory: z.string().optional(),
  estimatedQuantity: z.string().optional(),
  frequency: FrequencySchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  manufacturer: z.string().optional(),
  yearOfManufacture: z.string().optional(),
  capacity: z.string().optional(),
});

const PreferredDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: TimeSlotSchema,
});

const ProviderAssignmentSchema = z.object({
  itemId: z.string().min(1),
  provider: ProviderSchema.optional(),
  preferredDates: z.array(PreferredDateSchema).optional(),
});

const RequesterSchema = z
  .object({
    businessForm: BusinessFormSchema.optional(),
    storeName: z.string().min(1).optional(),
    businessName: z.string().min(1).optional(),
    businessNameKana: z.string().min(1).optional(),
    contactName: z.string().min(1).optional(),
    contactNameKana: z.string().min(1).optional(),
    phone: PhoneSchema.optional(),
    email: EmailSchema.optional(),
  })
  .partial();

const MetaSchema = z
  .object({
    noMoreItems: z.boolean().optional(),
    confirmedCategories: z.boolean().optional(),
    acknowledgedManifest: z.boolean().optional(),
    itemsReviewed: z.boolean().optional(),
    freeProviderReviewedItemIds: z.array(z.string()).optional(),
    bulkDateAsked: z.boolean().optional(),
  })
  .partial();

/** SlotPatch 全体のスキーマ。各キーは optional。 */
export const SlotPatchSchema = z
  .object({
    occupation: z.string().min(1).optional(),
    location: LocationSchema.optional(),
    items: z.array(ItemSchema).optional(),
    providerAssignments: z.array(ProviderAssignmentSchema).optional(),
    requester: RequesterSchema.optional(),
    meta: MetaSchema.optional(),
  })
  .partial();

export interface ValidatedSlotPatch {
  patch: SlotPatch;
  /** 検証で落としたフィールドの dot-path 一覧（例: "requester.email", "items[0].frequency"）。 */
  droppedFields: string[];
}

/**
 * LLM が返した patch を field 単位で検証する。
 * 不正フィールドは patch から除外し、droppedFields に記録する。
 *
 * 実装メモ: zod の safeParse は object全体のエラーを返すが、ここでは
 * **各 leaf field を個別に検証して残す**ために手動で振り分ける。
 */
export function validateSlotPatch(raw: unknown): ValidatedSlotPatch {
  const dropped: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { patch: {}, droppedFields: [] };
  }
  const input = raw as Record<string, unknown>;
  const patch: SlotPatch = {};

  // フラット項目
  if (input.occupation !== undefined) {
    const r = z.string().min(1).safeParse(input.occupation);
    if (r.success) patch.occupation = r.data;
    else dropped.push('occupation');
  }

  // location: フィールド単位
  if (input.location && typeof input.location === 'object') {
    const loc = input.location as Record<string, unknown>;
    const out: SlotPatch['location'] = {};
    const fieldSchemas: Array<[keyof typeof loc, z.ZodTypeAny]> = [
      ['address', z.string().min(1)],
      ['addressComponents', AddressComponentsSchema],
      ['storeName', z.string().min(1)],
      ['buildingKind', BuildingKindSchema],
      ['floor', z.string().min(1)],
      ['parking', YesNoSchema],
      ['elevator', YesNoSchema],
      ['dischargeMode', DischargeModeSchema],
      ['note', z.string()],
    ];
    for (const [k, schema] of fieldSchemas) {
      if (loc[k] === undefined) continue;
      const r = schema.safeParse(loc[k]);
      if (r.success) (out as Record<string, unknown>)[k as string] = r.data;
      else dropped.push(`location.${String(k)}`);
    }
    if (Object.keys(out).length > 0) patch.location = out;
  }

  // requester: フィールド単位
  if (input.requester && typeof input.requester === 'object') {
    const req = input.requester as Record<string, unknown>;
    const out: SlotPatch['requester'] = {};
    const fieldSchemas: Array<[string, z.ZodTypeAny]> = [
      ['businessForm', BusinessFormSchema],
      ['storeName', z.string().min(1)],
      ['businessName', z.string().min(1)],
      ['businessNameKana', z.string().min(1)],
      ['contactName', z.string().min(1)],
      ['contactNameKana', z.string().min(1)],
      ['phone', PhoneSchema],
      ['email', EmailSchema],
    ];
    for (const [k, schema] of fieldSchemas) {
      if (req[k] === undefined) continue;
      const r = schema.safeParse(req[k]);
      if (r.success) (out as Record<string, unknown>)[k] = r.data;
      else dropped.push(`requester.${k}`);
    }
    if (Object.keys(out).length > 0) patch.requester = out;
  }

  // items: 要素単位（id 必須、他フィールドは個別検証）
  if (Array.isArray(input.items)) {
    const outItems: NonNullable<SlotPatch['items']> = [];
    input.items.forEach((rawItem, idx) => {
      if (!rawItem || typeof rawItem !== 'object') {
        dropped.push(`items[${idx}]`);
        return;
      }
      const it = rawItem as Record<string, unknown>;
      if (typeof it.id !== 'string' || it.id.length === 0) {
        dropped.push(`items[${idx}].id`);
        return;
      }
      const item: NonNullable<SlotPatch['items']>[number] = { id: it.id };
      const fieldSchemas: Array<[string, z.ZodTypeAny]> = [
        ['label', z.string().min(1)],
        ['industrialCategory', z.string()],
        ['estimatedQuantity', z.string()],
        ['frequency', FrequencySchema],
        ['startDate', z.string().regex(/^\d{4}-\d{2}-\d{2}$/)],
        ['manufacturer', z.string()],
        ['yearOfManufacture', z.string()],
        ['capacity', z.string()],
      ];
      for (const [k, schema] of fieldSchemas) {
        if (it[k] === undefined) continue;
        const r = schema.safeParse(it[k]);
        if (r.success) (item as Record<string, unknown>)[k] = r.data;
        else dropped.push(`items[${idx}].${k}`);
      }
      outItems.push(item);
    });
    if (outItems.length > 0) patch.items = outItems;
  }

  // providerAssignments
  if (Array.isArray(input.providerAssignments)) {
    const outA: NonNullable<SlotPatch['providerAssignments']> = [];
    input.providerAssignments.forEach((rawA, idx) => {
      if (!rawA || typeof rawA !== 'object') {
        dropped.push(`providerAssignments[${idx}]`);
        return;
      }
      const a = rawA as Record<string, unknown>;
      if (typeof a.itemId !== 'string' || a.itemId.length === 0) {
        dropped.push(`providerAssignments[${idx}].itemId`);
        return;
      }
      const entry: NonNullable<SlotPatch['providerAssignments']>[number] = { itemId: a.itemId };
      if (a.provider !== undefined) {
        const r = ProviderSchema.safeParse(a.provider);
        if (r.success) entry.provider = r.data;
        else dropped.push(`providerAssignments[${idx}].provider`);
      }
      if (a.preferredDates !== undefined) {
        const r = z.array(PreferredDateSchema).safeParse(a.preferredDates);
        if (r.success) entry.preferredDates = r.data;
        else dropped.push(`providerAssignments[${idx}].preferredDates`);
      }
      outA.push(entry);
    });
    if (outA.length > 0) patch.providerAssignments = outA;
  }

  // meta
  if (input.meta && typeof input.meta === 'object') {
    const m = input.meta as Record<string, unknown>;
    const out: SlotPatch['meta'] = {};
    if (m.noMoreItems !== undefined) {
      if (typeof m.noMoreItems === 'boolean') out.noMoreItems = m.noMoreItems;
      else dropped.push('meta.noMoreItems');
    }
    if (m.confirmedCategories !== undefined) {
      if (typeof m.confirmedCategories === 'boolean') out.confirmedCategories = m.confirmedCategories;
      else dropped.push('meta.confirmedCategories');
    }
    if (m.acknowledgedManifest !== undefined) {
      if (typeof m.acknowledgedManifest === 'boolean') out.acknowledgedManifest = m.acknowledgedManifest;
      else dropped.push('meta.acknowledgedManifest');
    }
    if (m.itemsReviewed !== undefined) {
      if (typeof m.itemsReviewed === 'boolean') out.itemsReviewed = m.itemsReviewed;
      else dropped.push('meta.itemsReviewed');
    }
    if (m.freeProviderReviewedItemIds !== undefined) {
      const r = z.array(z.string()).safeParse(m.freeProviderReviewedItemIds);
      if (r.success) out.freeProviderReviewedItemIds = r.data;
      else dropped.push('meta.freeProviderReviewedItemIds');
    }
    if (m.bulkDateAsked !== undefined) {
      if (typeof m.bulkDateAsked === 'boolean') out.bulkDateAsked = m.bulkDateAsked;
      else dropped.push('meta.bulkDateAsked');
    }
    if (Object.keys(out).length > 0) patch.meta = out;
  }

  return { patch, droppedFields: dropped };
}
