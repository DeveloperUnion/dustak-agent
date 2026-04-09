'use client';

import { useState } from 'react';
import type { Slots, FlowKind } from '@/lib/slots/types';

interface Props {
  slots: Slots;
  flow: FlowKind;
  onConfirm: () => void;
  onEdit: () => void;
}

const FLOW_LABEL: Record<FlowKind, string> = {
  household_spot: '個人スポット',
  business_spot: '事業者スポット',
  business_recurring: '事業者定期回収',
};

function row(label: string, value?: string) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm py-1">
      <div className="text-gray-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}

export function ConfirmationView({ slots, flow, onConfirm, onEdit }: Props) {
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
          {row('住所', location.address)}
          {row('店舗名', location.storeName)}
          {row('建物の種類', location.buildingKind)}
          {row('駐車スペース', location.parking)}
          {row('エレベーター', location.elevator)}
          {row('ゴミの排出方法', location.dischargeMode)}
          {row('備考', location.note)}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">品目</h3>
          {items.length === 0 && <div className="text-sm text-gray-400">未登録</div>}
          {items.map((it, idx) => {
            const assign = providerAssignments.find((a) => a.itemId === it.id);
            return (
              <div key={it.id} className="border-t border-gray-100 py-2 first:border-t-0">
                <div className="text-sm font-medium">
                  {idx + 1}. {it.label}
                </div>
                {row('産廃分類', it.industrialCategory)}
                {row('予想数量', it.estimatedQuantity)}
                {row('回収頻度', it.frequency)}
                {row('希望開始日', it.startDate)}
                {row('依頼先', assign?.provider)}
                {assign?.preferredDates && assign.preferredDates.length > 0 && (
                  <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm py-1">
                    <div className="text-gray-500">希望回収日時</div>
                    <div>
                      {assign.preferredDates.map((d) => `${d.date} ${d.timeSlot}`).join(' / ')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">申込者情報</h3>
          {row('業態', requester.businessForm)}
          {row('屋号', requester.storeName)}
          {row('事業者氏名', requester.businessName)}
          {row('事業者氏名(かな)', requester.businessNameKana)}
          {row('連絡先氏名', requester.contactName)}
          {row('連絡先(かな)', requester.contactNameKana)}
          {row('電話番号', requester.phone)}
          {row('メールアドレス', requester.email)}
        </section>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
          >
            修正する
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
