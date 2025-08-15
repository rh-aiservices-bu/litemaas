# Chatbot Implementation Guide

## Architecture Overview

The Test Chatbot feature is built with a direct integration approach to LiteLLM, bypassing the need for additional backend routes. This design provides better performance, reduces complexity, and follows the existing pattern used in the API Keys testing functionality.

### Key Architectural Decisions

1. **Direct LiteLLM Integration**: Frontend communicates directly with LiteLLM endpoint
2. **PatternFly 6 Components**: Uses official PatternFly Chatbot component library
3. **Service Layer Pattern**: Implements dedicated services for chat and prompt management
4. **Type Safety**: Comprehensive TypeScript interfaces for all data structures
5. **Internationalization**: Full i18n support for 9 languages

### Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **UI Library**: PatternFly 6 Chatbot components
- **State Management**: React state with React Query for API calls
- **Styling**: PatternFly 6 CSS with component-level imports
- **HTTP Client**: Native Fetch API with timeout support
- **Storage**: localStorage for custom prompts
- **Testing**: Vitest for unit tests, Playwright for E2E

## Component Architecture

### Directory Structure

```
frontend/src/
├── pages/
│   └── ChatbotPage.tsx              # Main chatbot page component
├── services/
│   ├── chat.service.ts              # LiteLLM integration service
│   └── prompts.service.ts           # Prompt management service
├── types/
│   └── chat.ts                      # TypeScript type definitions
└── i18n/locales/
    ├── en/translation.json          # English translations
    ├── es/translation.json          # Spanish translations
    └── ... (7 other languages)
```

### Component Hierarchy

```
ChatbotPage
├── ConfigurationPanel
│   ├── ApiKeySelector (Dropdown)
│   ├── ModelSelector (Dropdown)
│   └── AdvancedSettings
│       ├── TemperatureSlider
│       ├── MaxTokensInput
│       └── SystemPromptTextarea
├── QuickTestTemplates
│   └── PromptButtons[]
├── ChatInterface (Grid 70%)
│   ├── PatternFly Chatbot
│   │   ├── ChatbotHeader
│   │   ├── ChatbotContent
│   │   │   ├── ChatbotWelcomePrompt
│   │   │   └── MessageBox
│   │   │       └── Message[]
│   │   └── ChatbotFooter
│   │       └── MessageBar
│   └── ActionButtons
│       ├── ClearButton
│       ├── ExportButton
│       └── SavePromptButton
└── ResponseInfoPanel (Grid 30%)
    ├── TokenUsageDisplay
    ├── ResponseTimeDisplay
    ├── CostEstimateDisplay
    └── RawResponseViewer
```

## Service Layer Implementation

### Chat Service (`chat.service.ts`)

The ChatService handles all communication with the LiteLLM endpoint and provides utility functions for conversation management.

#### Key Methods

```typescript
class ChatService {
  // Send message to LiteLLM endpoint
  async sendMessage(
    litellmUrl: string,
    apiKey: string,
    request: ChatCompletionRequest,
  ): Promise<{ response; metrics }>;

  // Calculate cost based on token usage
  calculateCost(model: string, usage: TokenUsage): number;

  // Export conversation in different formats
  exportConversation(conversation: ConversationExport, format: ExportFormat): string;

  // Create downloadable blob for export
  createExportBlob(content: string, format: ExportFormat): Blob;

  // Utility methods for message creation and validation
  createMessage(role, content, id?): ChatMessage;
  private validateRequest(request): void;
  private handleApiError(response): Promise<ChatError>;
}
```

#### Error Handling

The service implements comprehensive error handling:

- **Network Errors**: Connection issues, timeouts
- **Authentication Errors**: Invalid API keys, permission issues
- **Rate Limiting**: Automatic detection and user guidance
- **Validation Errors**: Input validation with detailed messages
- **Server Errors**: LiteLLM service issues with retry logic

#### Cost Calculation

Uses a pricing matrix for common models:

```typescript
const DEFAULT_MODEL_PRICING: ModelPricing = {
  'gpt-4': { prompt: 0.03, completion: 0.06, currency: 'USD' },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015, currency: 'USD' },
  'claude-3-opus': { prompt: 0.015, completion: 0.075, currency: 'USD' },
  // ... more models
};
```

### Prompts Service (`prompts.service.ts`)

Manages both built-in prompt templates and user-created custom prompts.

#### Built-in Templates

Eight pre-defined templates covering common AI testing scenarios:

1. **Code Generation**: Python function with error handling
2. **Language Translation**: English to Spanish with cultural notes
3. **Text Summarization**: Bullet points and key insights
4. **JSON Response**: Structured data validation
5. **Creative Writing**: Short story with specific elements
6. **Problem Solving**: Logic puzzles and reasoning
7. **Data Analysis**: Statistical analysis and predictions
8. **Role Playing**: Customer service scenarios

