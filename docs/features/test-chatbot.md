# Test Chatbot Feature

## Overview

The Test Chatbot allows you to interactively test your API keys and models through a chat interface built with PatternFly 6 Chatbot components. This feature provides a user-friendly way to validate your model access, test different configurations, and analyze responses before integrating them into your applications.

## Features

### Configuration Panel

- **API Key Selection**: Choose from your created API keys with model count badges
- **Model Selection**: Automatically filtered by your selected API key's available models
- **Advanced Settings**:
  - Temperature control (0-2) for response creativity
  - Max tokens limit for response length
  - System prompt configuration for assistant behavior

### Quick Test Templates

- **Code Generation**: Test code writing capabilities with comprehensive prompts
- **Translation**: Test language translation accuracy and cultural considerations
- **Summarization**: Test text summarization and comprehension abilities
- **JSON Response**: Test structured output formatting
- **Creative Writing**: Test narrative and creative capabilities
- **Problem Solving**: Test logical reasoning and analytical skills
- **Data Analysis**: Test mathematical and statistical analysis
- **Role Playing**: Test persona adoption and customer service scenarios

### Response Analytics

- **Token Usage**: Detailed breakdown of prompt, completion, and total tokens
- **Response Time**: Accurate timing measurement for performance analysis
- **Cost Estimation**: Real-time cost calculation based on model pricing
- **Raw Response Viewer**: Inspect full API response for debugging

### Conversation Management

- **Message History**: Full conversation display with timestamps
- **Clear Conversation**: Reset chat history for new tests
- **Export Options**:
  - JSON format for technical analysis
  - Markdown format for documentation
  - Custom filename generation with timestamps

### Custom Prompt Management

- **Save Prompts**: Save frequently used prompts for quick access
- **Organize Prompts**: Separate built-in and custom prompt categories
- **Delete Prompts**: Remove custom prompts (built-in prompts protected)
- **Prompt Library**: Access to comprehensive built-in test templates

## Getting Started

### Prerequisites

- Active LiteMaaS account with authenticated access
- At least one active model subscription
- At least one created API key with model access

### Accessing the Test Chatbot

1. Navigate to "Test Chatbot" from the main navigation menu
2. The page is located at `/chatbot` in the application

### Basic Usage

#### 1. Initial Setup

1. **Select API Key**: Choose from your available API keys in the dropdown
   - Each key shows the number of available models as a badge
   - Only keys with model access will be functional
2. **Select Model**: Choose from models available to your selected API key
   - Models are automatically filtered based on API key permissions
   - Unavailable models will not appear in the dropdown

#### 2. Configure Settings (Optional)

1. **Expand Advanced Settings** panel if needed
2. **Temperature**: Adjust for response creativity
   - 0.0 = Most deterministic and focused
   - 1.0 = Balanced creativity and consistency
   - 2.0 = Maximum creativity and randomness
3. **Max Tokens**: Set maximum response length (1-128,000)
4. **System Prompt**: Define assistant behavior (optional)

#### 3. Start Testing

1. **Type your message** in the input field at the bottom
2. **Click Send** or press Enter to submit
3. **View response** in the message history area
4. **Check analytics** in the response info panel on the right

### Advanced Usage

#### Using Quick Test Templates

1. **Click any template button** (Code Generation, Translation, etc.)
2. The **prompt text** will populate the input field
3. **Customize if needed** before sending
4. **Save custom variations** using the "Save Prompt" button

#### Saving Custom Prompts

1. **Type or modify** a prompt you want to save
2. **Click "Save Prompt"** button
3. **Enter a name** and optional description
4. **Click "Save"** to add to your prompt library
5. **Access later** from "My Prompts" dropdown

#### Exporting Conversations

1. **Click "Export"** button after testing
2. **Choose format**: JSON (technical) or Markdown (readable)
3. **Click "Download"** to save the file
4. **File includes**:
   - Complete message history
   - Configuration settings used
   - Performance metrics
   - Timestamps and metadata

#### Analyzing Responses

