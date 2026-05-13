'use client';

import { useState } from 'react';
import type { GroupedProviderPickWidgetPart } from '@/types/messages';

export interface GroupedProviderPickResult {
  itemIds: string[];
  provider: string;
}

interface Props {
  part: GroupedProviderPickWidgetPart;
  onSubmit: (result: GroupedProviderPickResult, displayLabel: string) => void;
  disabled?: boolean;
  createdAt?: number;
  showTail?: boolean;
}

function fmtTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function GroupedProviderPickWidget({
  part,
  onSubmit,
  disabled,
  createdAt,
  showTail = true,
}: Props) {
  // 初期状態は全選択
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(part.items.map((i) => i.id)),
  );
  const [provider, setProvider] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const toggleItem = (id: string) => {
    if (disabled || closed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (disabled || closed) return;
    setSelected(new Set(part.items.map((i) => i.id)));
  };

  const deselectAll = () => {
    if (disabled || closed) return;
    setSelected(new Set());
  };

  const disabledMap = new Map(
    (part.disabledProviders ?? []).map((d) => [d.provider, d.reason]),
  );

  const submit = () => {
    if (disabled || closed) return;
    if (selected.size === 0 || !provider) return;
    const itemIds = Array.from(selected);
    const pickedLabels = part.items.filter((i) => selected.has(i.id)).map((i) => i.label);
    const label = `${pickedLabels.join(' / ')} → ${provider}`;
    setClosed(true);
    onSubmit({ itemIds, provider }, label);
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
            <div className="text-[14.5px] leading-[1.7] text-[var(--text)] mb-2.5 pl-1.5">
              {part.prompt}
            </div>
          )}

          {/* 品目チェックボックスリスト */}
          <div className="pl-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[var(--ink-mute)] tracking-wide">同じ方法で出す品目</span>
              <div className="flex gap-2 text-[11px] text-[var(--brand)]">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={disabled || closed}
                  className="hover:underline disabled:opacity-40"
                >
                  全選択
                </button>
                <span className="text-[var(--ink-mute)]">/</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  disabled={disabled || closed}
                  className="hover:underline disabled:opacity-40"
                >
                  全解除
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {part.items.map((it) => {
                const isSelected = selected.has(it.id);
                const isDisabled = disabled || closed;
                return (
                  <button
                    key={it.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleItem(it.id)}
                    className={`group w-full flex items-center gap-3 px-3.5 py-2 rounded-[10px] border text-left transition-all duration-150 ${
                      isSelected
                        ? 'bg-[var(--brand)]/[0.04] border-[var(--brand)] text-[var(--brand)]'
                        : isDisabled
                          ? 'bg-[var(--ivory-deep)]/30 text-[var(--ink-mute)] border-[var(--line)] cursor-not-allowed'
                          : 'bg-[var(--paper)] text-[var(--text)] border-[var(--line-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand)]/[0.03] cursor-pointer'
                    }`}
                  >
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
                    <span className="flex-1 text-[13.5px] leading-[1.5] tracking-wide">
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider chips */}
          <div className="mt-3 pl-1.5">
            <div className="text-[12px] text-[var(--ink-mute)] tracking-wide mb-1.5">回収方法</div>
            <div className="flex flex-wrap gap-1.5">
              {part.providers.map((p) => {
                const isPicked = p === provider;
                const reason = disabledMap.get(p);
                const isDisabled = disabled || closed || reason !== undefined;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={isDisabled}
                    title={reason}
                    onClick={() => setProvider(p)}
                    className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                      isPicked
                        ? 'bg-[var(--brand)] border-[var(--brand)] text-white'
                        : isDisabled
                          ? 'bg-[var(--ivory-deep)]/30 text-[var(--ink-mute)] border-[var(--line)] cursor-not-allowed'
                          : 'bg-[var(--paper)] text-[var(--text)] border-[var(--line-strong)] hover:border-[var(--brand)]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pl-1.5">
            <button
              type="button"
              onClick={submit}
              disabled={disabled || closed || selected.size === 0 || !provider}
              className="px-5 py-1.5 rounded-full text-[12px] tracking-[0.18em] uppercase bg-[var(--brand)] text-white disabled:bg-[var(--ink-mute)]/40 disabled:cursor-not-allowed transition-all"
            >
              この方法で確定
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
