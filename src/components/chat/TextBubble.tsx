interface Props {
  role: 'user' | 'assistant';
  text: string;
  createdAt?: number;
  /** 同じ送信者の連続バブルの先頭か（ラベルの表示制御に使用） */
  showTail?: boolean;
}

function fmtTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function TextBubble({ role, text, createdAt, showTail = true }: Props) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className={`flex justify-end px-5 ${showTail ? 'mt-4' : 'mt-1'}`}>
        <div className="max-w-[78%] dustalk-rise">
          {showTail && (
            <div className="eyebrow text-right mb-1.5 mr-1">あなた</div>
          )}
          <div className="rounded-[14px] rounded-tr-[4px] bg-[var(--brand)] text-[var(--paper)] px-4 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(11,30,74,0.55)]">
            <div className="text-[14.5px] leading-[1.65] whitespace-pre-wrap font-light">
              {text}
            </div>
            {createdAt !== undefined && (
              <div className="flex justify-end mt-1">
                <span className="text-[10px] tracking-wider text-[var(--brand-soft)]/80 uppercase">
                  {fmtTime(createdAt)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className={`flex justify-start px-5 ${showTail ? 'mt-4' : 'mt-1'}`}>
      <div className="max-w-[80%] dustalk-rise">
        {showTail && (
          <div className="flex items-center gap-2 mb-1.5 ml-1">
            <span className="w-1 h-1 rounded-full bg-[var(--brand)]" />
            <span className="eyebrow">DUSTALK</span>
          </div>
        )}
        <div className="relative bg-[var(--surface)] rounded-[14px] rounded-tl-[4px] px-4 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_2px_18px_-8px_rgba(11,30,74,0.18)] border border-[var(--line)]">
          {/* 細い群青の左罫 */}
          <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[var(--brand)]/85" />
          <div className="text-[14.5px] leading-[1.7] text-[var(--ink)] whitespace-pre-wrap pl-1.5">
            {text}
          </div>
          {createdAt !== undefined && (
            <div className="flex justify-end mt-1">
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
