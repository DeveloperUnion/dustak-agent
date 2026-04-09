interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export function ChatHeader({ title, subtitle, onBack }: Props) {
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

        {/* 右側装飾 — メニューアイコン */}
        <button
          type="button"
          className="p-2 rounded-full text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--ink)]/5 transition-colors"
          title="メニュー"
          aria-label="menu"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="5" r="1.1" fill="currentColor" />
            <circle cx="12" cy="12" r="1.1" fill="currentColor" />
            <circle cx="12" cy="19" r="1.1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* 下部のオーナメント罫 */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--ink)]/12 to-transparent" />
    </header>
  );
}
