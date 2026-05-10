// 個人スポット（household_spot）フローの state machine。
//
// 順序: 場所 → 品目ループ → 品目ごとの依頼先 → 申込者
// 事業者向けフィールド（屋号・業態形態・産廃分類）は無し。

import type { NextStepFn } from './types';
import {
  STEP_address,
  STEP_buildingKind,
  STEP_floor,
  STEP_parking,
  STEP_elevator,
  STEP_dischargeMode,
  addFirstItemStep,
  addMoreItemStep,
  STEP_contactName,
  STEP_contactNameKana,
  STEP_phone,
  STEP_email,
  pickProviderStep,
  pickDatesStep,
  bulkProviderConfirmStep,
  bulkDateConfirmStep,
} from './shared';

export const householdNextStep: NextStepFn = (slots) => {
  const loc = slots.location;
  if (!loc.address) return STEP_address;
  if (!loc.buildingKind) return STEP_buildingKind;
  if (!loc.floor) return STEP_floor;
  if (!loc.parking) return STEP_parking;
  if (!loc.elevator) return STEP_elevator;
  if (!loc.dischargeMode) return STEP_dischargeMode;

  if (slots.items.length === 0) return addFirstItemStep();
  if (slots.meta.noMoreItems !== true) return addMoreItemStep();

  // ----- 依頼先 phase -----
  const providersSet = slots.providerAssignments.filter((a) => a.provider).length;
  // 1品目目の依頼先選択後、複数品目あれば一括適用を提案
  if (
    providersSet === 1 &&
    slots.items.length > 1 &&
    !slots.meta.bulkProviderAsked
  ) {
    return bulkProviderConfirmStep(slots);
  }
  for (const item of slots.items) {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    if (!a?.provider) return pickProviderStep(item, slots);
  }

  // ----- 希望回収日時 phase -----
  const itemsNeedingDates = slots.items.filter((item) => {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    return a?.provider === '民間事業者に依頼';
  });
  const datesSet = itemsNeedingDates.filter((item) => {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    return a?.preferredDates && a.preferredDates.length > 0;
  }).length;
  if (
    datesSet === 1 &&
    itemsNeedingDates.length > 1 &&
    !slots.meta.bulkDateAsked
  ) {
    return bulkDateConfirmStep(slots);
  }
  for (const item of itemsNeedingDates) {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    if (!a?.preferredDates || a.preferredDates.length === 0) {
      return pickDatesStep(item, slots);
    }
  }

  const r = slots.requester;
  if (!r.contactName) return STEP_contactName;
  if (!r.contactNameKana) return STEP_contactNameKana;
  if (!r.phone) return STEP_phone;
  if (!r.email) return STEP_email;

  return null;
};
