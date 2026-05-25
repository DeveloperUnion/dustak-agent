// 事業者スポット（business_spot）フローの state machine。
//
// household_spot に加えて:
// - 業態 (occupation) を聞く（後の業態テンプレ提案・PredictCost に使う）
// - 事業形態 / 屋号
// - 依頼先選択あり（household と同じ5チップ）

import type { NextStepFn } from './types';
import {
  STEP_manifestNotice,
  STEP_address,
  STEP_storeName,
  STEP_buildingKindBusiness,
  STEP_floor,
  STEP_parking,
  STEP_elevator,
  STEP_dischargeMode,
  addFirstItemStep,
  addMoreItemStep,
  STEP_occupation,
  STEP_businessForm,
  STEP_businessStoreName,
  STEP_contactName,
  STEP_contactNameKana,
  STEP_phone,
  STEP_email,
  itemsReviewStep,
  freeProviderFormStep,
  groupedProviderPickStep,
  pickDatesStep,
  bulkDateConfirmStep,
} from './shared';
import { isFreeProviderEligible } from '@/lib/mocks/freeProviderEligibility';

export const businessSpotNextStep: NextStepFn = (slots) => {
  // 事業者フローの一番最初にマニフェスト交付義務の説明を提示する
  if (!slots.meta.acknowledgedManifest) return STEP_manifestNotice;
  // 業態は次に聞く（テンプレ提案や PredictCost のためにも先に欲しい）
  if (!slots.occupation) return STEP_occupation;

  const loc = slots.location;
  if (!loc.address) return STEP_address;
  if (!loc.storeName) return STEP_storeName;
  if (!loc.buildingKind) return STEP_buildingKindBusiness;
  if (!loc.floor) return STEP_floor;
  if (!loc.parking) return STEP_parking;
  if (loc.floor !== '1階' && !loc.elevator) return STEP_elevator;
  if (!loc.dischargeMode) return STEP_dischargeMode;

  if (slots.items.length === 0) return addFirstItemStep();
  if (slots.meta.noMoreItems !== true) return addMoreItemStep();

  // ----- 品目レビュー phase -----
  if (!slots.meta.itemsReviewed) return itemsReviewStep(slots);

  // ----- 無料引取候補フォーム phase -----
  const reviewedIds = slots.meta.freeProviderReviewedItemIds ?? [];
  const freeCandidates = slots.items.filter(isFreeProviderEligible);
  for (const cand of freeCandidates) {
    if (!reviewedIds.includes(cand.id)) return freeProviderFormStep(cand);
  }

  // ----- 残品目のグループ化 provider pick phase -----
  const needsProvider = slots.items.some((item) => {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    return !a?.provider;
  });
  if (needsProvider) return groupedProviderPickStep(slots);

  // ----- 希望回収日時 phase（民間事業者依頼分）-----
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
  if (!r.businessForm) return STEP_businessForm;
  if (!r.storeName) return STEP_businessStoreName;
  if (!r.contactName) return STEP_contactName;
  if (!r.contactNameKana) return STEP_contactNameKana;
  if (!r.phone) return STEP_phone;
  if (!r.email) return STEP_email;

  return null;
};
