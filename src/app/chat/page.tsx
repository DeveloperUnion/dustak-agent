'use client';

import { useCallback, useEffect, useState } from 'react';
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
    applyConfirmationEdit,
    reset,
  } = useChatSession();

  // 初回マウントで挨拶を取りに行く
  useEffect(() => {
    if (flow === null && messages.length === 0 && !loading) {
      initSession();
    }
  }, [flow, messages.length, loading, initSession]);

  // 写真ピッカー（iframe モーダル）の state は ChatThread のチップと Composer のカメラボタン両方から開けるようリフトアップ
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const openImagePicker = useCallback(() => {
    if (loading) return;
    setPickerError(null);
    setPickerLoaded(false);
    setPickerOpen(true);
  }, [loading]);
  const closeImagePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const headerTitle = flow ? FLOW_LABEL[flow] : 'DUSTALK AIエージェント';
  const headerSubtitle = flow ? '申し込みアシスタント' : undefined;

  const resetSession = () => {
    reset();
    initSession();
  };

  if (done && flow) {
    return (
      <div className="flex flex-col h-dvh bg-white">
        <ChatHeader
          title={`${FLOW_LABEL[flow]} - 確認`}
          onBack={resetSession}
          onResetSession={resetSession}
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
          onApplyEdit={applyConfirmationEdit}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-white">
      <ChatHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        onBack={resetSession}
        onResetSession={resetSession}
      />
      <ChatThread
        messages={messages}
        loading={loading}
        canUndo={slotsHistory.length > 0}
        onUndo={undo}
        onFreeText={(text) => sendText(text)}
        onStepResponse={(stepId, value, label) => sendStepResponse(stepId, value, label)}
        onOpenImagePicker={openImagePicker}
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
        pickerOpen={pickerOpen}
        pickerError={pickerError}
        pickerLoaded={pickerLoaded}
        openImagePicker={openImagePicker}
        closeImagePicker={closeImagePicker}
        setPickerError={setPickerError}
        setPickerLoaded={setPickerLoaded}
      />
    </div>
  );
}
