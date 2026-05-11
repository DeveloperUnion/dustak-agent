'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** 「ご用件を変更する」メニュー項目から呼ばれる。会話を初期状態に戻し挨拶からやり直す。 */
  onResetSession: () => void;
}

export function ChatHeader({ title, subtitle, onBack, onResetSession }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外側クリック or Escape で閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="relative bg-white/90 backdrop-blur-md border-b border-[var(--line)]">
      {/* 上部のヘアライン装飾 */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--ink)]/25 to-transparent" />

      <div className="px-5 py-3.5 flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="group p-1.5 -ml-1.5 rounded-full text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--ink)]/5 transition-colors"
          title="戻る"
        >
          <svg
            className="w-[18px] h-[18px] transition-transform group-hover:-translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* ロゴ */}
        <div className="relative">
          <div className="w-11 h-11 rounded-full bg-[var(--paper)] ring-1 ring-[var(--ink)]/15 flex items-center justify-center overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_8px_-3px_rgba(11,30,74,0.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dustalk-logo.png"
              alt="DUSTALK"
              className="w-[38px] h-[38px] object-contain"
            />
          </div>
          {/* オンラインステータス */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--brand)] ring-2 ring-white dustalk-status" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="eyebrow mb-0.5">DUSTALK · AI AGENT</div>
          <h1 className="font-mincho text-[19px] leading-[1.15] text-[var(--ink)] truncate font-medium">
            {title}
          </h1>
          {subtitle && (
            <div className="text-[11.5px] text-[var(--ink-soft)] truncate mt-0.5 tracking-wide">
              {subtitle}
            </div>
          )}
        </div>

        {/* 右側 — メニュー（ご用件を変更する など） */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-full text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--ink)]/5 transition-colors"
            title="メニュー"
            aria-label="menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.1" fill="currentColor" />
              <circle cx="12" cy="12" r="1.1" fill="currentColor" />
              <circle cx="12" cy="19" r="1.1" fill="currentColor" />
            </svg>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 min-w-[180px] bg-white border border-[var(--line)] rounded-[10px] shadow-[0_8px_28px_-10px_rgba(11,30,74,0.35)] py-1 z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onResetSession();
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2"
              >
                <svg className="w-[14px] h-[14px] text-[var(--ink-soft)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
                ご用件を変更する
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 下部のオーナメント罫 */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--ink)]/12 to-transparent" />
    </header>
  );
}