- **Response Time**: Monitor API latency for performance planning
- **Token Usage**: Track consumption for cost management
- **Cost Estimation**: Real-time pricing based on model rates
- **Raw Response**: Access complete API response for debugging

## Troubleshooting

### Common Issues

#### "Please select an API key"

- **Cause**: No API key selected
- **Solution**: Choose an API key from the dropdown
- **Prevention**: Ensure you have created at least one API key

#### "Please select a model"

- **Cause**: No model selected or API key has no model access
- **Solution**:
  - Select a model from the dropdown
  - Verify your API key has model permissions
  - Check your model subscriptions are active

#### "Authentication failed"

- **Cause**: Invalid or expired API key
- **Solution**:
  - Verify the API key is active and not revoked
  - Check API key hasn't expired
  - Try refreshing the API key using the "Show Key" feature

#### "Rate limit exceeded"

- **Cause**: Too many requests in a short time
- **Solution**: Wait before sending more messages
- **Prevention**: Monitor request frequency, especially with high-traffic testing

#### "Request timed out"

- **Cause**: Network issues or server overload
- **Solution**:
  - Check your internet connection
  - Try again in a few moments
  - Try a different model if available

#### "Server error"

- **Cause**: Issue with the LiteLLM service
- **Solution**:
  - Wait and try again
  - Check if other models work
  - Contact support if problem persists

### Model-Specific Issues

#### Model Not Available

- **Verify subscription**: Ensure you have an active subscription to the model
- **Check API key permissions**: Confirm the API key has access to the model
- **Model status**: Some models may be temporarily unavailable

#### Unexpected Responses

- **Check system prompt**: Ensure system prompt doesn't conflict with your request
- **Adjust temperature**: Lower temperature for more consistent results
- **Model limitations**: Different models have different capabilities and response styles

## Best Practices

### Testing Strategy

1. **Start Simple**: Begin with basic prompts to verify connectivity
2. **Test Systematically**: Use built-in templates to test different capabilities
3. **Document Results**: Export conversations for later analysis
4. **Compare Models**: Test the same prompt with different models
5. **Iterate Settings**: Experiment with temperature and token limits

### Cost Management

1. **Monitor Usage**: Watch token consumption in the response info panel
2. **Set Token Limits**: Use max tokens setting to control costs
3. **Choose Models Wisely**: Consider cost per token when selecting models
4. **Export Data**: Save results to avoid re-running expensive tests

### Security Considerations

1. **Protect API Keys**: Don't share screenshots showing full API keys
2. **Sensitive Data**: Avoid testing with confidential information
3. **Rate Limiting**: Respect rate limits to maintain service quality
4. **Key Rotation**: Regularly rotate API keys for security

## Integration Examples

### Using Test Results in Applications

1. **Copy Settings**: Use successful temperature and token settings in your apps
2. **Prompt Engineering**: Refine prompts based on test results
3. **Model Selection**: Choose optimal models based on performance and cost
4. **Error Handling**: Plan error handling based on observed failure modes

### Development Workflow

1. **Prototype Prompts**: Test and refine prompts before coding
2. **Validate Models**: Ensure models meet requirements before integration
3. **Performance Planning**: Use response time data for architecture decisions
4. **Cost Estimation**: Use token usage data for budget planning

## Keyboard Shortcuts

- **Enter**: Send message (when input field is focused)
- **Shift + Enter**: New line in input field
- **Tab**: Navigate between interface elements
- **Escape**: Close open modals or panels

## Accessibility Features

The Test Chatbot is designed to be fully accessible:

- **Screen Reader Support**: All elements have proper ARIA labels
- **Keyboard Navigation**: Complete keyboard access to all functionality
- **High Contrast**: Works with high contrast mode
- **Focus Management**: Clear focus indicators and logical tab order
- **Semantic HTML**: Proper heading structure and landmarks

## Support and Feedback

If you encounter issues or have suggestions for improvement:

1. Check the troubleshooting section above
2. Verify your API key and model subscriptions
3. Contact support with specific error messages and steps to reproduce
4. Include export data when reporting response-related issues
