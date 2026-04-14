'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types/messages';
import { TextBubble } from './TextBubble';
import { ChipsBubble } from './ChipsBubble';
import { CalendarWidget, type CalendarSelection } from './CalendarWidget';
import { AddressPickerWidget } from './AddressPickerWidget';
import type { AddressComponents } from '@/lib/slots/types';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onStepResponse: (stepId: string, value: unknown, displayLabel: string) => void;
  onFreeText: (text: string) => void;
}

export function ChatThread({ messages, loading, onStepResponse, onFreeText }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto dustalk-canvas dustalk-scroll py-6"
    >
      {messages.length === 0 && !loading && (
        <div className="flex flex-col items-center mt-20 px-8">
          <div className="text-center max-w-sm dustalk-rise">
            <div className="eyebrow mb-3">EST. 2026 · TOKYO</div>
            <h2 className="font-mincho text-[26px] leading-[1.4] text-[var(--ink)] mb-2">
              ようこそ、<br />
              <span className="text-[var(--brand)]">Dustalk</span> へ。
            </h2>
            <div className="flex items-center gap-3 my-5">
              <span className="flex-1 h-px bg-[var(--line-strong)]" />
              <span className="text-[10px] tracking-[0.3em] text-[var(--ink-mute)]">◆</span>
              <span className="flex-1 h-px bg-[var(--line-strong)]" />
            </div>
            <p className="text-[13px] leading-[1.85] text-[var(--ink-soft)]">
              ゴミ回収のお申し込みを<br />
              対話形式でお手伝いいたします。<br />
              下のチャットからお気軽にどうぞ。
            </p>
          </div>
        </div>
      )}

      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const showTail = !prev || prev.role !== m.role;

        if (m.role === 'user') {
          return (
            <TextBubble
              key={i}
              role="user"
              text={m.text}
              createdAt={m.createdAt}
              showTail={showTail}
            />
          );
        }
        const isLast = i === lastAssistantIdx;
        return (
          <div key={i}>
            {m.parts.map((p, j) => {
              const partShowTail = j === 0 ? showTail : false;
              if (p.kind === 'text') {
                return (
                  <TextBubble
                    key={j}
                    role="assistant"
                    text={p.text}
                    createdAt={j === m.parts.length - 1 ? m.createdAt : undefined}
                    showTail={partShowTail}
                  />
                );
              }
              if (p.kind === 'chips') {
                return (
                  <ChipsBubble
                    key={j}
                    part={p}
                    disabled={!isLast || loading}
                    createdAt={j === m.parts.length - 1 ? m.createdAt : undefined}
                    showTail={partShowTail}
                    onPick={(value, label) => {
                      if (p.stepId) onStepResponse(p.stepId, value, label);
                    }}
                    onFreeText={p.allowFreeText ? onFreeText : undefined}
                  />
                );
              }
              if (p.kind === 'widget' && p.widget === 'address_picker') {
                return (
                  <AddressPickerWidget
                    key={j}
                    part={p}
                    disabled={!isLast || loading}
                    createdAt={j === m.parts.length - 1 ? m.createdAt : undefined}
                    showTail={partShowTail}
                    onSubmit={(address: string, components?: AddressComponents) => {
                      if (!p.stepId) return;
                      onStepResponse(p.stepId, { address, components }, address);
                    }}
                  />
                );
              }
              if (p.kind === 'widget' && p.widget === 'calendar') {
                return (
                  <CalendarWidget
                    key={j}
                    part={p}
                    disabled={!isLast || loading}
                    createdAt={j === m.parts.length - 1 ? m.createdAt : undefined}
                    showTail={partShowTail}
                    onSubmit={(selections: CalendarSelection[]) => {
                      if (!p.stepId) return;
                      const label = selections
                        .map((s) => `${s.date} ${s.timeSlot}`)
                        .join(' / ');
                      onStepResponse(p.stepId, selections, label);
                    }}
                    onCancel={() => {
                      /* noop */
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
        );
      })}

      {loading && (
        <div className="flex justify-start px-5 mt-4">
          <div className="dustalk-rise">
            <div className="flex items-center gap-2 mb-1.5 ml-1">
              <span className="w-1 h-1 rounded-full bg-[var(--brand)]" />
              <span className="eyebrow">DUSTALK · 思考中</span>
            </div>
            <div className="relative bg-[var(--surface)] rounded-[14px] rounded-tl-[4px] px-5 py-3.5 border border-[var(--line)] shadow-[0_2px_18px_-8px_rgba(11,30,74,0.18)]">
              <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[var(--ink)]/85" />
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink)] dustalk-dot" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink)] dustalk-dot" style={{ animationDelay: '180ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink)] dustalk-dot" style={{ animationDelay: '360ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
