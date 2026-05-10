'use client';

import { useEffect } from 'react';
import { useChatSession } from '@/lib/store/useChatSession';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Composer } from '@/components/chat/Composer';
import { ConfirmationView } from '@/components/chat/ConfirmationView';
import type { FlowKind } from '@/lib/slots/types';

const FLOW_LABEL: Record<FlowKind, string> = {
  household_spot: '個人スポット',
  business_spot: '事業者スポット',
  business_recurring: '事業者定期回収',
};

export default function ChatPage() {
  const {
    flow,
    slots,
    messages,
    loading,
    done,
    error,
    slotsHistory,
    initSession,
    sendText,
    sendStepResponse,
    sendImageDetection,
    undo,
    editField,
    reset,
  } = useChatSession();

  // 初回マウントで挨拶を取りに行く
  useEffect(() => {
    if (flow === null && messages.length === 0 && !loading) {
      initSession();
    }
  }, [flow, messages.length, loading, initSession]);

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
          onEditField={editField}
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
        messages={messages}
        loading={loading}
        canUndo={slotsHistory.length > 0}
        onUndo={undo}
        onFreeText={(text) => sendText(text)}
        onStepResponse={(stepId, value, label) => sendStepResponse(stepId, value, label)}
      />
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}
      <Composer
        onSendText={(text) => sendText(text)}
        onSendImageDetection={(names) => sendImageDetection(names)}
        disabled={loading}
      />
    </div>
  );
}
