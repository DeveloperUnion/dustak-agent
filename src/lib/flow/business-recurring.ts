// 事業者定期回収（business_recurring）フローの state machine。
//
// business_spot との違い:
// - 品目ごとに 数量・回収頻度・希望開始日 を聞く
// - 依頼先選択は **不要**（定期は別契約）
// - 排出方法は spec の表に明示されないが、定期では運用上常に「排出を希望」相当なので聞かない（MVP方針）

import type { NextStepFn } from './types';
import {
  STEP_manifestNotice,
  STEP_address,
  STEP_storeName,
  STEP_buildingKindBusiness,
  STEP_floor,
  STEP_parking,
  STEP_elevator,
  addFirstItemStep,
  addMoreItemStep,
  STEP_occupation,
  STEP_businessForm,
  STEP_businessStoreName,
  STEP_contactName,
  STEP_contactNameKana,
  STEP_phone,
  STEP_email,
  quantityStep,
  frequencyStep,
  startDateStep,
} from './shared';
import { BUSINESS_RECURRING_ITEM_PRESETS } from './presets';

export const businessRecurringNextStep: NextStepFn = (slots) => {
  // 事業者フローの一番最初にマニフェスト交付義務の説明を提示する
  if (!slots.meta.acknowledgedManifest) return STEP_manifestNotice;
  if (!slots.occupation) return STEP_occupation;

  const loc = slots.location;
  if (!loc.address) return STEP_address;
  if (!loc.storeName) return STEP_storeName;
  if (!loc.buildingKind) return STEP_buildingKindBusiness;
  if (!loc.floor) return STEP_floor;
  if (!loc.parking) return STEP_parking;
  if (loc.floor !== '1階' && !loc.elevator) return STEP_elevator;

  if (slots.items.length === 0) return addFirstItemStep(BUSINESS_RECURRING_ITEM_PRESETS);
  if (slots.meta.noMoreItems !== true) return addMoreItemStep(BUSINESS_RECURRING_ITEM_PRESETS);

  // 品目ごとに 数量・頻度・開始日 を埋める
  for (const item of slots.items) {
    if (!item.estimatedQuantity) return quantityStep(item);
    if (!item.frequency) return frequencyStep(item);
    if (!item.startDate) return startDateStep(item);
  }

  const r = slots.requester;
  if (!r.businessForm) return STEP_businessForm;
  if (!r.storeName) return STEP_businessStoreName;
  if (!r.contactName) return STEP_contactName;
  if (!r.contactNameKana) return STEP_contactNameKana;
  if (!r.phone) return STEP_phone;
  if (!r.email) return STEP_email;

  return null;
};
