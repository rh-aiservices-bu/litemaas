# Chatbot Rules

Essential rules for PatternFly Chatbot implementation and integration patterns.

## Related Files

- [**Component Architecture**](../guidelines/component-architecture.md) - Chatbot component structure rules
- [**Styling Standards**](../guidelines/styling-standards.md) - CSS and styling best practices

## Installation Rules

### Required Installation

```bash
# ✅ Install PatternFly Chatbot package
npm install @patternfly/chatbot
```

### Required CSS Import

```jsx
// ✅ MUST import CSS - chatbot components require specific styling
import '@patternfly/chatbot/dist/css/main.css';
```

### Webpack Configuration (if needed)

```javascript
// stylePaths.js - Add to webpack if CSS not loading
module.exports = [require.resolve('@patternfly/chatbot/dist/css/main.css')];
```

## Import Rules

### Required Import Pattern

- ✅ **Use dynamic imports** - Import from `/dist/dynamic/` paths
- ❌ **Don't use standard imports** - May not work with current package structure

```jsx
// ✅ Correct - Use dynamic imports
import { Chatbot } from '@patternfly/chatbot/dist/dynamic/Chatbot';
import { ChatbotContent } from '@patternfly/chatbot/dist/dynamic/ChatbotContent';
import { MessageBox } from '@patternfly/chatbot/dist/dynamic/MessageBox';
import { Message } from '@patternfly/chatbot/dist/dynamic/Message';

// ❌ Wrong - Standard imports may not work
import { Chatbot, ChatbotContent } from '@patternfly/chatbot';
```

## Implementation Rules

### Required Component Structure

- ✅ **Use standard chatbot hierarchy** - Chatbot > ChatbotContent > MessageBox + ChatbotFooter
- ✅ **Reference official demos** - Use PatternFly demo source code as templates
- ❌ **Don't create custom chat UI** - Use PatternFly chatbot components

```jsx
// ✅ Required chatbot structure
<Chatbot>
  <ChatbotContent>
    <ChatbotWelcomePrompt title="Assistant" description="How can I help?" />
    <MessageBox>
      {messages.map((message) => (
        <Message key={message.id} role={message.role} content={message.content} />
      ))}
    </MessageBox>
  </ChatbotContent>
  <ChatbotFooter>
    <MessageBar onSendMessage={handleSendMessage} />
  </ChatbotFooter>
</Chatbot>
```

### Message State Rules

- ✅ **Use proper message roles** - 'user', 'assistant', 'system'
- ✅ **Include timestamps** - For message ordering and display
- ✅ **Handle loading states** - Show indicators during API calls
- ✅ **Handle error states** - Show error messages with retry options

```jsx
// ✅ Required message structure
const createMessage = (content, role) => ({
  id: generateId(),
  content,
  role, // 'user' | 'assistant' | 'system'
  timestamp: new Date(),
  status: 'sent',
});
```

### Demo Implementation Rules

- ✅ **Study official demos** - [Basic](https://www.patternfly.org/patternfly-ai/chatbot/overview/demo/basic-chatbot) and [Embedded](https://www.patternfly.org/patternfly-ai/chatbot/overview/demo/embedded-chatbot)
- ✅ **Use demo source code** - Copy patterns from "View Code" sections
- ✅ **Follow demo structure** - Don't deviate from proven patterns

### Integration Rules

- ✅ **Use with PatternFly layout** - Integrate in PageSection, Modal, or Card
- ✅ **Handle responsive design** - Chatbot must work on all screen sizes
- ❌ **Don't create standalone chatbot pages** - Integrate with app layout

```jsx
// ✅ Required integration pattern
<PageSection hasBodyWrapper>
  <div style={{ height: '600px' }}>
    <Chatbot>{/* Chatbot content */}</Chatbot>
  </div>
</PageSection>
```

## Accessibility Rules

### Required Accessibility

- ✅ **Use proper ARIA labels** - For screen reader support
- ✅ **Implement keyboard navigation** - Full keyboard accessibility
- ✅ **Use semantic roles** - role="application", role="log"
- ✅ **Auto-scroll to new messages** - For better UX

```jsx
// ✅ Required accessibility pattern
<Chatbot role="application" aria-label="AI Assistant">
  <MessageBox role="log" aria-live="polite" aria-label="Chat messages">
    {messages.map((message) => (
      <Message aria-label={`${message.role} message: ${message.content}`} />
    ))}
  </MessageBox>
</Chatbot>
```

## Essential Do's and Don'ts

### ✅ Do's

- Import CSS from `@patternfly/chatbot/dist/css/main.css`
- Use dynamic imports for chatbot components
- Reference official PatternFly demo pages for implementation
- Provide proper ARIA labels and roles for accessibility
- Handle loading states during message processing
- Implement proper error handling for API failures
- Use semantic message roles (user, assistant, system)

### ❌ Don'ts

- Skip CSS imports - chatbot components require specific styling
- Ignore demo source code from PatternFly documentation
- Create custom chat UI when PatternFly components exist
- Skip accessibility considerations for screen readers
- Hardcode chatbot dimensions without responsive design
- Mix different chatbot libraries with PatternFly Chatbot

## Common Issues

### Styling Issues

- **Missing styles**: Ensure CSS is imported in main app file
- **Webpack config**: Add CSS path to stylePaths.js if needed

### Component Issues

- **Import errors**: Use dynamic import paths `/dist/dynamic/`
- **Component not found**: Verify package is installed and paths are correct

### Performance Issues

- **Long conversations**: Implement message virtualization
- **Memory leaks**: Clean up event listeners and subscriptions

## Quick Reference

- **[Chatbot Overview](https://www.patternfly.org/patternfly-ai/chatbot/overview)** - Main documentation
- **[Basic Demo](https://www.patternfly.org/patternfly-ai/chatbot/overview/demo/basic-chatbot)** - Simple implementation
- **[Embedded Demo](https://www.patternfly.org/patternfly-ai/chatbot/overview/demo/embedded-chatbot)** - Embedded pattern
- **[Local Documentation](../resources/local-files.md#patternfly-chatbot-txt)** - Project-specific context

**Note**: This chatbot guidance takes precedence over general PatternFly patterns. Always consult the latest PatternFly Chatbot documentation and demo source code.

## Reference Documentation

- [PatternFly Chatbot on PatternFly.org](https://www.patternfly.org/patternfly-ai/chatbot/overview)
- [PatternFly Chatbot GitHub Repository](https://github.com/patternfly/chatbot)

> For the most up-to-date documentation and code examples, consult both PatternFly.org and the official GitHub repository. When using AI tools for PatternFly 6, use the local documentation and PatternFly.org. Note: Context7 may have outdated PatternFly versions - use it for other libraries but NOT for PatternFly 6.

### Further Reading

- **[PatternFly Chatbot Docs](https://www.patternfly.org/chatbot/overview/)**
- **[Component API](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/components/ChipGroup)** - ChipGroup component API for tags
- **[Accessibility Guide](https://www.patternfly.org/get-started/accessibility-guide)**
