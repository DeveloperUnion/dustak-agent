'use client';

import { useState } from 'react';
import type { ChipsPart, ChipAction } from '@/types/messages';

interface Props {
  part: ChipsPart;
  /** 単一選択時は label と value、複数選択時は配列 */
  onPick: (value: unknown, displayLabel: string) => void;
  /** action 付きチップ選択時のクライアント側ハンドラ */
  onAction?: (action: ChipAction) => void;
  /** 自由テキスト入力時のコールバック。undefined なら入力欄を非表示。 */
  onFreeText?: (text: string) => void;
  disabled?: boolean;
  createdAt?: number;
  showTail?: boolean;
}

function fmtTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ChipsBubble({ part, onPick, onAction, onFreeText, disabled, createdAt, showTail = true }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState('');
  const isMulti = part.multi === true;

  const toggle = (value: string) => {
    if (disabled) return;
    if (!isMulti) {
      const opt = part.options.find((o) => o.value === value);
      if (!opt) return;
      if (opt.action && onAction) {
        onAction(opt.action);
        return;
      }
      onPick(opt.value, opt.label);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const submitMulti = () => {
    if (disabled || selected.size === 0) return;
    const picked = part.options.filter((o) => selected.has(o.value));
    onPick(
      picked.map((o) => o.value),
      picked.map((o) => o.label).join(' / '),
    );
    setSelected(new Set());
  };

  return (
    <div className={`flex justify-start px-5 ${showTail ? 'mt-4' : 'mt-1'}`}>
      <div className="w-full max-w-[440px] dustalk-rise">
        {showTail && (
          <div className="flex items-center gap-2 mb-1.5 ml-1">
            <span className="w-1 h-1 rounded-full bg-[var(--brand)]" />
            <span className="eyebrow">DUSTALK</span>
          </div>
        )}
        <div className="relative bg-[var(--surface)] rounded-[14px] rounded-tl-[4px] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_2px_18px_-8px_rgba(11,30,74,0.18)] border border-[var(--line)]">
          <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[var(--brand)]/85" />

          {part.prompt && (
            <div className="text-[14.5px] leading-[1.7] text-[var(--text)] mb-2.5 pl-1.5">
              {part.prompt}
            </div>
          )}

          <div className="flex flex-col gap-1.5 pl-1.5">
            {part.options.map((opt) => {
              const isSelected = selected.has(opt.value);
              const isDisabled = disabled || opt.disabled;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isDisabled}
                  title={opt.disabledReason}
                  onClick={() => toggle(opt.value)}
                  className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border text-left transition-all duration-150 ${
                    isSelected
                      ? 'bg-[var(--brand)]/[0.04] border-[var(--brand)] text-[var(--brand)]'
                      : isDisabled
                        ? 'bg-[var(--ivory-deep)]/30 text-[var(--ink-mute)] border-[var(--line)] cursor-not-allowed'
                        : 'bg-[var(--paper)] text-[var(--text)] border-[var(--line-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/[0.03] cursor-pointer'
                  }`}
                >
                  {/* インジケーター */}
                  {isMulti ? (
                    <span
                      className={`flex-shrink-0 w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[var(--brand)] border-[var(--brand)]'
                          : 'bg-[var(--surface)] border-[var(--line-strong)] group-hover:border-[var(--brand)]'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-[10px] h-[10px] text-[var(--paper)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                        </svg>
                      )}
                    </span>
                  ) : (
                    <span
                      className={`flex-shrink-0 w-[16px] h-[16px] rounded-full border flex items-center justify-center transition-colors ${
                        isDisabled
                          ? 'border-[var(--line)]'
                          : 'border-[var(--line-strong)] group-hover:border-[var(--brand)]'
                      }`}
                    >
                      <span className="w-[5px] h-[5px] rounded-full bg-[var(--brand)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  )}

                  {/* ラベル */}
                  <span className="flex-1 text-[13.5px] leading-[1.5] tracking-wide">
                    {opt.label}
                  </span>

                  {/* 単一選択時のみ右矢印 */}
                  {!isMulti && !isDisabled && (
                    <svg className="flex-shrink-0 w-[14px] h-[14px] text-[var(--ink-mute)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {isMulti && (
            <div className="mt-3 pl-1.5">
              <button
                type="button"
                onClick={submitMulti}
                disabled={disabled || selected.size === 0}
                className="px-5 py-1.5 rounded-full text-[12px] tracking-[0.18em] uppercase bg-[var(--brand)] text-white disabled:bg-[var(--ink-mute)]/40 disabled:cursor-not-allowed transition-all hover:bg-[var(--brand)] disabled:hover:bg-[var(--ink-mute)]/40"
              >
                決定
              </button>
            </div>
          )}

          {onFreeText && !disabled && (
            <div className="mt-3 pl-1.5">
              <div className="border-t border-[var(--line)] pt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && freeText.trim()) {
                        onFreeText(freeText.trim());
                        setFreeText('');
                      }
                    }}
                    placeholder="選択肢にない場合はこちらに入力"
                    className="flex-1 min-w-0 px-3 py-2 rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] text-[13px] text-[var(--text)] placeholder:text-[var(--ink-mute)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                  />
                  <button
                    type="button"
                    disabled={!freeText.trim()}
                    onClick={() => {
                      if (freeText.trim()) {
                        onFreeText(freeText.trim());
                        setFreeText('');
                      }
                    }}
                    className="flex-shrink-0 px-4 py-2 rounded-[8px] text-[12px] tracking-[0.1em] bg-[var(--brand)] text-white disabled:bg-[var(--ink-mute)]/40 disabled:cursor-not-allowed transition-all hover:brightness-110"
                  >
                    確定する
                  </button>
                </div>
              </div>
            </div>
          )}

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
