// 個人スポット（household_spot）フローの state machine。
//
// 順序: 場所 → 品目ループ → 品目ごとの依頼先 → 申込者
// 事業者向けフィールド（屋号・業態形態・産廃分類）は無し。

import type { NextStepFn } from './types';
import {
  STEP_address,
  STEP_buildingKind,
  STEP_parking,
  STEP_elevator,
  STEP_dischargeMode,
  STEP_addFirstItem,
  STEP_addMoreItem,
  STEP_moreItemsQuestion,
  STEP_contactName,
  STEP_contactNameKana,
  STEP_phone,
  STEP_email,
  pickProviderStep,
  pickDatesStep,
} from './shared';

export const householdNextStep: NextStepFn = (slots) => {
  const loc = slots.location;
  if (!loc.address) return STEP_address;
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
  if (!r.contactName) return STEP_contactName;
  if (!r.contactNameKana) return STEP_contactNameKana;
  if (!r.phone) return STEP_phone;
  if (!r.email) return STEP_email;

  return null;
};
