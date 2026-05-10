'use client';

import { useState } from 'react';
import type { Slots, FlowKind, Item, ItemProviderAssignment } from '@/lib/slots/types';

interface Props {
  slots: Slots;
  flow: FlowKind;
  onConfirm: () => void;
  onEdit: () => void;
  /** 行ごとの「編集」ボタン押下時に呼ばれる。slots を mutate で書き換えて該当 step に戻す。 */
  onEditField: (mutate: (s: Slots) => Slots) => void;
}

const FLOW_LABEL: Record<FlowKind, string> = {
  household_spot: '個人スポット',
  business_spot: '事業者スポット',
  business_recurring: '事業者定期回収',
};

function row(label: string, value?: string, onEdit?: () => void) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] gap-2 text-sm py-1 items-baseline">
      <div className="text-gray-500">{label}</div>
      <div className="break-words">{value}</div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
        >
          編集
        </button>
      )}
    </div>
  );
}

export function ConfirmationView({ slots, flow, onConfirm, onEdit, onEditField }: Props) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="text-2xl">✅</div>
          <div className="text-lg font-medium">ありがとうございました</div>
          <div className="text-sm text-gray-500">
            申し込み内容を確認しました。担当者から折り返しご連絡いたします。
          </div>
        </div>
      </div>
    );
  }

  const { location, items, providerAssignments, requester } = slots;

  const editLocation = (patch: Partial<Slots['location']>) =>
    onEditField((s) => ({ ...s, location: { ...s.location, ...patch } }));
  const editRequester = (patch: Partial<Slots['requester']>) =>
    onEditField((s) => ({ ...s, requester: { ...s.requester, ...patch } }));
  const editOccupation = () =>
    onEditField((s) => ({ ...s, occupation: undefined }));

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        <div>
          <div className="text-xs text-gray-500">申込種別</div>
          <div className="text-base font-medium">{FLOW_LABEL[flow]}</div>
        </div>
        <div className="text-base font-medium">以下の内容で申し込みますか?</div>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">回収・排出場所</h3>
          {row('住所', location.address, () =>
            editLocation({ address: undefined, addressComponents: undefined }),
          )}
          {row('店舗名', location.storeName, () => editLocation({ storeName: undefined }))}
          {row('建物の種類', location.buildingKind, () =>
            editLocation({ buildingKind: undefined }),
          )}
          {row('回収品の階', location.floor, () => editLocation({ floor: undefined }))}
          {row('駐車スペース', location.parking, () => editLocation({ parking: undefined }))}
          {row('エレベーター', location.elevator, () => editLocation({ elevator: undefined }))}
          {row('ゴミの排出方法', location.dischargeMode, () =>
            editLocation({ dischargeMode: undefined }),
          )}
          {row('備考', location.note, () => editLocation({ note: undefined }))}
          {flow !== 'household_spot' &&
            row('業態', slots.occupation, editOccupation)}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">品目</h3>
          {items.length === 0 && <div className="text-sm text-gray-400">未登録</div>}
          {items.map((it, idx) => {
            const assign = providerAssignments.find((a) => a.itemId === it.id);
            const editItem = (patch: Partial<Item>) =>
              onEditField((s) => ({
                ...s,
                items: s.items.map((i) => (i.id === it.id ? { ...i, ...patch } : i)),
              }));
            const editProvider = (patch: Partial<ItemProviderAssignment>) =>
              onEditField((s) => ({
                ...s,
                providerAssignments: s.providerAssignments.map((a) =>
                  a.itemId === it.id ? { ...a, ...patch } : a,
                ),
              }));
            return (
              <div key={it.id} className="border-t border-gray-100 py-2 first:border-t-0">
                <div className="text-sm font-medium">
                  {idx + 1}. {it.label}
                </div>
                {row('産廃分類', it.industrialCategory)}
                {row('予想数量', it.estimatedQuantity, () =>
                  editItem({ estimatedQuantity: undefined }),
                )}
                {row('回収頻度', it.frequency, () => editItem({ frequency: undefined }))}
                {row('希望開始日', it.startDate, () => editItem({ startDate: undefined }))}
                {row('依頼先', assign?.provider, () =>
                  editProvider({ provider: undefined, preferredDates: undefined }),
                )}
                {assign?.preferredDates && assign.preferredDates.length > 0 && (
                  <div className="grid grid-cols-[7rem_1fr_auto] gap-2 text-sm py-1 items-baseline">
                    <div className="text-gray-500">希望回収日時</div>
                    <div className="break-words">
                      {assign.preferredDates.map((d) => `${d.date} ${d.timeSlot}`).join(' / ')}
                    </div>
                    <button
                      type="button"
                      onClick={() => editProvider({ preferredDates: undefined })}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                    >
                      編集
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">申込者情報</h3>
          {row('業態', requester.businessForm, () =>
            editRequester({ businessForm: undefined }),
          )}
          {row('屋号', requester.storeName, () => editRequester({ storeName: undefined }))}
          {row('事業者氏名', requester.businessName, () =>
            editRequester({ businessName: undefined }),
          )}
          {row('事業者氏名(かな)', requester.businessNameKana, () =>
            editRequester({ businessNameKana: undefined }),
          )}
          {row('連絡先氏名', requester.contactName, () =>
            editRequester({ contactName: undefined }),
          )}
          {row('連絡先(かな)', requester.contactNameKana, () =>
            editRequester({ contactNameKana: undefined }),
          )}
          {row('電話番号', requester.phone, () => editRequester({ phone: undefined }))}
          {row('メールアドレス', requester.email, () => editRequester({ email: undefined }))}
        </section>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            title="チャットに戻って自由に修正・追加できます"
          >
            チャットに戻る
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitted(true);
              onConfirm();
            }}
            className="flex-1 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium"
          >
            申し込む
          </button>
        </div>
      </div>
    </div>
  );
}
