// 複数のフローで使い回す step ファクトリ。
// household.ts にすでに同等の関数があるが循環参照を避けるためここに集約する。

import type { Step } from './types';
import type { Slots, Item, ProviderChoice, PreferredDate, Frequency } from '@/lib/slots/types';
import type { SlotPatch } from '@/lib/slots/merge';

export function nextItemId(items: Item[]): string {
  let n = items.length + 1;
  while (items.some((i) => i.id === `item-${n}`)) n++;
  return `item-${n}`;
}

// ---------- 場所 ----------

export const STEP_address: Step = {
  id: 'location.address',
  render: () => [{ kind: 'text', text: '回収先の住所を教えてください。' }],
  acceptText: (text) => ({ location: { address: text } }),
};

export const STEP_storeName: Step = {
  id: 'location.storeName',
  render: () => [{ kind: 'text', text: '店舗名・事業所名を教えてください。' }],
  acceptText: (text) => ({ location: { storeName: text } }),
};

export const STEP_buildingKind: Step = {
  id: 'location.buildingKind',
  render: () => [
    {
      kind: 'chips',
      stepId: 'location.buildingKind',
      prompt: '建物の種類は?',
      options: [
        { label: '戸建て', value: '戸建て' },
        { label: 'マンション・アパート', value: 'マンション・アパート' },
        { label: '倉庫', value: '倉庫' },
        { label: 'その他', value: 'その他' },
      ],
    },
  ],
  acceptResponse: (value) => ({
    location: { buildingKind: value as Slots['location']['buildingKind'] },
  }),
};

function yesNoStep(id: string, prompt: string, field: 'parking' | 'elevator'): Step {
  return {
    id,
    render: () => [
      {
        kind: 'chips',
        stepId: id,
        prompt,
        options: [
          { label: 'あり', value: 'あり' },
          { label: 'なし', value: 'なし' },
        ],
      },
    ],
    acceptResponse: (value) => ({ location: { [field]: value as 'あり' | 'なし' } }),
  };
}

export const STEP_parking = yesNoStep('location.parking', '駐車スペースはありますか?', 'parking');
export const STEP_elevator = yesNoStep('location.elevator', 'エレベーターはありますか?', 'elevator');

export const STEP_dischargeMode: Step = {
  id: 'location.dischargeMode',
  render: () => [
    {
      kind: 'text',
      text: '自分で家の外に出す場合は「自分で排出」を、排出から依頼する場合は「排出を希望」を選択してください。',
    },
    {
      kind: 'chips',
      stepId: 'location.dischargeMode',
      options: [
        { label: '自分で排出', value: '自分で排出' },
        { label: '排出を希望', value: '排出を希望' },
      ],
    },
  ],
  acceptResponse: (value) => ({
    location: { dischargeMode: value as Slots['location']['dischargeMode'] },
  }),
};

// ---------- 品目登録ループ ----------

export const STEP_addFirstItem: Step = {
  id: 'items.addFirst',
  render: () => [
    {
      kind: 'text',
      text: '捨てたいものを教えてください。テキストで入力するか、📷ボタンから写真をアップロードできます。',
    },
  ],
  acceptText: (text, slots) => ({
    items: [{ id: nextItemId(slots.items), label: text }],
  }),
};

export const STEP_addMoreItem: Step = {
  id: 'items.addMore',
  render: () => [{ kind: 'text', text: '次の品目を教えてください。' }],
  acceptText: (text, slots): SlotPatch => ({
    items: [{ id: nextItemId(slots.items), label: text }],
    meta: { noMoreItems: undefined },
  }),
};

export const STEP_moreItemsQuestion: Step = {
  id: 'items.moreQuestion',
  render: () => [
    {
      kind: 'chips',
      stepId: 'items.moreQuestion',
      prompt: '他にも捨てたいものはありますか?',
      options: [
        { label: '他にもあります', value: 'more' },
        { label: 'これで全部です', value: 'done' },
      ],
    },
  ],
  acceptResponse: (value): SlotPatch =>
    value === 'done' ? { meta: { noMoreItems: true } } : { meta: { noMoreItems: false } },
};

// ---------- 依頼先選択（個人/事業者スポット用） ----------

const PROVIDER_LABELS: ProviderChoice[] = [
  '無料引取',
  '自治体に依頼',
  '訪問買取',
  'ネット買取',
  '民間事業者に依頼',
];

export function pickProviderStep(item: Item): Step {
  return {
    id: `provider.pick.${item.id}`,
    render: () => [
      {
        kind: 'chips',
        stepId: `provider.pick.${item.id}`,
        prompt: `「${item.label}」の依頼先を選んでください`,
        options: PROVIDER_LABELS.map((label) => ({
          label,
          value: label,
          // MVP: 「自治体に依頼」は常に disabled。
          disabled: label === '自治体に依頼',
          disabledReason: label === '自治体に依頼' ? 'この地域では未対応です' : undefined,
        })),
      },
    ],
    acceptResponse: (value) => ({
      providerAssignments: [{ itemId: item.id, provider: value as ProviderChoice }],
    }),
  };
}

