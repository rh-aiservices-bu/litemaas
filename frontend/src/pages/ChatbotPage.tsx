import {
  Alert,
  Badge,
  Bullseye,
  Button,
  Card,
  CardBody,
  Content,
  ContentVariants,
  ExpandableSection,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Grid,
  GridItem,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Select,
  SelectList,
  SelectOption,
  Slider,
  SliderOnChangeEvent,
  Spinner,
  Split,
  SplitItem,
  Switch,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { ClockIcon, CommentsIcon, CubesIcon } from '@patternfly/react-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGauge, faFlagCheckered } from '@fortawesome/free-solid-svg-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// PatternFly 6 Chatbot Dynamic Imports
import Chatbot, { ChatbotDisplayMode } from '@patternfly/chatbot/dist/dynamic/Chatbot';
import ChatbotContent from '@patternfly/chatbot/dist/dynamic/ChatbotContent';
import ChatbotFooter from '@patternfly/chatbot/dist/dynamic/ChatbotFooter';
import ChatbotHeader, {
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderTitle,
} from '@patternfly/chatbot/dist/dynamic/ChatbotHeader';
import ChatbotWelcomePrompt from '@patternfly/chatbot/dist/dynamic/ChatbotWelcomePrompt';
import Message from '@patternfly/chatbot/dist/dynamic/Message';
import MessageBar from '@patternfly/chatbot/dist/dynamic/MessageBar';
import MessageBox from '@patternfly/chatbot/dist/dynamic/MessageBox';

// Import CSS for PatternFly Chatbot
import '@patternfly/chatbot/dist/css/main.css';

// Services and Types
import { useNotifications } from '../contexts/NotificationContext';
import { ApiKey, apiKeysService } from '../services/apiKeys.service';
import { chatService } from '../services/chat.service';
import { configService } from '../services/config.service';
import { Model, modelsService } from '../services/models.service';
import {
  CHAT_CONSTANTS,
  ChatCompletionRequest,
  ChatError,
  ChatMessage,
  ChatbotConfiguration,
  ResponseMetrics,
  StreamingState,
} from '../types/chat';

import userAvatar from '../../src/assets/images/avatar-placeholder.svg';
import orb from '../../src/assets/images/orb.svg';

const ChatbotPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  // Configuration State
  const [configuration, setConfiguration] = useState<ChatbotConfiguration>({
    selectedApiKeyId: null,
    selectedModel: null,
    settings: {
      temperature: CHAT_CONSTANTS.TEMPERATURE_DEFAULT,
      maxTokens: CHAT_CONSTANTS.MAX_TOKENS_DEFAULT,
      systemPrompt: '',
    },
    enableStreaming: true, // Default to enabled
  });

  // Configuration state
  const [litellmApiUrl, setLitellmApiUrl] = useState<string>('https://api.litemaas.com');

  // Data State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // UI State
  const [isConfigPanelExpanded, setIsConfigPanelExpanded] = useState(true);
  const [isApiKeySelectOpen, setIsApiKeySelectOpen] = useState(false);
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [isResponseInfoExpanded, setIsResponseInfoExpanded] = useState(true);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Error State
  const [error, setError] = useState<string | null>(null);

  // API Key Management State
  const [fullKeyCache, setFullKeyCache] = useState<Map<string, string>>(new Map());

  // Response Metrics
  const [lastResponseMetrics, setLastResponseMetrics] = useState<ResponseMetrics | null>(null);

  // Time to First Token (TTFT) for streaming
  const [streamingTTFT, setStreamingTTFT] = useState<number | null>(null);

  // Streaming State
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamingMessageId: null,
    streamingContent: '',
    abortController: null,
  });

  // Refs (for future scrolling functionality)
  // const messageBoxRef = useRef<HTMLDivElement>(null);

  // Get selected API key object
  const selectedApiKey = apiKeys.find((key) => key.id === configuration.selectedApiKeyId);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load API keys
        const response = await apiKeysService.getApiKeys(1, 100); // Load first 100 keys
        setApiKeys(response.data);

        // Auto-select first API key if available
        if (response.data.length > 0) {
          setConfiguration((prev) => ({
            ...prev,
            selectedApiKeyId: response.data[0].id,
          }));
        }

        // Load models
        const modelsResponse = await modelsService.getModels(1, 100);
        setModels(modelsResponse.models);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        addNotification({
          title: t('pages.chatbot.errors.loadDataFailed'),
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'danger',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [t, addNotification]);

  // Load configuration from backend
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await configService.getConfig();
        setLitellmApiUrl(config.litellmApiUrl);
      } catch (err) {
        console.error('Failed to load configuration:', err);
        // Keep default value if config load fails
      }
    };

    loadConfig();
  }, []);

  // Load available models when API key changes
  useEffect(() => {
    const loadAvailableModels = async () => {
      if (!selectedApiKey) {
        setAvailableModels([]);
        return;
      }

      try {
        setIsLoadingModels(true);
        setError(null);

        // Filter models by API key's supported models
        const filtered = models
          .filter((model) => selectedApiKey.models?.includes(model.id) || false)
          .map((model) => model.id);

        setAvailableModels(filtered);

        // Auto-select first available model
        if (filtered.length > 0 && !configuration.selectedModel) {
          setConfiguration((prev) => ({
            ...prev,
            selectedModel: filtered[0],
          }));
        } else if (filtered.length === 0) {
          setConfiguration((prev) => ({
            ...prev,
            selectedModel: null,
          }));
        }
      } catch (err) {
        console.error('Error loading available models:', err);
        addNotification({
          title: t('pages.chatbot.errors.loadModelsFailed'),
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'warning',
        });
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadAvailableModels();
  }, [selectedApiKey, models, configuration.selectedModel, t, addNotification]);

  // Retrieve full API key for actual usage
  const retrieveFullKey = useCallback(
    async (keyId: string): Promise<string> => {
      // Check cache first
      if (fullKeyCache.has(keyId)) {
        return fullKeyCache.get(keyId)!;
      }

      try {
        // Retrieve from backend using the secure endpoint
        const keyData = await apiKeysService.retrieveFullKey(keyId);

        // Update cache
        setFullKeyCache((prev) => new Map(prev).set(keyId, keyData.key));

        return keyData.key;
      } catch (error: any) {
        console.error('Failed to retrieve full API key:', error);

        // Let the error propagate to the caller for proper handling
        throw new Error(error.message || t('pages.chatbot.errors.keyRetrievalFailedDesc'));
      }
    },
    [fullKeyCache, t, addNotification],
  );

  // Handle message sending
  const handleSendMessage = useCallback(
    async (messageContent: string) => {
      if (!messageContent.trim() || !selectedApiKey || !configuration.selectedModel) {
        return;
      }

      const userMessage = chatService.createMessage('user', messageContent.trim());
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsSending(true);
      setError(null);
      setStreamingTTFT(null); // Reset TTFT for new message

      try {
        // Prepare the request
        const requestMessages = newMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Add system prompt if provided
        if (configuration.settings.systemPrompt.trim()) {
          requestMessages.unshift({
            role: 'system' as const,
            content: configuration.settings.systemPrompt.trim(),
          });
        }

        const request: ChatCompletionRequest = {
          model: configuration.selectedModel,
          messages: requestMessages,
          temperature: configuration.settings.temperature,
          max_tokens: configuration.settings.maxTokens,
        };

        // Get the full key (retrieve if needed)
        let apiKeyToUse: string;
        try {
          apiKeyToUse = await retrieveFullKey(selectedApiKey.id);
        } catch (error: any) {
          addNotification({
            variant: 'danger',
            title: t('pages.chatbot.errors.keyRetrievalFailed'),
            description: error.message || t('pages.chatbot.errors.keyRetrievalFailedDesc'),
          });
          setIsSending(false);
          return;
        }

        if (configuration.enableStreaming) {
          // Handle streaming response
          const assistantMessage = chatService.createMessage('assistant', '');
          const assistantMessageWithId = { ...assistantMessage };
          setMessages((prev) => [...prev, assistantMessageWithId]);

          // Set streaming state
          const abortController = new AbortController();
          setStreamingState({
            isStreaming: true,
            streamingMessageId: assistantMessageWithId.id,
            streamingContent: '',
            abortController,
          });

          await chatService.sendStreamingMessage(
            litellmApiUrl,
            apiKeyToUse,
            request,
            (content: string, _isComplete: boolean, timeToFirstToken?: number) => {
              // Capture TTFT as soon as first chunk arrives
              if (timeToFirstToken && !streamingTTFT) {
                setStreamingTTFT(timeToFirstToken);
              }

              // Update streaming content
              setStreamingState((prev) => ({
                ...prev,
                streamingContent: content,
              }));

              // Update the message in the messages array
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageWithId.id ? { ...msg, content } : msg,
                ),
              );
            },
            (metrics: ResponseMetrics) => {
              // Stream complete
              setStreamingState({
                isStreaming: false,
                streamingMessageId: null,
                streamingContent: '',
                abortController: null,
              });

              setLastResponseMetrics(metrics);
            },
            abortController,
          );
        } else {
          // Handle non-streaming response (original logic)
          const { response, metrics } = await chatService.sendMessage(
            litellmApiUrl,
            apiKeyToUse,
            request,
          );

          // Add assistant response
          if (response.choices && response.choices.length > 0) {
            const assistantMessage = chatService.createMessage(
              'assistant',
              response.choices[0].message.content,
            );
            setMessages((prev) => [...prev, assistantMessage]);
          }

          // Update metrics
          setLastResponseMetrics(metrics);
        }
      } catch (err) {
        console.error('Error sending message:', err);

        let errorMessage = 'Unknown error';
        let isAborted = false;

        if (err && typeof err === 'object' && 'message' in err) {
          const chatError = err as ChatError;
          errorMessage = chatError.message;
          isAborted = chatError.type === 'aborted';
        }

        if (isAborted) {
          // Handle aborted stream - no notifications, just clear any existing error
          setError(null);
          // Don't remove messages or reset streaming state - content is already preserved
        } else {
          // Handle real errors
          setError(errorMessage);
          addNotification({
            title: t('pages.chatbot.errors.sendFailed'),
            description: errorMessage,
            variant: 'danger',
          });

          // Remove the user message if sending failed
          setMessages(messages);

          // Reset streaming state if it was streaming
          setStreamingState({
            isStreaming: false,
            streamingMessageId: null,
            streamingContent: '',
            abortController: null,
          });
        }
      } finally {
        setIsSending(false);
      }
    },
    [messages, selectedApiKey, configuration, litellmApiUrl, retrieveFullKey, t, addNotification],
  );

  // Handle stopping streaming
  const handleStopStreaming = useCallback(() => {
    if (streamingState.abortController) {
      streamingState.abortController.abort();

      // Preserve the currently streamed content in the message
      if (streamingState.streamingMessageId && streamingState.streamingContent) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingState.streamingMessageId
              ? { ...msg, content: streamingState.streamingContent }
              : msg,
          ),
        );
      }

      // Reset streaming state
      setStreamingState({
        isStreaming: false,
        streamingMessageId: null,
        streamingContent: '',
        abortController: null,
      });
      setIsSending(false);

      // No notification - silent stop
    }
  }, [
    streamingState.abortController,
    streamingState.streamingMessageId,
    streamingState.streamingContent,
  ]);

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    // Stop any ongoing streaming
    if (streamingState.abortController) {
      streamingState.abortController.abort();
    }

    setMessages([]);
    setLastResponseMetrics(null);
    setError(null);
    setStreamingTTFT(null);
    setStreamingState({
      isStreaming: false,
      streamingMessageId: null,
      streamingContent: '',
      abortController: null,
    });
    /* 
    addNotification({
      title: t('pages.chatbot.success.conversationCleared'),
      variant: 'info',
    });
     */
  }, [streamingState.abortController, t, addNotification]);

  // Render configuration panel
  const configurationPanel = (
    <ExpandableSection
      toggleText={t('pages.chatbot.configuration.title')}
      isExpanded={isConfigPanelExpanded}
      onToggle={(_event, isExpanded) => setIsConfigPanelExpanded(isExpanded)}
      displaySize="lg"
    >
      <div className="pf-v6-u-mt-md">
        <Form>
          {/* API Key Selection */}
          <FormGroup
            label={t('pages.chatbot.configuration.apiKey')}
            isRequired
            fieldId="api-key-select"
          >
            <Select
              id="api-key-select"
              isOpen={isApiKeySelectOpen}
              selected={configuration.selectedApiKeyId}
              onSelect={(_event, value) => {
                setConfiguration((prev) => ({
                  ...prev,
                  selectedApiKeyId: value as string,
                  selectedModel: null, // Reset model when API key changes
                }));
                setIsApiKeySelectOpen(false);
              }}
              onOpenChange={setIsApiKeySelectOpen}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsApiKeySelectOpen(!isApiKeySelectOpen)}
                  isExpanded={isApiKeySelectOpen}
                  isDisabled={apiKeys.length === 0}
                >
                  {selectedApiKey
                    ? selectedApiKey.name
                    : t('pages.chatbot.configuration.selectApiKey')}
                </MenuToggle>
              )}
            >
              <SelectList>
                {apiKeys.map((apiKey) => (
                  <SelectOption key={apiKey.id} value={apiKey.id}>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                      <FlexItem>{apiKey.name}</FlexItem>
                      <FlexItem>
                        <Badge>
                          {apiKey.models?.length || 0}{' '}
                          {t('pages.chatbot.configuration.modelsLabel')}
                        </Badge>
                      </FlexItem>
                    </Flex>
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </FormGroup>

          {/* Model Selection */}
          <FormGroup
            label={t('pages.chatbot.configuration.model')}
            isRequired
            fieldId="model-select"
          >
            <Select
              id="model-select"
              isOpen={isModelSelectOpen}
              selected={configuration.selectedModel}
              onSelect={(_event, value) => {
                setConfiguration((prev) => ({
                  ...prev,
                  selectedModel: value as string,
                }));
                setIsModelSelectOpen(false);
              }}
              onOpenChange={setIsModelSelectOpen}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                  isExpanded={isModelSelectOpen}
                  isDisabled={availableModels.length === 0 || isLoadingModels}
                >
                  {isLoadingModels ? (
                    <Spinner size="sm" />
                  ) : configuration.selectedModel ? (
                    configuration.selectedModel
                  ) : (
                    t('pages.chatbot.configuration.selectModel')
                  )}
                </MenuToggle>
              )}
            >
              <SelectList>
                {availableModels.map((modelId) => (
                  <SelectOption key={modelId} value={modelId}>
                    {modelId}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </FormGroup>

          {/* Basic Settings */}
          <FormGroup
            fieldId="temperature-input"
            label={`${t('pages.chatbot.configuration.temperature')}: ${configuration.settings.temperature}`}
          >
            {/* TODO: Put this in a helper
          <div style={{ fontSize: 'var(--pf-v6-global--FontSize--sm)' }}>
            {t('pages.chatbot.configuration.temperatureDescription', {
              value: configuration.settings.temperature,
            })}
          </div> */}
            <Slider
              onChange={(_event: SliderOnChangeEvent, value: number) =>
                setConfiguration((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    temperature: value,
                  },
                }))
              }
              hasTooltipOverThumb
              value={configuration.settings.temperature}
              min={CHAT_CONSTANTS.TEMPERATURE_MIN}
              max={CHAT_CONSTANTS.TEMPERATURE_MAX}
              areCustomStepsContinuous
              customSteps={[
                {
                  value: CHAT_CONSTANTS.TEMPERATURE_MIN,
                  label: CHAT_CONSTANTS.TEMPERATURE_MIN.toString(),
                },
                {
                  value: CHAT_CONSTANTS.TEMPERATURE_MAX,
                  label: CHAT_CONSTANTS.TEMPERATURE_MAX.toString(),
                },
              ]}
            />
          </FormGroup>

          <FormGroup label={t('pages.chatbot.configuration.maxTokens')} fieldId="max-tokens-input">
            <TextInput
              type="number"
              id="max-tokens-input"
              name="max-tokens-input"
              aria-describedby="max-tokens-input"
              value={configuration.settings.maxTokens}
              onChange={(_event: SliderOnChangeEvent, value: string) =>
                setConfiguration((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    maxTokens: parseInt(value) || CHAT_CONSTANTS.MAX_TOKENS_DEFAULT,
                  },
                }))
              }
            />
          </FormGroup>

          <FormGroup label={t('pages.chatbot.configuration.streaming')} fieldId="streaming-toggle">
            <Switch
              id="streaming-toggle"
              label={t('pages.chatbot.configuration.streamingEnabled')}
              isChecked={configuration.enableStreaming || false}
              onChange={(_event, checked) =>
                setConfiguration((prev) => ({
                  ...prev,
                  enableStreaming: checked,
                }))
              }
            />
          </FormGroup>
        </Form>
      </div>
    </ExpandableSection>
  );

  // Render response info panel
  const responseInfoPanel = (
    <ExpandableSection
      toggleText={t('pages.chatbot.responseInfo.title')}
      isExpanded={isResponseInfoExpanded}
      onToggle={(_event, isExpanded) => setIsResponseInfoExpanded(isExpanded)}
      displaySize="lg"
    >
      <div className="pf-v6-u-mt-md">
        {lastResponseMetrics || streamingTTFT ? (
          <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
            {/* Time to First Token - shows immediately when available */}
            {configuration.enableStreaming && streamingTTFT && (
              <FlexItem>
                <Split hasGutter>
                  <SplitItem>
                    <FontAwesomeIcon icon={faFlagCheckered} />
                  </SplitItem>
                  <SplitItem isFilled>
                    <div style={{ fontSize: 'var(--pf-v6-global--FontSize--sm)' }}>
                      {t('pages.chatbot.responseInfo.timeToFirstToken')}:{' '}
                      {Math.round(streamingTTFT)}ms
                    </div>
                  </SplitItem>
                </Split>
              </FlexItem>
            )}

            {/* Remaining metrics - show only when response is complete */}
            {lastResponseMetrics && (
              <>
                <FlexItem>
                  <Split hasGutter>
                    <SplitItem>
                      <ClockIcon />
                    </SplitItem>
                    <SplitItem isFilled>
                      <div style={{ fontSize: 'var(--pf-v6-global--FontSize--sm)' }}>
                        {t('pages.chatbot.responseInfo.responseTime')}:{' '}
                        {Math.round(lastResponseMetrics.responseTime)}ms
                      </div>
                    </SplitItem>
                  </Split>
                </FlexItem>

                <FlexItem>
                  <Split hasGutter>
                    <SplitItem>
                      <CubesIcon />
                    </SplitItem>
                    <SplitItem isFilled>
                      <div style={{ fontSize: 'var(--pf-v6-global--FontSize--sm)' }}>
                        {t('pages.chatbot.responseInfo.tokenUsage')}:{' '}
                        {lastResponseMetrics.tokens.total_tokens} (
                        {lastResponseMetrics.tokens.prompt_tokens}{' '}
                        {t('pages.chatbot.responseInfo.prompt')} +{' '}
                        {lastResponseMetrics.tokens.completion_tokens}{' '}
                        {t('pages.chatbot.responseInfo.completion')})
                      </div>
                    </SplitItem>
                  </Split>
                </FlexItem>

                <FlexItem>
                  <Split hasGutter>
                    <SplitItem>
                      <FontAwesomeIcon icon={faGauge} />
                    </SplitItem>
                    <SplitItem isFilled>
                      <div style={{ fontSize: 'var(--pf-v6-global--FontSize--sm)' }}>
                        {t('pages.chatbot.responseInfo.tokensPerSecond')}:{' '}
                        {Math.round(
                          lastResponseMetrics.tokens.completion_tokens /
                            (lastResponseMetrics.responseTime / 1000),
                        )}{' '}
                        {t('pages.chatbot.responseInfo.tokensPerSecondUnit')}
                      </div>
                    </SplitItem>
                  </Split>
                </FlexItem>
              </>
            )}
          </Flex>
        ) : (
          <div
            style={{ fontSize: 'var(--pf-v6-global--FontSize--sm)' }}
            className="pf-v6-u-color-400"
          >
            {t('pages.chatbot.responseInfo.noData')}
          </div>
        )}
      </div>
    </ExpandableSection>
  );

  // Loading state
  if (isLoading) {
    return (
      <PageSection isFilled>
        <Flex
          justifyContent={{ default: 'justifyContentCenter' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Spinner size="xl" />
            <div className="pf-v6-u-mt-md pf-v6-u-text-align-center">
              {t('pages.chatbot.loading')}
            </div>
          </FlexItem>
        </Flex>
      </PageSection>
    );
  }

  return (
    <>
      {/* Main Layout with Two Columns */}
      <PageSection>
        <Grid hasGutter style={{ height: 'calc(100vh - 150px)' }}>
          {/* Left Column - Configuration + Response Metrics (25%) */}
          <GridItem span={3}>
            <Flex>
              <FlexItem style={{ width: '100%' }}>
                <Content style={{ marginBottom: '10px' }}>
                  <Title headingLevel="h1" size="2xl">
                    <CommentsIcon className="pf-v6-u-mr-sm" />
                    &nbsp;{t('pages.chatbot.title')}
                  </Title>
                  {/* <Content component="p">{t('pages.chatbot.subtitle')}</Content> */}
                </Content>
              </FlexItem>
              <FlexItem style={{ width: '100%', marginInlineEnd: 'auto' }}>
                <CardBody>{configurationPanel}</CardBody>
              </FlexItem>
              <FlexItem style={{ width: '100%' }}>
                <CardBody>{responseInfoPanel}</CardBody>
              </FlexItem>
            </Flex>
          </GridItem>

          {/* Right Column - Chatbot Only (75%) */}
          <GridItem span={9}>
            <Card style={{ height: '100%' }}>
              <CardBody
                style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Chatbot displayMode={ChatbotDisplayMode.embedded}>
                    <ChatbotHeader className="chat-header">
                      <ChatbotHeaderMain>
                        <ChatbotHeaderTitle className="chat-header-title">
                          {configuration.selectedModel ? (
                            <Bullseye>
                              {selectedApiKey && (
                                <Badge style={{ marginRight: '10px' }}>{selectedApiKey.name}</Badge>
                              )}
                              <Content>
                                <Content
                                  component={ContentVariants.h3}
                                  className="chat-header-title"
                                >
                                  {configuration.selectedModel}
                                </Content>
                              </Content>
                            </Bullseye>
                          ) : (
                            t('pages.chatbot.chat.selectModelFirst')
                          )}
                        </ChatbotHeaderTitle>
                      </ChatbotHeaderMain>
                      <ChatbotHeaderActions>
                        {streamingState.isStreaming ? (
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={handleStopStreaming}
                            aria-label={t('pages.chatbot.chat.stopGeneration')}
                          >
                            {t('pages.chatbot.chat.stop')}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={handleClearConversation}
                            isDisabled={messages.length === 0}
                            aria-label={t('pages.chatbot.chat.clearConversation')}
                          >
                            {t('pages.chatbot.chat.clear')}
                          </Button>
                        )}
                      </ChatbotHeaderActions>
                    </ChatbotHeader>

                    <ChatbotContent style={{ flex: 1, overflowY: 'auto' }}>
                      <MessageBox>
                        {messages.length === 0 ? (
                          <ChatbotWelcomePrompt
                            title={t('pages.chatbot.welcome.title')}
                            description={t('pages.chatbot.welcome.description')}
                          />
                        ) : (
                          messages.map((message) => (
                            <Message
                              key={message.id}
                              role={
                                message.role === 'assistant'
                                  ? 'bot'
                                  : message.role === 'system'
                                    ? 'bot'
                                    : message.role
                              }
                              content={message.content}
                              timestamp={message.timestamp.toLocaleTimeString()}
                              avatar={message.role === 'assistant' ? orb : userAvatar}
                            />
                          ))
                        )}
                        {isSending && !streamingState.isStreaming && (
                          <Message role="bot" content="" isLoading avatar={orb} />
                        )}
                      </MessageBox>
                    </ChatbotContent>

                    <ChatbotFooter>
                      {error && (
                        <Alert
                          variant="danger"
                          title={t('pages.chatbot.errors.chatError')}
                          isInline
                          className="pf-v6-u-mb-md"
                        >
                          {error}
                        </Alert>
                      )}
                      <MessageBar
                        onSendMessage={(message) => handleSendMessage(String(message))}
                        isDisabled={
                          !selectedApiKey ||
                          !configuration.selectedModel ||
                          isSending ||
                          streamingState.isStreaming
                        }
                        placeholder={
                          streamingState.isStreaming
                            ? t('pages.chatbot.chat.streamingInProgress')
                            : selectedApiKey && configuration.selectedModel
                              ? t('pages.chatbot.chat.placeholder')
                              : t('pages.chatbot.chat.configureFirst')
                        }
                        hasAttachButton={false}
                      />
                    </ChatbotFooter>
                  </Chatbot>
                </div>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
};

export default ChatbotPage;
