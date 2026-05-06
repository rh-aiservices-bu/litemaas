import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '@patternfly/react-core';
import { OutlinedCommentsIcon, UndoIcon } from '@patternfly/react-icons';

import ChatbotToggle from '@patternfly/chatbot/dist/dynamic/ChatbotToggle';
import Chatbot, { ChatbotDisplayMode } from '@patternfly/chatbot/dist/dynamic/Chatbot';
import ChatbotContent from '@patternfly/chatbot/dist/dynamic/ChatbotContent';
import ChatbotFooter from '@patternfly/chatbot/dist/dynamic/ChatbotFooter';
import ChatbotHeader, {
  ChatbotHeaderMain,
  ChatbotHeaderTitle,
  ChatbotHeaderActions,
  ChatbotHeaderCloseButton,
} from '@patternfly/chatbot/dist/dynamic/ChatbotHeader';
import ChatbotWelcomePrompt from '@patternfly/chatbot/dist/dynamic/ChatbotWelcomePrompt';
import Message from '@patternfly/chatbot/dist/dynamic/Message';
import MessageBar from '@patternfly/chatbot/dist/dynamic/MessageBar';
import MessageBox from '@patternfly/chatbot/dist/dynamic/MessageBox';

import '@patternfly/chatbot/dist/css/main.css';

import { assistantService } from '../services/assistant.service';
import type { MessageBoxHandle } from '@patternfly/chatbot/dist/dynamic/MessageBox';
import type { SupportChatMessage } from '../types/supportChat';

import userAvatarImg from '../assets/images/avatar-placeholder.svg';
import botAvatarImg from '../assets/images/orb.svg';

const SupportChat: React.FC = () => {
  const { t } = useTranslation();

  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageBoxRef = useRef<MessageBoxHandle>(null);

  useEffect(() => {
    assistantService
      .checkHealth()
      .then((res) => setIsHealthy(res.status === 'healthy' || res.status === 'degraded'))
      .catch(() => setIsHealthy(false));
  }, []);

  useEffect(() => {
    messageBoxRef.current?.scrollToBottom({ behavior: 'smooth' });
  }, [messages]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleToggle = useCallback(() => {
    setIsChatbotVisible((prev) => !prev);
  }, []);

  const handleNewConversation = useCallback(() => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    setMessages([]);
    setConversationId(undefined);
    setIsStreaming(false);
    setIsSending(false);
    abortControllerRef.current = null;
  }, [isStreaming]);

  const handleSendMessage = useCallback(
    async (messageContent: string | number) => {
      const text = String(messageContent).trim();
      if (!text || isSending) return;

      const userMessage: SupportChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      const assistantMessageId = generateId();
      const assistantMessage: SupportChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsSending(true);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedContent = '';

      try {
        await assistantService.sendStreamingMessage(
          { message: text, conversation_id: conversationId },
          {
            onChunk: (chunk) => {
              accumulatedContent += chunk;
              const currentContent = accumulatedContent;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: currentContent } : msg,
                ),
              );
            },
            onRetract: (_index, placeholder) => {
              accumulatedContent = accumulatedContent.replace(
                accumulatedContent.split('').slice(-20).join(''),
                placeholder,
              );
              const currentContent = accumulatedContent;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: currentContent } : msg,
                ),
              );
            },
            onError: (error, _retryable) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: error || t('supportChat.messages.streamError') }
                    : msg,
                ),
              );
            },
            onDone: (newConversationId, safetyNotice) => {
              if (newConversationId) {
                setConversationId(newConversationId);
              }
              if (safetyNotice) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, safetyNotice } : msg,
                  ),
                );
              }
            },
          },
          controller,
        );
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content || t('supportChat.messages.error') }
                : msg,
            ),
          );
        }
      } finally {
        setIsSending(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [conversationId, isSending, t],
  );

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setIsSending(false);
    abortControllerRef.current = null;
  }, []);

  return (
    <>
      <ChatbotToggle
        tooltipLabel={
          isHealthy === false
            ? t('supportChat.status.unavailable')
            : t('supportChat.toggle.tooltip')
        }
        isChatbotVisible={isChatbotVisible}
        onToggleChatbot={handleToggle}
        isDisabled={isHealthy === false}
        closedToggleIcon={() => <OutlinedCommentsIcon />}
        aria-label={t('supportChat.toggle.ariaLabel')}
      />
      <Chatbot
        displayMode={ChatbotDisplayMode.default}
        isVisible={isChatbotVisible}
        ariaLabel={t('supportChat.ariaLabel')}
      >
        <ChatbotHeader>
          <ChatbotHeaderMain>
            <ChatbotHeaderTitle showOnDefault={t('supportChat.header.title')} />
          </ChatbotHeaderMain>
          <ChatbotHeaderActions>
            <Tooltip content={t('supportChat.actions.newConversation')}>
              <Button
                variant="plain"
                aria-label={t('supportChat.actions.newConversation')}
                onClick={handleNewConversation}
                isDisabled={messages.length === 0}
                size="sm"
              >
                <UndoIcon />
              </Button>
            </Tooltip>
            <ChatbotHeaderCloseButton
              onClick={handleToggle}
              tooltipContent={t('supportChat.header.close')}
            />
          </ChatbotHeaderActions>
        </ChatbotHeader>
        <ChatbotContent>
          <MessageBox ref={messageBoxRef}>
            {messages.length === 0 ? (
              <ChatbotWelcomePrompt
                title={t('supportChat.welcome.title')}
                description={t('supportChat.welcome.description')}
              />
            ) : (
              messages.map((msg) => (
                <Message
                  key={msg.id}
                  id={msg.id}
                  role={msg.role === 'assistant' ? 'bot' : 'user'}
                  content={msg.content}
                  name={msg.role === 'assistant' ? t('supportChat.header.title') : undefined}
                  timestamp={msg.timestamp.toLocaleTimeString()}
                  avatar={msg.role === 'assistant' ? botAvatarImg : userAvatarImg}
                  isLoading={msg.role === 'assistant' && msg.content === '' && isSending}
                  actions={
                    msg.role === 'assistant' && msg.content
                      ? {
                          positive: {
                            onClick: () => {},
                            ariaLabel: t('supportChat.feedback.helpful'),
                          },
                          negative: {
                            onClick: () => {},
                            ariaLabel: t('supportChat.feedback.notHelpful'),
                          },
                        }
                      : undefined
                  }
                />
              ))
            )}
          </MessageBox>
        </ChatbotContent>
        <ChatbotFooter>
          <MessageBar
            onSendMessage={handleSendMessage}
            hasAttachButton={false}
            hasMicrophoneButton={false}
            hasStopButton={isStreaming}
            handleStopButton={handleStopStreaming}
            isSendButtonDisabled={isSending}
            placeholder={t('supportChat.input.placeholder')}
          />
        </ChatbotFooter>
      </Chatbot>
    </>
  );
};

export default SupportChat;
