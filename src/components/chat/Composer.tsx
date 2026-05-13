'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';

export interface DetectedItemInput {
  name: string;
  info?: string;
}

interface Props {
  onSendText: (text: string) => void;
  onSendImageDetection: (detectedItems: DetectedItemInput[]) => void;
  disabled?: boolean;
  pickerOpen: boolean;
  pickerError: string | null;
  pickerLoaded: boolean;
  openImagePicker: () => void;
  closeImagePicker: () => void;
  setPickerError: (err: string | null) => void;
  setPickerLoaded: (loaded: boolean) => void;
}

const IMAGE_PICKER_ORIGIN = 'https://jvxqvfx3pv.ap-northeast-1.awsapprunner.com';

export function Composer({
  onSendText,
  onSendImageDetection,
  disabled,
  pickerOpen,
  pickerError,
  pickerLoaded,
  openImagePicker,
  closeImagePicker,
  setPickerError,
  setPickerLoaded,
}: Props) {
  const [value, setValue] = useState('');
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

  // postMessage 受信: 品目選択結果が外部アプリから飛んでくる
  // 新形式: { type: 'dustalk:items', items: [{ name, info? }] }
  // 旧形式: { type: 'dustalk:items', names: string[] } も後方互換で受け付ける
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== IMAGE_PICKER_ORIGIN) return;
      const data = e.data as { type?: string; names?: unknown; items?: unknown };
      if (data?.type !== 'dustalk:items') return;
      let detected: DetectedItemInput[] = [];
      if (Array.isArray(data.items)) {
        for (const it of data.items as unknown[]) {
          if (!it || typeof it !== 'object') continue;
          const obj = it as Record<string, unknown>;
          const name = typeof obj.name === 'string' ? obj.name : null;
          if (!name || name.length === 0) continue;
          const info = typeof obj.info === 'string' ? obj.info : undefined;
          detected.push(info !== undefined ? { name, info } : { name });
        }
      } else if (Array.isArray(data.names)) {
        detected = (data.names as unknown[])
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
          .map((name) => ({ name }));
      }
      closeImagePicker();
      if (detected.length > 0) {
        onSendImageDetection(detected);
      } else {
        setPickerError('品目が選択されませんでした');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [pickerOpen, onSendImageDetection, closeImagePicker, setPickerError]);

  // Escape キーでモーダルを閉じる
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeImagePicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen, closeImagePicker]);

  // モーダル表示中は背景スクロールをロック
  useEffect(() => {
    if (!pickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  const hasText = value.trim().length > 0;
  const pickerSrc =
    typeof window !== 'undefined'
      ? `${IMAGE_PICKER_ORIGIN}/?return=postMessage&origin=${encodeURIComponent(window.location.origin)}`
      : IMAGE_PICKER_ORIGIN;

  return (
    <>
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
                aria-label="品目の写真をアップロード"
                className="text-[var(--ink-soft)] hover:text-[var(--brand)] disabled:text-[var(--ink-mute)]/40 transition-colors mb-1.5 touch-manipulation"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="13" rx="2" />
                  <circle cx="12" cy="12.5" r="3.2" />
                  <path d="M8 6l1.4-2h5.2L16 6" />
                </svg>
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

            {/* 送信ボタン
                - w-12 h-12 (48px) で iOS HIG / Material 推奨のタップ最小サイズを確保
                - before: 疑似要素で見た目より大きいヒットエリアを持たせ、端でも取りこぼしにくく
                - touch-manipulation で 300ms 遅延を抑制、active:scale-95 で押下フィードバック
            */}
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !hasText}
              aria-label="送信"
              className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 touch-manipulation select-none active:scale-95 before:absolute before:-inset-2 before:content-[''] ${
                hasText && !disabled
                  ? 'bg-[var(--brand)] text-[var(--paper)] shadow-[0_6px_20px_-6px_rgba(11,30,74,0.6)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(11,30,74,0.7)]'
                  : 'bg-[var(--ivory-deep)] text-[var(--ink-mute)] cursor-not-allowed'
              }`}
              title="送信"
            >
              <svg className="w-5 h-5 -translate-x-px translate-y-px relative" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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

      {/* 写真から品目選択 — iframe モーダル */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="写真から品目を選択"
        >
          {/* バックドロップ（クリックで閉じる） */}
          <button
            type="button"
            aria-label="閉じる"
            tabIndex={-1}
            onClick={closeImagePicker}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />
          {/* モーダル本体 */}
          <div className="relative w-full max-w-[520px] h-[min(92vh,860px)] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)]">
              <div className="text-sm font-medium text-[var(--ink)]">写真から品目を選択</div>
              <button
                type="button"
                onClick={closeImagePicker}
                aria-label="閉じる"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--brand)] transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 relative bg-[var(--surface)]">
              {!pickerLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--ink-mute)] text-sm">
                  読み込み中…
                </div>
              )}
              <iframe
                src={pickerSrc}
                title="画像から品目選択"
                onLoad={() => setPickerLoaded(true)}
                allow="camera; microphone; clipboard-read; clipboard-write"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
