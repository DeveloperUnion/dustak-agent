'use client';

import { useState, type ReactNode } from 'react';
import type {
  Slots,
  FlowKind,
  Item,
  ItemProviderAssignment,
  BuildingKind,
  YesNo,
  DischargeMode,
  Frequency,
  ProviderChoice,
  BusinessForm,
  AddressComponents,
  PreferredDate,
} from '@/lib/slots/types';
import { CalendarWidget, type CalendarSelection } from './CalendarWidget';
import { AddressPickerWidget } from './AddressPickerWidget';

interface Props {
  slots: Slots;
  flow: FlowKind;
  onConfirm: () => void;
  onEdit: () => void;
  /** その場で slots に patch を当てる（チャットに戻らず確認画面内で完結）。 */
  onApplyEdit: (mutate: (s: Slots) => Slots) => void;
  /** フォールバック: 該当 step に戻してチャットで聞き直す。 */
  onEditField: (mutate: (s: Slots) => Slots) => void;
}

const FLOW_LABEL: Record<FlowKind, string> = {
  household_spot: '個人スポット',
  business_spot: '事業者スポット',
  business_recurring: '事業者定期回収',
};

const BUILDING_KIND_HOUSEHOLD: BuildingKind[] = [
  '戸建て',
  'マンション・アパート',
  '倉庫',
  'その他',
];
const BUILDING_KIND_BUSINESS: BuildingKind[] = [
  '路面店・独立店舗',
  'ビル内テナント・事務所',
  '商業施設内',
  '工場・倉庫',
  'その他',
];
const FLOOR_OPTIONS = ['1階', '2階', '3階', '4階以上'];
const YES_NO: YesNo[] = ['あり', 'なし'];
const DISCHARGE_MODES: DischargeMode[] = ['自分で排出', '排出を希望'];
const PROVIDERS: ProviderChoice[] = [
  '無料引取',
  '自治体に依頼',
  '訪問買取',
  'ネット買取',
  '民間事業者に依頼',
];
const BUSINESS_FORMS: BusinessForm[] = [
  '個人事業主',
  '株式会社',
  '有限会社',
  'その他法人',
];
const FREQUENCY_COMMON: Frequency[] = ['毎日'];

interface RowProps {
  label: string;
  value?: string;
  /** 編集 UI（インラインテキスト or Enum ボタン or モーダルトリガー） */
  editor?: ReactNode | ((onClose: () => void) => ReactNode);
  /** editor が undefined のとき: 編集不可。表示のみ。 */
}

function Row({ label, value, editor }: RowProps) {
  const [editing, setEditing] = useState(false);
  if (!value && !editor) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] gap-2 text-sm py-1 items-baseline">
      <div className="text-gray-500">{label}</div>
      <div className="break-words">{editing ? null : value || '—'}</div>
      {editor &&
        (editing ? (
          <div className="col-span-2 col-start-2">
            {typeof editor === 'function' ? editor(() => setEditing(false)) : editor}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 hover:underline ml-2"
            >
              閉じる
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
          >
            編集
          </button>
        ))}
    </div>
  );
}

interface TextEditorProps {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
  type?: 'text' | 'tel' | 'email';
}

function TextEditor({ initial, onSave, onCancel, placeholder, type = 'text' }: TextEditorProps) {
  const [v, setV] = useState(initial);
  const save = () => {
    onSave(v.trim());
  };
  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          else if (e.key === 'Escape') onCancel();
        }}
        autoFocus
        placeholder={placeholder}
        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-[var(--line-strong)] bg-white text-[13px] focus:outline-none focus:border-[var(--brand)]"
      />
      <button
        type="button"
        onClick={save}
        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
      >
        保存
      </button>
    </div>
  );
}

interface ChipsEditorProps<T extends string> {
  options: readonly T[];
  current: T | undefined;
  onPick: (v: T) => void;
}