#### Custom Prompt Management

- **Storage**: localStorage with JSON serialization
- **CRUD Operations**: Create, read, update, delete custom prompts
- **Validation**: Name uniqueness, required fields
- **Import/Export**: Backup and restore prompt libraries

## PatternFly 6 Integration

### Required Components

```typescript
// Dynamic imports required for PatternFly 6 Chatbot
import { Chatbot } from '@patternfly/chatbot/dist/dynamic/Chatbot';
import { ChatbotContent } from '@patternfly/chatbot/dist/dynamic/ChatbotContent';
import { ChatbotFooter } from '@patternfly/chatbot/dist/dynamic/ChatbotFooter';
import { MessageBox } from '@patternfly/chatbot/dist/dynamic/MessageBox';
import { Message } from '@patternfly/chatbot/dist/dynamic/Message';
import { MessageBar } from '@patternfly/chatbot/dist/dynamic/MessageBar';
```

### CSS Requirements

```typescript
// Must be imported at application level
import '@patternfly/chatbot/dist/css/main.css';
```

### Component Usage Pattern

```jsx
<Chatbot>
  <ChatbotContent>
    <ChatbotWelcomePrompt
      title={t('pages.chatbot.chat.welcomeTitle')}
      description={t('pages.chatbot.chat.welcomeDescription')}
    />
    <MessageBox>
      {messages.map((message) => (
        <Message
          key={message.id}
          role={message.role}
          content={message.content}
          timestamp={message.timestamp}
        />
      ))}
    </MessageBox>
  </ChatbotContent>
  <ChatbotFooter>
    <MessageBar
      onSendMessage={handleSendMessage}
      placeholder={t('pages.chatbot.chat.placeholder')}
    />
  </ChatbotFooter>
</Chatbot>
```

## State Management

### React State Structure

```typescript
interface ChatbotPageState {
  // Configuration
  selectedApiKey: ApiKey | null;
  selectedModel: string | null;
  settings: ChatSettings;

  // Chat state
  messages: ChatMessage[];
  isLoading: boolean;

  // UI state
  isConfigExpanded: boolean;
  showRawResponse: boolean;

  // Data
  apiKeys: ApiKey[];
  models: Model[];

  // Metrics
  lastResponse: ResponseMetrics | null;
}
```

### Data Flow

1. **User selects API key** → Load available models for that key
2. **User selects model** → Enable chat interface
3. **User sends message** → Call ChatService.sendMessage()
4. **Response received** → Update messages, calculate metrics
5. **Display response** → Show message and update analytics panel

## LiteLLM Integration

### Direct API Communication

Following the pattern established in ApiKeysPage (line ~1326), the chatbot makes direct calls to the LiteLLM endpoint:

```typescript
const response = await fetch(`${litellmUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: selectedModel,
    messages: conversationMessages,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
  }),
  signal: AbortSignal.timeout(60000), // 60 second timeout
});
```

### Request Format

```typescript
interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature?: number; // 0-2
  max_tokens?: number; // 1-128000
  top_p?: number; // Alternative to temperature
  frequency_penalty?: number; // -2.0 to 2.0
  presence_penalty?: number; // -2.0 to 2.0
}
```

### Response Handling

```typescript
interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

## Internationalization

### Translation Structure

Comprehensive i18n support with organized key structure:

```json
{
  "pages": {
    "chatbot": {
      "configuration": {
        /* API key, model, settings */
      },
      "quickTests": {
        /* Template names */
      },
      "chat": {
        /* Interface text */
      },
      "responseInfo": {
        /* Analytics labels */
      },
      "export": {
        /* Export modal */
      },
      "validation": {
        /* Error messages */
      },
      "notifications": {
        /* Success/error toasts */
      },
      "accessibility": {
        /* ARIA labels */
      }
    }
  }
}
```

### Language Support

Full translations provided for:

- **English (en)**: Base language
- **Spanish (es)**: Professional technical translations
- **French (fr)**: Proper technical terminology with accents
- **German (de)**: Technical compound words and formal tone
- **Italian (it)**: Professional Italian technical language
- **Japanese (ja)**: Appropriate politeness levels and technical vocabulary
- **Korean (ko)**: Professional terms with honorifics
- **Chinese (zh)**: Simplified Chinese technical terminology
- **Elvish (elv)**: Fantasy-style translations for fun

## Testing Strategy

### Unit Testing Approach

#### Service Layer Tests

```typescript
// chat.service.test.ts
describe('ChatService', () => {
  it('should send messages to LiteLLM endpoint', async () => {
    // Mock fetch response
    // Test sendMessage method
    // Verify request format
  });

  it('should calculate costs correctly', () => {
    // Test calculateCost method
    // Verify pricing calculations
    // Test unknown model handling
  });

  it('should handle API errors gracefully', async () => {
    // Mock error responses
    // Test error type classification
    // Verify retry logic
  });
});
```

