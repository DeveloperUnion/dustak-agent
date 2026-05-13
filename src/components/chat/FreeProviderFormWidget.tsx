'use client';

import { useState } from 'react';
import type { FreeProviderFormWidgetPart } from '@/types/messages';

export interface FreeProviderFormResult {
  action: 'confirm' | 'cancel';
  manufacturer?: string;
  yearOfManufacture?: string;
  capacity?: string;
}

interface Props {
  part: FreeProviderFormWidgetPart;
  onSubmit: (result: FreeProviderFormResult, displayLabel: string) => void;
  disabled?: boolean;
  createdAt?: number;
  showTail?: boolean;
}

function fmtTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function FreeProviderFormWidget({
  part,
  onSubmit,
  disabled,
  createdAt,
  showTail = true,
}: Props) {
  const [manufacturer, setManufacturer] = useState(part.defaults?.manufacturer ?? '');
  const [year, setYear] = useState(part.defaults?.yearOfManufacture ?? '');
  const [capacity, setCapacity] = useState(part.defaults?.capacity ?? '');
  const [closed, setClosed] = useState(false);

  const confirm = () => {
    if (disabled || closed) return;
    const result: FreeProviderFormResult = {
      action: 'confirm',
      manufacturer: manufacturer.trim() || undefined,
      yearOfManufacture: year.trim() || undefined,
      capacity: capacity.trim() || undefined,
    };
    const label = `「${part.itemLabel}」を無料引取で確定`;
    setClosed(true);
    onSubmit(result, label);
  };

  const cancel = () => {
    if (disabled || closed) return;
    const result: FreeProviderFormResult = {
      action: 'cancel',
      manufacturer: manufacturer.trim() || undefined,
      yearOfManufacture: year.trim() || undefined,
      capacity: capacity.trim() || undefined,
    };
    const label = `「${part.itemLabel}」は他の方法で出す`;
    setClosed(true);
    onSubmit(result, label);
  };

  return (
    <div className={`flex justify-start px-5 ${showTail ? 'mt-4' : 'mt-1'}`}>
      <div className={`w-full max-w-[440px] dustalk-rise ${closed ? 'opacity-50' : ''}`}>
        {showTail && (
          <div className="flex items-center gap-2 mb-1.5 ml-1">
            <span className="w-1 h-1 rounded-full bg-[var(--brand)]" />
            <span className="eyebrow">DUSTALK</span>
          </div>
        )}
        <div className="relative bg-[var(--surface)] rounded-[14px] rounded-tl-[4px] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_2px_18px_-8px_rgba(11,30,74,0.18)] border border-[var(--line)]">
          <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[var(--brand)]/85" />

          {part.prompt && (
            <div className="text-[14.5px] leading-[1.7] text-[var(--text)] mb-3 pl-1.5">
              {part.prompt}
            </div>
          )}

          <div className="pl-1.5 space-y-2.5">
            <Field
              label="メーカー"
              value={manufacturer}
              onChange={setManufacturer}
              disabled={disabled || closed}
              placeholder="例: Panasonic"
            />
            <Field
              label="年式"
              value={year}
              onChange={setYear}
              disabled={disabled || closed}
              placeholder="例: 2020"
            />
            <Field
              label="容量"
              value={capacity}
              onChange={setCapacity}
              disabled={disabled || closed}
              placeholder="例: 300L / 8kg / 6畳"
            />
          </div>

          <div className="mt-3.5 pl-1.5 flex flex-col gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={disabled || closed}
              className="w-full px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13.5px] tracking-wide font-medium disabled:bg-[var(--ink-mute)]/40 disabled:cursor-not-allowed transition-all hover:brightness-110"
            >
              無料で引き取り依頼する
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={disabled || closed}
              className="w-full px-4 py-2 rounded-[10px] border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink-soft)] text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
            >
              他の方法で出す（無料引取をキャンセル）
            </button>
          </div>

          {createdAt !== undefined && (
            <div className="flex justify-end mt-2">
              <span className="text-[10px] tracking-wider text-[var(--ink-mute)] uppercase">
                {fmtTime(createdAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2 items-center">
      <label className="text-[12px] text-[var(--ink-mute)] tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-w-0 px-3 py-1.5 rounded-[8px] border border-[var(--line-strong)] bg-[var(--paper)] text-[13px] text-[var(--text)] placeholder:text-[var(--ink-mute)] focus:outline-none focus:border-[var(--brand)] disabled:bg-[var(--ivory-deep)]/30 transition-colors"
      />
    </div>
  );
}