export function pickDatesStep(item: Item): Step {
  return {
    id: `provider.dates.${item.id}`,
    render: () => [
      {
        kind: 'widget',
        widget: 'calendar',
        stepId: `provider.dates.${item.id}`,
        prompt: `「${item.label}」の希望回収日時を選んでください`,
        mode: 'single',
      },
    ],
    acceptResponse: (value) => ({
      providerAssignments: [
        { itemId: item.id, preferredDates: value as PreferredDate[] },
      ],
    }),
  };
}

// ---------- 申込者情報 ----------

export function freeTextStep(
  id: string,
  prompt: string,
  apply: (text: string) => SlotPatch,
): Step {
  return {
    id,
    render: () => [{ kind: 'text', text: prompt }],
    acceptText: (text) => apply(text),
  };
}

export const STEP_contactName = freeTextStep(
  'requester.contactName',
  'ご担当者のお名前を教えてください。',
  (text) => ({ requester: { contactName: text } }),
);
export const STEP_contactNameKana = freeTextStep(
  'requester.contactNameKana',
  'お名前のフリガナを教えてください。',
  (text) => ({ requester: { contactNameKana: text } }),
);
export const STEP_phone = freeTextStep(
  'requester.phone',
  '電話番号を教えてください。',
  (text) => ({ requester: { phone: text } }),
);
export const STEP_email = freeTextStep(
  'requester.email',
  'メールアドレスを教えてください。',
  (text) => ({ requester: { email: text } }),
);

// ---------- 事業者向け追加step ----------

export const STEP_businessForm: Step = {
  id: 'requester.businessForm',
  render: () => [
    {
      kind: 'chips',
      stepId: 'requester.businessForm',
      prompt: '業態形態を選んでください',
      options: [
        { label: '個人事業主', value: '個人事業主' },
        { label: '株式会社', value: '株式会社' },
        { label: '有限会社', value: '有限会社' },
        { label: 'その他法人', value: 'その他法人' },
      ],
    },
  ],
  acceptResponse: (value) => ({
    requester: { businessForm: value as Slots['requester']['businessForm'] },
  }),
};

export const STEP_businessStoreName = freeTextStep(
  'requester.storeName',
  '屋号を教えてください。',
  (text) => ({ requester: { storeName: text } }),
);
export const STEP_businessName = freeTextStep(
  'requester.businessName',
  '事業者の正式名称を教えてください。',
  (text) => ({ requester: { businessName: text } }),
);
export const STEP_businessNameKana = freeTextStep(
  'requester.businessNameKana',
  '事業者名のフリガナを教えてください。',
  (text) => ({ requester: { businessNameKana: text } }),
);

export const STEP_occupation = freeTextStep(
  'occupation',
  'どんな業種・業態ですか? (例: ラーメン屋、建設業)',
  (text) => ({ occupation: text }),
);

// ---------- 定期回収用: 品目ごとの 数量・頻度・開始日 ----------

const FREQUENCY_OPTIONS: Frequency[] = [
  '毎日',
  '週6',
  '週5',
  '毎週○曜',
  '隔週○曜',
  '月2回',
  '毎月第○○曜',
  'その他',
];

export function quantityStep(item: Item): Step {
  return {
    id: `item.quantity.${item.id}`,
    render: () => [
      {
        kind: 'text',
        text: `「${item.label}」のおおよその数量を教えてください。(例: 45L × 3袋/日)`,
      },
    ],
    acceptText: (text) => ({
      items: [{ id: item.id, estimatedQuantity: text }],
    }),
  };
}

export function frequencyStep(item: Item): Step {
  return {
    id: `item.frequency.${item.id}`,
    render: () => [
      {
        kind: 'chips',
        stepId: `item.frequency.${item.id}`,
        prompt: `「${item.label}」の回収頻度は?`,
        options: FREQUENCY_OPTIONS.map((f) => ({ label: f, value: f })),
      },
    ],
    acceptResponse: (value) => ({
      items: [{ id: item.id, frequency: value as Frequency }],
    }),
  };
}

export function startDateStep(item: Item): Step {
  return {
    id: `item.startDate.${item.id}`,
    render: () => [
      {
        kind: 'widget',
        widget: 'calendar',
        stepId: `item.startDate.${item.id}`,
        prompt: `「${item.label}」の希望開始日を選んでください`,
        mode: 'single',
      },
    ],
    acceptResponse: (value) => {
      const sel = value as PreferredDate[];
      const date = sel[0]?.date;
      return { items: [{ id: item.id, startDate: date }] };
    },
  };
}