#### Component Testing

```typescript
// ChatbotPage.test.tsx
describe('ChatbotPage', () => {
  it('should render configuration panel', () => {
    // Test API key selector
    // Test model selector
    // Test advanced settings
  });

  it('should send messages when form is submitted', async () => {
    // Mock services
    // Simulate user input
    // Verify API calls
  });

  it('should display response metrics', async () => {
    // Mock successful response
    // Check token usage display
    // Verify cost calculation display
  });
});
```

### E2E Testing Scenarios

```typescript
// chatbot.spec.ts
test.describe('Chatbot Feature', () => {
  test('complete chatbot workflow', async ({ page }) => {
    await page.goto('/chatbot');

    // Select API key and model
    await page.selectOption('[data-testid="api-key-select"]', 'test-key-id');
    await page.selectOption('[data-testid="model-select"]', 'gpt-3.5-turbo');

    // Send a message
    await page.fill('[data-testid="message-input"]', 'Hello, world!');
    await page.click('[data-testid="send-button"]');

    // Verify response appears
    await expect(page.locator('[data-testid="message-history"]')).toContainText('Hello, world!');

    // Check analytics panel
    await expect(page.locator('[data-testid="token-usage"]')).toBeVisible();
  });
});
```

## Performance Considerations

### Optimization Techniques

1. **Lazy Loading**: Chatbot components loaded on demand
2. **Memoization**: React.memo for expensive components
3. **Debouncing**: Configuration changes to prevent excessive API calls
4. **Virtual Scrolling**: For long conversation histories
5. **Request Caching**: Avoid duplicate model/API key requests

### Bundle Size Impact

- PatternFly Chatbot: ~150KB (compressed)
- Additional components: ~50KB
- Total overhead: ~200KB

### Performance Metrics

- Initial load time: <2 seconds
- Message send time: <5 seconds (network dependent)
- Configuration changes: <200ms
- Export generation: <1 second for typical conversations

## Security Considerations

### API Key Protection

1. **No Logging**: API keys never logged in browser console
2. **Masked Display**: Keys shown with preview format by default
3. **Secure Storage**: No persistent storage of full keys
4. **Transport Security**: HTTPS required for all API communications

### Input Sanitization

1. **XSS Prevention**: All user input sanitized
2. **Input Validation**: Length limits and format checks
3. **Error Handling**: No sensitive data in error messages

### Rate Limiting

1. **Client-Side Throttling**: Prevent spam requests
2. **User Feedback**: Clear rate limit messaging
3. **Graceful Degradation**: Handle rate limit responses

## Deployment Considerations

### Environment Variables

No additional environment variables required. Uses existing:

- `VITE_API_BASE_URL`: For API key and model data
- `LITELLM_BASE_URL`: Available from configuration endpoint

### Build Process

Standard frontend build process with no special requirements:

```bash
npm run build  # Includes chatbot in production bundle
```

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires modern browser features:

- Fetch API with AbortController
- ES6 modules
- CSS Grid support

## Troubleshooting

### Common Development Issues

#### PatternFly CSS Not Loading

```bash
# Ensure CSS is imported in main.tsx
import '@patternfly/chatbot/dist/css/main.css';
```

#### Component Import Errors

```typescript
// Use dynamic imports only
import { Chatbot } from '@patternfly/chatbot/dist/dynamic/Chatbot';
// NOT: import { Chatbot } from '@patternfly/chatbot';
```

#### Type Errors

```bash
# Ensure all types are properly defined
# Check chat.ts for interface definitions
```

### Runtime Issues

#### API Key Not Working

1. Verify key has model permissions
2. Check key hasn't expired or been revoked
3. Ensure model is available in user's subscription

#### LiteLLM Connection Issues

1. Check network connectivity
2. Verify LiteLLM service is running
3. Check CORS configuration for direct calls

## Future Enhancements

### Planned Features

1. **Streaming Support**: Real-time token streaming
2. **Conversation Tabs**: Multiple parallel conversations
3. **Model Comparison**: Side-by-side testing
4. **Advanced Analytics**: Performance dashboards
5. **Team Collaboration**: Shared prompt libraries

### Technical Improvements

1. **Service Workers**: Offline support
2. **WebSockets**: Real-time features
3. **IndexedDB**: Large conversation storage
4. **Progressive Web App**: Mobile app-like experience

## Contributing

### Code Style Guidelines

1. Follow existing TypeScript patterns
2. Use PatternFly 6 components exclusively
3. Maintain comprehensive error handling
4. Include accessibility attributes
5. Add unit tests for new features

### Development Workflow

1. Create feature branch from main
2. Implement changes with tests
3. Run lint and type checking
4. Test accessibility compliance
5. Update documentation
6. Submit pull request
