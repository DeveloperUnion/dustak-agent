'use client';

import { useEffect, useMemo } from 'react';
import { useChatSession } from '@/lib/store/useChatSession';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Composer } from '@/components/chat/Composer';
import { ConfirmationView } from '@/components/chat/ConfirmationView';
import type { FlowKind } from '@/lib/slots/types';
import type { ChatMessage } from '@/types/messages';

const FLOW_LABEL: Record<FlowKind, string> = {
  household_spot: '個人スポット',
  business_spot: '事業者スポット',
  business_recurring: '事業者定期回収',
};

const BOOTSTRAP_STEP_ID = '__bootstrap.pickFlow';

/** フロー未選択時に最初に表示する仮想 assistant メッセージ */
function bootstrapMessage(): ChatMessage {
  return {
    role: 'assistant',
    createdAt: 0, // 表示時刻なし
    parts: [
      {
        kind: 'text',
        text: 'こんにちは！Dustalk のゴミ回収申し込みアシスタントです。\nまずは申込種別を選んでください。',
      },
      {
        kind: 'chips',
        stepId: BOOTSTRAP_STEP_ID,
        options: [
          { label: '個人スポット', value: 'household_spot' },
          { label: '事業者スポット', value: 'business_spot' },
          { label: '事業者定期回収', value: 'business_recurring' },
        ],
      },
    ],
  };
}

export default function ChatPage() {
  const {
    flow,
    slots,
    messages,
    loading,
    done,
    error,
    initSession,
    pickFlow,
    sendText,
    sendStepResponse,
    sendImageDetection,
    reset,
  } = useChatSession();

  // 初回マウント時にセッション初期化（既に flow があれば何もしない）
  useEffect(() => {
    if (flow === null && messages.length === 0) {
      initSession();
    }
  }, [flow, messages.length, initSession]);

  // フロー未選択時はブートストラップメッセージを冒頭に差し込む
  const displayMessages = useMemo(() => {
    if (flow === null) return [bootstrapMessage()];
    return messages;
  }, [flow, messages]);

  const headerTitle = flow ? FLOW_LABEL[flow] : 'DUSTALK AIエージェント';
  const headerSubtitle = flow ? '申し込みアシスタント' : undefined;

  if (done && flow) {
    return (
      <div className="flex flex-col h-dvh bg-white">
        <ChatHeader
          title={`${FLOW_LABEL[flow]} - 確認`}
          onBack={() => {
            reset();
            initSession();
          }}
        />
        <ConfirmationView
          slots={slots}
          flow={flow}
          onConfirm={() => {
            /* MVP: 実送信なし */
          }}
          onEdit={() => {
            useChatSession.setState({ done: false });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-white">
      <ChatHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        onBack={() => {
          reset();
          initSession();
        }}
      />
      <ChatThread
        messages={displayMessages}
        loading={loading}
        onFreeText={(text) => sendText(text)}
        onStepResponse={(stepId, value, label) => {
          if (stepId === BOOTSTRAP_STEP_ID) {
            const flowValue = value as FlowKind;
            pickFlow(flowValue, FLOW_LABEL[flowValue]);
            return;
          }
          sendStepResponse(stepId, value, label);
        }}
      />
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}
      <Composer
        onSendText={(text) => sendText(text)}
        onSendImageDetection={(names) => sendImageDetection(names)}
        disabled={loading || flow === null}
      />
    </div>
  );
}
