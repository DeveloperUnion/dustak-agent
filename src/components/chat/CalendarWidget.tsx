'use client';

import { useState } from 'react';
import type { CalendarWidgetPart } from '@/types/messages';

export const TIME_SLOTS = ['希望なし', '9-12時', '12-15時', '15-18時'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export interface CalendarSelection {
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
}

interface Props {
  part: CalendarWidgetPart;
  onSubmit: (selections: CalendarSelection[]) => void;
  onCancel: () => void;
  disabled?: boolean;
  createdAt?: number;
  showTail?: boolean;
}

type Selection = CalendarSelection;

function fmtTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function CalendarWidget({
  part,
  onSubmit,
  onCancel,
  disabled,
  createdAt,
  showTail = true,
}: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selections, setSelections] = useState<Selection[]>([]);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<TimeSlot>('希望なし');
  const [closed, setClosed] = useState(false);

  const isMulti = part.mode === 'multi';
  const max = part.maxSelections ?? (isMulti ? 3 : 1);

  const today = ymd(new Date());

  const monthLabel = `${cursor.getFullYear()}年 ${cursor.getMonth() + 1}月`;
  const firstDow = startOfMonth(cursor).getDay();
  const total = daysInMonth(cursor);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push(ymd(date));
  }

  const pickDate = (date: string) => {
    if (disabled || closed) return;
    if (date < today) return;
    setPendingDate(date);
    setPendingSlot('希望なし');
  };

  const confirmCurrent = () => {
    if (!pendingDate) return;
    const newSel: Selection = { date: pendingDate, timeSlot: pendingSlot };
    if (isMulti) {
      setSelections((prev) => {
        const next = prev.filter((s) => s.date !== newSel.date);
        next.push(newSel);
        return next.slice(0, max);
      });
      setPendingDate(null);
    } else {
      finalize([newSel]);
    }
  };

  const finalize = (sel: Selection[]) => {
    if (sel.length === 0) return;
    setClosed(true);
    onSubmit(sel);
  };

  const cancel = () => {
    setClosed(true);
    onCancel();
  };

  return (
    <div className={`flex justify-start ${showTail ? 'mt-1.5' : 'mt-0.5'} px-2`}>
      <div
        className={`wa-bubble ${showTail ? 'wa-bubble-in' : ''} bg-[var(--wa-bubble-in)] w-full max-w-sm rounded-lg p-3 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          closed ? 'opacity-50' : ''
        }`}
        style={{ borderTopLeftRadius: showTail ? 0 : undefined }}
      >
        {part.prompt && (
          <div className="text-sm text-gray-700 mb-2">{part.prompt}</div>
        )}
        {/* 月送り */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            disabled={closed || disabled}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
          >
            ＜
          </button>
          <div className="text-sm font-medium">{monthLabel}</div>
          <button
            type="button"
            disabled={closed || disabled}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
          >
            ＞
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
          {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-3">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const isPast = date < today;
            const isPending = date === pendingDate;
            const isSelected = selections.some((s) => s.date === date);
            return (
              <button
                key={i}
                type="button"
                disabled={isPast || closed || disabled}
                onClick={() => pickDate(date)}
                className={`aspect-square text-xs rounded ${
                  isPending
                    ? 'bg-[var(--wa-header)] text-white'
                    : isSelected
                      ? 'bg-emerald-100 text-emerald-900'
                      : isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-100'
                }`}
              >
                {Number(date.split('-')[2])}
              </button>
            );
          })}
        </div>

        {/* 時間帯 */}
        {pendingDate && (
          <>
            <div className="text-xs text-gray-500 mb-1">時間帯</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TIME_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPendingSlot(s)}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    pendingSlot === s
                      ? 'bg-[var(--wa-header)] text-white border-[var(--wa-header)]'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {/* 既選択（multi のみ表示） */}
        {isMulti && selections.length > 0 && (
          <div className="text-xs text-gray-600 mb-2">
            選択中: {selections.map((s) => `${s.date} ${s.timeSlot}`).join(', ')}
          </div>
        )}

        {/* アクション */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={closed || disabled}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            キャンセル
          </button>
          {isMulti ? (
            <>
              <button
                type="button"
                onClick={confirmCurrent}
                disabled={closed || disabled || !pendingDate}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => finalize(selections)}
                disabled={closed || disabled || selections.length === 0}
                className="px-3 py-1 text-sm bg-[var(--wa-header)] text-white rounded disabled:bg-gray-300"
              >
                OK
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={confirmCurrent}
              disabled={closed || disabled || !pendingDate}
              className="px-3 py-1 text-sm bg-[var(--wa-header)] text-white rounded disabled:bg-gray-300"
            >
              OK
            </button>
          )}
        </div>
        <div className="flex justify-end mt-1">
          <span className="text-[11px] text-[var(--wa-meta)] leading-[15px]">
            {fmtTime(createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