function ChipsEditor<T extends string>({ options, current, onPick }: ChipsEditorProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onPick(opt)}
          className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
            opt === current
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** モーダルラッパー（ピッカー系で使う） */
function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <button
        type="button"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        aria-label="閉じる"
      />
      <div className="relative w-full max-w-[520px] max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center"
          aria-label="閉じる"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function ConfirmationView({ slots, flow, onConfirm, onEdit, onApplyEdit }: Props) {
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

  // ---------- 編集ヘルパー ----------
  const patchLocation = (p: Partial<Slots['location']>) =>
    onApplyEdit((s) => ({ ...s, location: { ...s.location, ...p } }));
  const patchRequester = (p: Partial<Slots['requester']>) =>
    onApplyEdit((s) => ({ ...s, requester: { ...s.requester, ...p } }));
  const patchOccupation = (occupation: string) =>
    onApplyEdit((s) => ({ ...s, occupation }));

  const buildingKinds = flow === 'household_spot' ? BUILDING_KIND_HOUSEHOLD : BUILDING_KIND_BUSINESS;

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

          {/* 住所: モーダルで AddressPickerWidget */}
          <Row
            label="住所"
            value={location.address}
            editor={(onClose) => (
              <Modal onClose={onClose}>
                <div className="text-sm font-medium mb-2">住所を変更</div>
                <AddressPickerWidget
                  part={{ kind: 'widget', widget: 'address_picker' }}
                  onSubmit={(address: string, components?: AddressComponents) => {
                    patchLocation({ address, addressComponents: components });
                    onClose();
                  }}
                />
              </Modal>
            )}
          />

          <Row
            label="店舗名"
            value={location.storeName}
            editor={(onClose) => (
              <TextEditor
                initial={location.storeName ?? ''}
                onSave={(v) => {
                  patchLocation({ storeName: v || undefined });
                  onClose();
                }}
                onCancel={onClose}
              />
            )}
          />

          <Row
            label="建物の種類"
            value={location.buildingKind}
            editor={(onClose) => (
              <ChipsEditor
                options={buildingKinds}
                current={location.buildingKind}
                onPick={(v) => {
                  patchLocation({ buildingKind: v });
                  onClose();
                }}
              />
            )}
          />

          <Row
            label="回収品の階"
            value={location.floor}
            editor={(onClose) => (
              <FloorEditor
                current={location.floor}
                onSave={(v) => {
                  patchLocation({ floor: v });
                  onClose();
                }}
              />
            )}
          />

          <Row
            label="駐車スペース"
            value={location.parking}
            editor={(onClose) => (
              <ChipsEditor
                options={YES_NO}
                current={location.parking}
                onPick={(v) => {
                  patchLocation({ parking: v });
                  onClose();
                }}
              />
            )}
          />

          <Row
            label="エレベーター"
            value={location.elevator}
            editor={(onClose) => (
              <ChipsEditor
                options={YES_NO}
                current={location.elevator}
                onPick={(v) => {
                  patchLocation({ elevator: v });
                  onClose();
                }}
              />
            )}
          />

          <Row
            label="ゴミの排出方法"
            value={location.dischargeMode}
            editor={(onClose) => (
              <ChipsEditor
                options={DISCHARGE_MODES}
                current={location.dischargeMode}
                onPick={(v) => {
                  patchLocation({ dischargeMode: v });
                  onClose();
                }}
              />
            )}
          />

          <Row
            label="備考"
            value={location.note}
            editor={(onClose) => (
              <TextEditor
                initial={location.note ?? ''}
                onSave={(v) => {
                  patchLocation({ note: v || undefined });
                  onClose();
                }}
                onCancel={onClose}
              />
            )}
          />

          {flow !== 'household_spot' && (
            <Row
              label="業態"
              value={slots.occupation}
              editor={(onClose) => (
                <TextEditor
                  initial={slots.occupation ?? ''}
                  onSave={(v) => {
                    if (v) patchOccupation(v);
                    onClose();
                  }}
                  onCancel={onClose}
                  placeholder="例: ラーメン屋"
                />
              )}
            />
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">品目</h3>
          {items.length === 0 && <div className="text-sm text-gray-400">未登録</div>}
          {items.map((it, idx) => {
            const assign = providerAssignments.find((a) => a.itemId === it.id);
            const patchItem = (p: Partial<Item>) =>
              onApplyEdit((s) => ({
                ...s,
                items: s.items.map((i) => (i.id === it.id ? { ...i, ...p } : i)),
              }));
            const patchProvider = (p: Partial<ItemProviderAssignment>) =>
              onApplyEdit((s) => ({
                ...s,
                providerAssignments: s.providerAssignments.map((a) =>
                  a.itemId === it.id ? { ...a, ...p } : a,
                ),
              }));
            return (
              <div key={it.id} className="border-t border-gray-100 py-2 first:border-t-0">
                <div className="text-sm font-medium">
                  {idx + 1}. {it.label}
                </div>
                <Row label="産廃分類" value={it.industrialCategory} />
                <Row
                  label="予想数量"
                  value={it.estimatedQuantity}
                  editor={(onClose) => (
                    <TextEditor
                      initial={it.estimatedQuantity ?? ''}
                      onSave={(v) => {
                        patchItem({ estimatedQuantity: v || undefined });
                        onClose();
                      }}
                      onCancel={onClose}
                      placeholder="例: 45L × 3袋/日"
                    />
                  )}
                />
                <Row
                  label="メーカー"
                  value={it.manufacturer}
                  editor={(onClose) => (
                    <TextEditor
                      initial={it.manufacturer ?? ''}
                      onSave={(v) => {
                        patchItem({ manufacturer: v || undefined });
                        onClose();
                      }}
                      onCancel={onClose}
                      placeholder="例: Panasonic"
                    />
                  )}
                />
                <Row
                  label="年式"
                  value={it.yearOfManufacture}
                  editor={(onClose) => (
                    <TextEditor
                      initial={it.yearOfManufacture ?? ''}
                      onSave={(v) => {
                        patchItem({ yearOfManufacture: v || undefined });
                        onClose();
                      }}
                      onCancel={onClose}
                      placeholder="例: 2020"
                    />
                  )}
                />
                <Row
                  label="容量"
                  value={it.capacity}
                  editor={(onClose) => (
                    <TextEditor
                      initial={it.capacity ?? ''}
                      onSave={(v) => {
                        patchItem({ capacity: v || undefined });
                        onClose();
                      }}
                      onCancel={onClose}
                      placeholder="例: 300L / 8kg / 6畳"
                    />
                  )}
                />
                {flow === 'business_recurring' && (
                  <>
                    <Row
                      label="回収頻度"
                      value={it.frequency}
                      editor={(onClose) => (
                        <FrequencyEditor
                          current={it.frequency}
                          onSave={(v) => {
                            patchItem({ frequency: v });
                            onClose();
                          }}
                        />
                      )}
                    />
                    <Row
                      label="希望開始日"
                      value={it.startDate}
                      editor={(onClose) => (
                        <TextEditor
                          initial={it.startDate ?? ''}
                          type="text"
                          onSave={(v) => {
                            patchItem({ startDate: v || undefined });
                            onClose();
                          }}
                          onCancel={onClose}
                          placeholder="YYYY-MM-DD"
                        />
                      )}
                    />
                  </>
                )}
                <Row
                  label="依頼先"
                  value={assign?.provider}
                  editor={(onClose) => (
                    <ChipsEditor
                      options={PROVIDERS}
                      current={assign?.provider}
                      onPick={(v) => {
                        patchProvider({ provider: v, preferredDates: undefined });
                        onClose();
                      }}
                    />
                  )}
                />
                <Row
                  label="希望回収日時"
                  value={
                    assign?.preferredDates && assign.preferredDates.length > 0
                      ? assign.preferredDates.map((d) => `${d.date} ${d.timeSlot}`).join(' / ')
                      : undefined
                  }
                  editor={
                    assign?.provider === '民間事業者に依頼'
                      ? (onClose) => (
                          <Modal onClose={onClose}>
                            <div className="text-sm font-medium mb-2">希望回収日時を変更</div>
                            <CalendarWidget
                              part={{
                                kind: 'widget',
                                widget: 'calendar',
                                mode: 'multi',
                                maxSelections: 3,
                              }}
                              onSubmit={(sels: CalendarSelection[]) => {
                                const preferredDates: PreferredDate[] = sels.map((s) => ({
                                  date: s.date,
                                  timeSlot: s.timeSlot,
                                }));
                                patchProvider({ preferredDates });
                                onClose();
                              }}
                              onCancel={onClose}
                            />
                          </Modal>
                        )
                      : undefined
                  }
                />
              </div>
            );
          })}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">申込者情報</h3>

          {flow !== 'household_spot' && (
            <>
              <Row
                label="業態"
                value={requester.businessForm}
                editor={(onClose) => (
                  <ChipsEditor
                    options={BUSINESS_FORMS}
                    current={requester.businessForm}
                    onPick={(v) => {
                      patchRequester({ businessForm: v });
                      onClose();
                    }}
                  />
                )}
              />
              <Row
                label="屋号"
                value={requester.storeName}
                editor={(onClose) => (
                  <TextEditor
                    initial={requester.storeName ?? ''}
                    onSave={(v) => {
                      patchRequester({ storeName: v || undefined });
                      onClose();
                    }}
                    onCancel={onClose}
                  />
                )}
              />
            </>
          )}

          <Row
            label="連絡先氏名"
            value={requester.contactName}
            editor={(onClose) => (
              <TextEditor
                initial={requester.contactName ?? ''}
                onSave={(v) => {
                  patchRequester({ contactName: v || undefined });
                  onClose();
                }}
                onCancel={onClose}
              />
            )}
          />
          <Row
            label="連絡先(かな)"
            value={requester.contactNameKana}
            editor={(onClose) => (
              <TextEditor
                initial={requester.contactNameKana ?? ''}
                onSave={(v) => {
                  patchRequester({ contactNameKana: v || undefined });
                  onClose();
                }}
                onCancel={onClose}
              />
            )}
          />
          <Row
            label="電話番号"
            value={requester.phone}
            editor={(onClose) => (
              <TextEditor
                initial={requester.phone ?? ''}
                type="tel"
                onSave={(v) => {
                  patchRequester({ phone: v || undefined });
                  onClose();
                }}
                onCancel={onClose}
                placeholder="09012345678"
              />
            )}
          />
          <Row
            label="メールアドレス"
            value={requester.email}
            editor={(onClose) => (
              <TextEditor
                initial={requester.email ?? ''}
                type="email"
                onSave={(v) => {
                  patchRequester({ email: v || undefined });
                  onClose();
                }}
                onCancel={onClose}
              />
            )}
          />
        </section>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            title="チャットで自由に修正・追加できます"
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

/** 階の編集: 既定の選択肢 + 自由入力 */
function FloorEditor({ current, onSave }: { current?: string; onSave: (v: string) => void }) {
  const [custom, setCustom] = useState('');
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1.5">
        {FLOOR_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSave(opt)}
            className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
              opt === current
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="自由入力（例: 地下1階）"
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-[var(--line-strong)] bg-white text-[13px] focus:outline-none focus:border-[var(--brand)]"
        />
        <button
          type="button"
          disabled={!custom.trim()}
          onClick={() => onSave(custom.trim())}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          保存
        </button>
      </div>
    </div>
  );
}

/** 頻度の編集: よく使うもの + 自由入力 */
function FrequencyEditor({ current, onSave }: { current?: Frequency; onSave: (v: Frequency) => void }) {
  const [custom, setCustom] = useState('');
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1.5">
        {FREQUENCY_COMMON.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSave(opt)}
            className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
              opt === current
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="自由入力（例: 週3日、毎週月曜、毎月第3月曜）"
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-[var(--line-strong)] bg-white text-[13px] focus:outline-none focus:border-[var(--brand)]"
        />
        <button
          type="button"
          disabled={!custom.trim()}
          onClick={() => onSave(custom.trim() as Frequency)}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          保存
        </button>
      </div>
    </div>
  );
}
