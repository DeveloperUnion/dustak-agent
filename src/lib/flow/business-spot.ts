// 事業者スポット（business_spot）フローの state machine。
//
// household_spot に加えて:
// - 業態 (occupation) を聞く（後の業態テンプレ提案・PredictCost に使う）
// - 業態形態 / 屋号 / 事業者名 / 事業者名カナ
// - 依頼先選択あり（household と同じ5チップ）

import type { NextStepFn } from './types';
import {
  STEP_address,
  STEP_storeName,
  STEP_buildingKind,
  STEP_parking,
  STEP_elevator,
  STEP_dischargeMode,
  STEP_addFirstItem,
  STEP_addMoreItem,
  STEP_moreItemsQuestion,
  STEP_occupation,
  STEP_businessForm,
  STEP_businessStoreName,
  STEP_businessName,
  STEP_businessNameKana,
  STEP_contactName,
  STEP_contactNameKana,
  STEP_phone,
  STEP_email,
  pickProviderStep,
  pickDatesStep,
} from './shared';

export const businessSpotNextStep: NextStepFn = (slots) => {
  // 業態は最初に聞く（テンプレ提案や PredictCost のためにも先に欲しい）
  if (!slots.occupation) return STEP_occupation;

  const loc = slots.location;
  if (!loc.address) return STEP_address;
  if (!loc.storeName) return STEP_storeName;
  if (!loc.buildingKind) return STEP_buildingKind;
  if (!loc.parking) return STEP_parking;
  if (!loc.elevator) return STEP_elevator;
  if (!loc.dischargeMode) return STEP_dischargeMode;

  if (slots.items.length === 0) return STEP_addFirstItem;
  if (slots.meta.noMoreItems === undefined) return STEP_moreItemsQuestion;
  if (slots.meta.noMoreItems === false) return STEP_addMoreItem;

  for (const item of slots.items) {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    if (!a?.provider) return pickProviderStep(item);
    if (a.provider === '民間事業者に依頼' && (!a.preferredDates || a.preferredDates.length === 0)) {
      return pickDatesStep(item);
    }
  }

  const r = slots.requester;
  if (!r.businessForm) return STEP_businessForm;
  if (!r.storeName) return STEP_businessStoreName;
  if (!r.businessName) return STEP_businessName;
  if (!r.businessNameKana) return STEP_businessNameKana;
  if (!r.contactName) return STEP_contactName;
  if (!r.contactNameKana) return STEP_contactNameKana;
  if (!r.phone) return STEP_phone;
  if (!r.email) return STEP_email;

  return null;
};
