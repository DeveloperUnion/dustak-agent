// 複数のフローで使い回す step ファクトリ。
//
// 重要: 自由入力テキストは **常に LLM extractor 経由**で処理する方針なので、
// 各 step は acceptText を持たない。チップ/ウィジェット応答だけ acceptResponse で受ける。

import type { Step } from './types';
import type { Slots, Item, ProviderChoice, PreferredDate, Frequency, AddressComponents } from '@/lib/slots/types';
import type { SlotPatch } from '@/lib/slots/merge';
import type { ChipOption } from '@/types/messages';
import { isFreeProviderEligible } from '@/lib/mocks/freeProviderEligibility';

// ---------- 事業者フロー先頭: マニフェスト説明 ----------

// TODO: 本番コピーに差し替え。マニフェスト（産業廃棄物管理票）の制度説明。
const MANIFEST_NOTICE_TEXT =
  '【ご確認ください】\n' +
  '事業者から排出されるゴミのうち、産業廃棄物に該当するものは、法律により「マニフェスト（産業廃棄物管理票）」の交付が義務付けられています。\n' +
  '弊社では一般廃棄物・産業廃棄物いずれも適切に処理し、必要に応じてマニフェスト発行に対応いたします。\n' +
  '内容をご確認のうえ、申し込みにお進みください。';

export const STEP_manifestNotice: Step = {
  id: 'meta.manifestNotice',
  render: () => [
    { kind: 'text', text: MANIFEST_NOTICE_TEXT },
    {
      kind: 'chips',
      stepId: 'meta.manifestNotice',
      options: [{ label: '確認しました', value: 'ack' }],
    },
  ],
  acceptResponse: () => ({ meta: { acknowledgedManifest: true } }),
};

// ---------- 場所 ----------

export const STEP_address: Step = {
  id: 'location.address',
  render: () => [
    {
      kind: 'widget',
      widget: 'address_picker' as const,
      stepId: 'location.address',
      prompt: '回収先の住所を教えてください。',
    },
  ],
  acceptResponse: (value) => {
    const v = value as { address: string; components?: AddressComponents };
    return {
      location: {
        address: v.address,
        ...(v.components ? { addressComponents: v.components } : {}),
      },
    };
  },
};

export const STEP_storeName: Step = {
  id: 'location.storeName',
  render: () => [{ kind: 'text', text: '店舗名・事業所名を教えてください。' }],
  llmHint: 'ユーザー入力を location.storeName に入れてください。',
};

// 個人スポット向け（住宅系の選択肢）
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
      allowFreeText: true,
    },
  ],
  acceptResponse: (value) => ({
    location: { buildingKind: value as Slots['location']['buildingKind'] },
  }),
};

