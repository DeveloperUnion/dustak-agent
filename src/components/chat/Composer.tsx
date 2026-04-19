'use client';

import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSendText: (text: string) => void;
  onSendImageDetection: (detectedNames: string[]) => void;
  disabled?: boolean;
}

const IMAGE_PICKER_ORIGIN = 'https://identify-garbage.onrender.com';

export function Composer({ onSendText, onSendImageDetection, disabled }: Props) {
  const [value, setValue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSendText(trimmed);
    setValue('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // IME 変換確定の Enter は送信にしない（Safari/Chrome/Firefox 共通で isComposing=true、古いブラウザは keyCode=229）
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  };

  const openImagePicker = () => {
    if (disabled || pickerOpen) return;
    setPickerError(null);

    const origin = window.location.origin;
    const url = `${IMAGE_PICKER_ORIGIN}/?return=postMessage&origin=${encodeURIComponent(origin)}`;
    const popup = window.open(
      url,
      'dustalk-image-picker',
      'width=480,height=820,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!popup) {
      setPickerError('ポップアップがブロックされました。ブラウザの設定を確認してください。');
      return;
    }

    setPickerOpen(true);

    const handler = (e: MessageEvent) => {
      if (e.origin !== IMAGE_PICKER_ORIGIN) return;
      const data = e.data as { type?: string; names?: unknown };
      if (data?.type !== 'dustalk:items') return;

      const names = Array.isArray(data.names)
        ? data.names.filter((n): n is string => typeof n === 'string' && n.length > 0)
        : [];

      cleanup();
      if (names.length > 0) {
        onSendImageDetection(names);
      } else {
        setPickerError('品目が選択されませんでした');
      }
    };

    const pollClosed = window.setInterval(() => {
      if (popup.closed) cleanup();
    }, 500);

    const cleanup = () => {
      window.removeEventListener('message', handler);
      window.clearInterval(pollClosed);
      setPickerOpen(false);
      try {
        if (!popup.closed) popup.close();
      } catch {
        /* noop */
      }
    };

    window.addEventListener('message', handler);
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="relative bg-white/90 backdrop-blur-md border-t border-[var(--line)]">
      {/* 上部のヘアライン光 */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/15 to-transparent" />

      <div className="px-5 pt-3 pb-4">
        {pickerError && (
          <div className="mb-2 text-[11px] text-[var(--brand)] bg-[var(--brand-pale)] border border-[var(--brand-soft)]/60 rounded-md px-3 py-1.5">
            {pickerError}
          </div>
        )}

        <div className="flex gap-2.5 items-end">
          {/* 入力ピル */}
          <div
            className={`flex-1 flex items-end gap-2 bg-[var(--surface)] rounded-[22px] pl-3 pr-2 py-2 border transition-all duration-200 ${
              focused
                ? 'border-[var(--brand)] shadow-[0_4px_24px_-8px_rgba(11,30,74,0.28)]'
                : 'border-[var(--line-strong)] shadow-[0_2px_14px_-10px_rgba(11,30,74,0.35)]'
            }`}
          >
            <button
              type="button"
              onClick={openImagePicker}
              disabled={disabled || pickerOpen}
              title="品目の写真をアップロード"
              className="text-[var(--ink-soft)] hover:text-[var(--brand)] disabled:text-[var(--ink-mute)]/40 transition-colors mb-1.5"
            >
              {pickerOpen ? (
                <svg className="w-[18px] h-[18px] animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" strokeDasharray="40 20" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="13" rx="2" />
                  <circle cx="12" cy="12.5" r="3.2" />
                  <path d="M8 6l1.4-2h5.2L16 6" />
                </svg>
              )}
            </button>

            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={disabled}
              rows={1}
              placeholder="メッセージを入力…"
              className="flex-1 resize-none bg-transparent text-[14.5px] leading-[22px] py-1 text-[var(--text)] placeholder:text-[var(--ink-mute)] focus:outline-none disabled:text-[var(--ink-mute)] max-h-36 font-light"
            />
          </div>

          {/* 送信ボタン */}
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !hasText}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
              hasText && !disabled
                ? 'bg-[var(--brand)] text-[var(--paper)] shadow-[0_6px_20px_-6px_rgba(11,30,74,0.6)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(11,30,74,0.7)]'
                : 'bg-[var(--ivory-deep)] text-[var(--ink-mute)] cursor-not-allowed'
            }`}
            title="送信"
          >
            <svg className="w-[18px] h-[18px] -translate-x-px translate-y-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l16-8-6 16-3-7-7-1z" />
            </svg>
          </button>
        </div>

        {/* フットラベル */}
        <div className="mt-2.5 text-center">
          <span className="text-[9.5px] tracking-[0.24em] uppercase text-[var(--ink-mute)]">
            Powered by Dustalk · お問い合わせは丁寧に
          </span>
        </div>
      </div>
    </div>
  );
}