// 事業者向け（業務用建物の選択肢）
export const STEP_buildingKindBusiness: Step = {
  id: 'location.buildingKind',
  render: () => [
    {
      kind: 'chips',
      stepId: 'location.buildingKind',
      prompt: '建物の種類は?',
      options: [
        { label: '路面店・独立店舗', value: '路面店・独立店舗' },
        { label: 'ビル内テナント・事務所', value: 'ビル内テナント・事務所' },
        { label: '商業施設内', value: '商業施設内' },
        { label: '工場・倉庫', value: '工場・倉庫' },
        { label: 'その他', value: 'その他' },
      ],
      allowFreeText: true,
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

export const STEP_floor: Step = {
  id: 'location.floor',
  render: () => [
    {
      kind: 'chips',
      stepId: 'location.floor',
      prompt: '回収する品物は何階にありますか?',
      options: [
        { label: '1階', value: '1階' },
        { label: '2階', value: '2階' },
        { label: '3階', value: '3階' },
        { label: '4階以上', value: '4階以上' },
      ],
      allowFreeText: true,
    },
  ],
  acceptResponse: (value) => ({
    location: { floor: value as string },
  }),
};

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

const NO_MORE_ITEMS_VALUE = '__no_more_items__';
const IMAGE_ACTION_VALUE = '__action_open_image_picker__';
const PRESET_ITEM_VALUE_PREFIX = '__preset_item__';

const ADD_ITEM_LLM_HINT_FIRST = `ユーザー入力を items[] に追加してください。
新規 item の id は "item-{連番}" 形式で、既存の最大連番 +1 を使ってください（現 items が空なら "item-1"）。
1発話に複数品目があれば複数追加してかまいません。`;

const ADD_ITEM_LLM_HINT_MORE = `ユーザー入力を items[] に追加してください。新規 id は既存の最大連番 +1。
追加に成功したら meta.noMoreItems は patch に含めず undefined のままにしてください（ユーザーが「品目を確定する」チップを押すまで items 追加を続けます）。`;

function buildPresetChips(presets: readonly string[]): ChipOption[] {
  return presets.map((label) => ({
    label,
    value: `${PRESET_ITEM_VALUE_PREFIX}${label}`,
  }));
}

function nextItemId(slots: Slots): string {
  const maxN = slots.items.reduce((acc, it) => {
    const m = /^item-(\d+)$/.exec(it.id);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `item-${maxN + 1}`;
}

function presetAcceptResponse(value: unknown, slots: Slots): SlotPatch {
  if (typeof value !== 'string') return {};
  if (value.startsWith(PRESET_ITEM_VALUE_PREFIX)) {
    const label = value.slice(PRESET_ITEM_VALUE_PREFIX.length);
    return { items: [{ id: nextItemId(slots), label }] };
  }
  return {};
}

export function addFirstItemStep(presets?: readonly string[]): Step {
  const hasPresets = !!presets && presets.length > 0;
  return {
    id: 'items.addFirst',
    render: () => [
      { kind: 'text', text: '捨てたいものを教えてください。' },
      {
        kind: 'chips',
        stepId: 'items.addFirst',
        options: [
          ...(hasPresets ? buildPresetChips(presets!) : []),
          {
            label: '📷 画像から選択',
            value: IMAGE_ACTION_VALUE,
            action: 'open_image_picker',
          },
        ],
        allowFreeText: true,
      },
    ],
    // プリセット chip は acceptResponse で items に追加。
    // action チップはクライアント側で intercept されサーバーに来ない。
    // 自由入力は extractor 経由で処理される。
    acceptResponse: presetAcceptResponse,
    llmHint: ADD_ITEM_LLM_HINT_FIRST,
  };
}

export function addMoreItemStep(presets?: readonly string[]): Step {
  const hasPresets = !!presets && presets.length > 0;
  return {
    id: 'items.addMore',
    render: (slots) => {
      const lines = slots.items.map((i, idx) => `${idx + 1}. ${i.label}`);
      const text =
        slots.items.length > 0
          ? `【ご登録済み】\n${lines.join('\n')}\n\n他に処分したい品目はありますか?`
          : '次の品目を教えてください。';
      return [
        { kind: 'text', text },
        {
          kind: 'chips',
          stepId: 'items.addMore',
          options: [
            ...(hasPresets ? buildPresetChips(presets!) : []),
            {
              label: '📷 画像から選択',
              value: IMAGE_ACTION_VALUE,
              action: 'open_image_picker',
            },
            { label: '品目を確定する', value: NO_MORE_ITEMS_VALUE },
          ],
          allowFreeText: true,
        },
      ];
    },
    acceptResponse: (value, slots): SlotPatch => {
      if (value === NO_MORE_ITEMS_VALUE) return { meta: { noMoreItems: true } };
      return presetAcceptResponse(value, slots);
    },
    llmHint: ADD_ITEM_LLM_HINT_MORE,
  };
}

// ---------- 品目レビュー / 無料引取候補フォーム / グループ化 provider 選択 ----------

/** 残品目グループ化 picker 用の provider 4択（無料引取は別経路）。 */
const GROUPED_PROVIDERS: ProviderChoice[] = [
  '民間事業者に依頼',
  '自治体に依頼',
  '訪問買取',
  'ネット買取',
];

/** 希望回収日時用の品目別サマリー文を返す（民間事業者依頼の品目が複数あるときのみ非空）。 */
function dateSummaryText(slots: Slots, currentItemId: string): string | null {
  const itemsNeedingDates = slots.items.filter((i) => {
    const a = slots.providerAssignments.find((x) => x.itemId === i.id);
    return a?.provider === '民間事業者に依頼';
  });
  if (itemsNeedingDates.length <= 1) return null;
  const lines = itemsNeedingDates.map((i, idx) => {
    const a = slots.providerAssignments.find((x) => x.itemId === i.id);
    const dates = a?.preferredDates;
    const status =
      dates && dates.length > 0
        ? `→ ${dates.map((d) => `${d.date} ${d.timeSlot}`).join(' / ')}`
        : i.id === currentItemId
          ? '← 選択中'
          : '(未選択)';
    return `${idx + 1}. ${i.label} ${status}`;
  });
  return `【品目別の希望回収日時】\n${lines.join('\n')}`;
}

/**
 * 品目確定直後に品目リストを総覧する step。
 * - 無料引取候補が **ある** 場合: 候補に印を付けて「詳細を確認する」chip を出す
 * - 候補が **ない** 場合: 「次へ」chip だけ出して進む
 * いずれも acceptResponse で meta.itemsReviewed=true を立てて次のフェーズに移行。
 */
export function itemsReviewStep(slots: Slots): Step {
  const candidates = slots.items.filter(isFreeProviderEligible);
  const hasCandidates = candidates.length > 0;
  const lines = slots.items.map((i, idx) => {
    const mark = isFreeProviderEligible(i) ? ' ♻️無料引取候補' : '';
    return `${idx + 1}. ${i.label}${mark}`;
  });
  const body = hasCandidates
    ? `【ご登録品目】\n${lines.join('\n')}\n\n♻️ がついた品目は状態によっては無料引取が可能です。次の画面で詳細を伺います。`
    : `【ご登録品目】\n${lines.join('\n')}\n\n回収方法をうかがいます。`;
  return {
    id: 'items.review',
    render: () => [
      { kind: 'text', text: body },
      {
        kind: 'chips',
        stepId: 'items.review',
        options: [
          {
            label: hasCandidates ? '無料引取候補の詳細を確認する' : '次へ',
            value: 'ack',
          },
        ],
      },
    ],
    acceptResponse: () => ({ meta: { itemsReviewed: true } }),
  };
}

/**
 * 無料引取候補1品目の家電情報フォーム。
 * - 「無料で引き取り依頼する」 → providerAssignments に '無料引取' をセット
 * - 「キャンセル（他の方法）」 → providerAssignments には触らず、grouped picker へ流す
 * いずれも freeProviderReviewedItemIds に当該 id を追加。
 */
export function freeProviderFormStep(item: Item): Step {
  return {
    id: `freeProvider.form.${item.id}`,
    render: () => [
      {
        kind: 'widget',
        widget: 'free_provider_form',
        stepId: `freeProvider.form.${item.id}`,
        itemId: item.id,
        itemLabel: item.label,
        defaults: {
          manufacturer: item.manufacturer,
          yearOfManufacture: item.yearOfManufacture,
          capacity: item.capacity,
        },
        prompt: `「${item.label}」の状態を教えてください。情報を入力して「無料で引き取り依頼する」を押すと、無料引取の対象として確定します。`,
      },
    ],
    acceptResponse: (value): SlotPatch => {
      const v = value as {
        action?: 'confirm' | 'cancel';
        manufacturer?: string;
        yearOfManufacture?: string;
        capacity?: string;
      };
      const itemPatch = {
        id: item.id,
        manufacturer: v.manufacturer,
        yearOfManufacture: v.yearOfManufacture,
        capacity: v.capacity,
      };
      if (v.action === 'confirm') {
        return {
          items: [itemPatch],
          providerAssignments: [{ itemId: item.id, provider: '無料引取' }],
          meta: { freeProviderReviewedItemIds: [item.id] },
        };
      }
      // cancel: 入力済の属性は保持しつつ provider は未割り当てのまま
      return {
        items: [itemPatch],
        meta: { freeProviderReviewedItemIds: [item.id] },
      };
    },
  };
}

/**
 * 残品目をチェックボックスで複数選択し、1つの provider を割り当てる step。
 * 1グループ確定後、まだ provider 未割り当て品目があれば state machine が再度返す。
 */
export function groupedProviderPickStep(slots: Slots): Step {
  const remaining = slots.items.filter((i) => {
    const a = slots.providerAssignments.find((x) => x.itemId === i.id);
    return !a?.provider;
  });
  return {
    id: 'provider.groupedPick',
    render: () => [
      {
        kind: 'widget',
        widget: 'grouped_provider_pick',
        stepId: 'provider.groupedPick',
        items: remaining.map((i) => ({ id: i.id, label: i.label })),
        providers: GROUPED_PROVIDERS,
        // MVP: 自治体は地域未対応で disabled。
        disabledProviders: [
          { provider: '自治体に依頼', reason: 'この地域では未対応です' },
        ],
        prompt:
          remaining.length === slots.items.length
            ? '同じ方法で出す品目をチェックして、回収方法を選んでください。'
            : '残りの品目で同じ方法で出すものをチェックして、回収方法を選んでください。',
      },
    ],
    acceptResponse: (value): SlotPatch => {
      const v = value as { itemIds?: string[]; provider?: ProviderChoice };
      if (!v.itemIds || v.itemIds.length === 0 || !v.provider) return {};
      return {
        providerAssignments: v.itemIds.map((id) => ({
          itemId: id,
          provider: v.provider,
        })),
      };
    },
  };
}

export function pickDatesStep(item: Item, slots: Slots): Step {
  const summary = dateSummaryText(slots, item.id);
  return {
    id: `provider.dates.${item.id}`,
    render: () => [
      ...(summary ? [{ kind: 'text' as const, text: summary }] : []),
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

/**
 * 1品目目の希望回収日時選択後、残り（民間事業者依頼の）品目に同じ日時を一括適用するか確認する step。
 */
export function bulkDateConfirmStep(slots: Slots): Step {
  const filledDates = slots.providerAssignments.find(
    (a) => a.preferredDates && a.preferredDates.length > 0,
  )?.preferredDates;
  const itemsNeedingDates = slots.items.filter((item) => {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    return a?.provider === '民間事業者に依頼';
  });
  const itemsWithoutDates = itemsNeedingDates.filter((item) => {
    const a = slots.providerAssignments.find((x) => x.itemId === item.id);
    return !a?.preferredDates || a.preferredDates.length === 0;
  });
  const remainingCount = itemsWithoutDates.length;
  const datesText = filledDates?.map((d) => `${d.date} ${d.timeSlot}`).join(' / ') ?? '';
  return {
    id: 'provider.bulkDateConfirm',
    render: () => [
      {
        kind: 'chips',
        stepId: 'provider.bulkDateConfirm',
        prompt: `他の${remainingCount}品目も同じ希望日時 (${datesText}) にしますか?`,
        options: [
          { label: '全部同じ日時で統一', value: 'unify' },
          { label: '品目ごとに個別に選ぶ', value: 'per_item' },
        ],
      },
    ],
    acceptResponse: (value): SlotPatch => {
      if (value === 'unify' && filledDates) {
        return {
          providerAssignments: itemsWithoutDates.map((i) => ({
            itemId: i.id,
            preferredDates: filledDates,
          })),
          meta: { bulkDateAsked: true },
        };
      }
      return { meta: { bulkDateAsked: true } };
    },
  };
}

// ---------- 申込者情報 ----------

/**
 * 自由入力テキストで埋める step を作るヘルパ。
 * 自由入力は LLM extractor 経由で処理されるので、ここでは render と llmHint のみ定義。
 */
export function freeTextStep(id: string, prompt: string, llmHint: string): Step {
  return {
    id,
    render: () => [{ kind: 'text', text: prompt }],
    llmHint,
  };
}

export const STEP_contactName = freeTextStep(
  'requester.contactName',
  'ご担当者のお名前を教えてください。',
  'ユーザー入力を requester.contactName に入れてください。',
);
export const STEP_contactNameKana = freeTextStep(
  'requester.contactNameKana',
  'お名前のフリガナを教えてください。',
  'ユーザー入力を requester.contactNameKana に入れてください。カタカナ表記を尊重します。',
);
export const STEP_phone = freeTextStep(
  'requester.phone',
  '電話番号を教えてください。',
  `ユーザー入力を requester.phone に入れてください。
形式は E.164 (例: "+819012345678") または日本国内の数字のみ (例: "09012345678") に正規化してください。
ハイフン・括弧・全角数字は除去し、半角数字に揃えてください。`,
);
export const STEP_email = freeTextStep(
  'requester.email',
  'メールアドレスを教えてください。',
  'ユーザー入力を requester.email に入れてください。前後の空白を除去し、小文字に正規化してください。',
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
      allowFreeText: true,
    },
  ],
  acceptResponse: (value) => ({
    requester: { businessForm: value as Slots['requester']['businessForm'] },
  }),
};

export const STEP_businessStoreName = freeTextStep(
  'requester.storeName',
  '屋号を教えてください。',
  'ユーザー入力を requester.storeName に入れてください。',
);
export const STEP_businessName = freeTextStep(
  'requester.businessName',
  '事業者の正式名称を教えてください。',
  'ユーザー入力を requester.businessName に入れてください。',
);
export const STEP_businessNameKana = freeTextStep(
  'requester.businessNameKana',
  '事業者名のフリガナを教えてください。',
  'ユーザー入力を requester.businessNameKana に入れてください。カタカナ表記を尊重します。',
);

export const STEP_occupation = freeTextStep(
  'occupation',
  'どんな業種・業態ですか? (例: ラーメン屋、建設業)',
  'ユーザー入力を occupation に入れてください。業態の自由表現を尊重します。',
);

// ---------- 定期回収用: 品目ごとの 数量・頻度・開始日 ----------

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'] as const;

const FREQUENCY_CHIPS: ChipOption[] = [
  { label: '毎日', value: '毎日' },
  {
    label: '週N日',
    value: '__group_weekN__',
    subOptions: [1, 2, 3, 4, 5, 6].map((n) => ({
      label: `週${n}日`,
      value: `週${n}日`,
    })),
  },
  {
    label: '毎週○曜',
    value: '__group_weekly__',
    subOptions: WEEKDAYS.map((d) => ({ label: `毎週${d}曜`, value: `毎週${d}曜` })),
  },
  {
    label: '隔週○曜',
    value: '__group_biweekly__',
    subOptions: WEEKDAYS.map((d) => ({ label: `隔週${d}曜`, value: `隔週${d}曜` })),
  },
  { label: '月2回', value: '月2回' },
];

/** 品目 label に応じて適切な数量入力例を返す。 */
function quantityExamplesFor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('ダンボール') || l.includes('段ボール')) {
    return '例: 「10枚/日」 / 「5束/週」 / 「20kg/週」';
  }
  if (l.includes('生ゴミ') || l.includes('生ごみ') || l.includes('食品残渣') || l.includes('食用油')) {
    return '例: 「45L × 3袋/日」 / 「20L × 1缶/週」';
  }
  if (l.includes('紙') || l.includes('書類') || l.includes('シュレッダー')) {
    return '例: 「5kg/日」 / 「45L × 1袋/日」 / 「ダンボール3箱/週」';
  }
  if (l.includes('プラ') || l.includes('ペットボトル') || l.includes('ビン') || l.includes('カン') || l.includes('缶')) {
    return '例: 「45L × 2袋/日」 / 「10kg/週」';
  }
  if (
    l.includes('机') || l.includes('椅子') || l.includes('ロッカー') ||
    l.includes('キャビネット') || l.includes('什器') || l.includes('棚') ||
    l.includes('ベッド') || l.includes('ソファ') || l.includes('テーブル') ||
    l.includes('冷蔵庫') || l.includes('洗濯機') || l.includes('テレビ') ||
    l.includes('電子レンジ') || l.includes('自転車') || l.includes('布団') ||
    l.includes('パーティション')
  ) {
    return '例: 「1台」 / 「3点」 / 「高さ180cm × 幅90cm 1点」';
  }
  // デフォルト: 複数フォーマット併記
  return '例: 「45L × 3袋/日」 / 「10枚/日」 / 「5kg/週」 / 「1台」';
}

export function quantityStep(item: Item): Step {
  const examples = quantityExamplesFor(item.label);
  return {
    id: `item.quantity.${item.id}`,
    render: () => [
      {
        kind: 'text',
        text: `「${item.label}」のおおよその数量を教えてください。\n${examples}`,
      },
    ],
    llmHint: `現在聞いているのは品目「${item.label}」のおおよその数量です。
items[].id = "${item.id}" の estimatedQuantity を埋めてください。
ユーザー入力を以下のような形式に正規化してください:
- ゴミ袋類（生ゴミ、プラ、ペットボトル等）: "45L × 3袋/日" "45L × 10袋/週"
- 紙・段ボール類: "10枚/日" "5束/週" "ダンボール3箱/週"
- 家具・家電・什器類: "1台" "3点" "高さ180cm × 幅90cm 1点"
- 重量で表現されている場合: "10kg/週" "5kg/日"
- 容量×個数: "20L × 1缶/週" "18L × 2缶/月"
ユーザーの表現が曖昧（例: 「3袋くらい」「たくさん」「だいたい2つ」）でも、そのまま estimatedQuantity に入れてよい（無理に数値化しない）。
単位や頻度が不明な場合は推測せず、ユーザーの表現を尊重する。

## ユーザーが聞き返してきた場合
「どのくらい出るだろう」「わからない」「見当がつかない」「教えて」などの **質問/不明回答** の場合:
- estimatedQuantity は **埋めない**（patch.items を空にする）
- 予測ヒント（PredictCostModel）があれば、ackText でそれを提案する
  - 例: "ラーメン屋さんですと 45L × 3袋/日 くらいが一般的ですが、近いですか?"
- 予測ヒントが無ければ、ackText で品目に合った例を提示する
  - ゴミ袋類なら「ゴミ袋の大きさと1日あたりの個数で教えてください（例: 45L × 2袋/日）」
  - 段ボール・紙類なら「枚数や束数、または重量で教えてください（例: 10枚/日、5kg/週）」
  - 什器・家電なら「台数や寸法で教えてください（例: 1台、180cm × 90cm 1点）」`,
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
        options: FREQUENCY_CHIPS,
        allowFreeText: true,
      },
    ],
    acceptResponse: (value) => ({
      items: [{ id: item.id, frequency: value as Frequency }],
    }),
    llmHint: `現在聞いているのは品目「${item.label}」の回収頻度です。
items[].id = "${item.id}" の frequency をユーザー入力でそのまま埋めてください。
"週3日" "毎週水曜" "土日のみ" "月末締め" など、ユーザーの表現を文字列でそのまま入れて構いません。`,
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
