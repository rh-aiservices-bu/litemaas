import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import ApiKeysPage from '../../pages/ApiKeysPage';
import { mockApiResponses } from '../test-utils';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

// Mock the API service
vi.mock('../../services/api.ts', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ApiKeysPage', () => {
  it('should render loading state initially', async () => {
    render(<ApiKeysPage />);

    expect(screen.getByText('Loading API Keys...')).toBeInTheDocument();
    expect(screen.getByText('Retrieving your API key information')).toBeInTheDocument();
  });

  it('should render API keys table after loading', async () => {
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    expect(screen.getByText('sk-...7x2K')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('1,000 requests')).toBeInTheDocument();
    expect(screen.getByText('5,000/min')).toBeInTheDocument();
  });

  it('should open create API key modal', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Create API Key')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create API Key');
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create API Key')).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
  });

  it('should create new API key', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Create API Key')).toBeInTheDocument();
    });

    // Open create modal
    const createButton = screen.getByText('Create API Key');
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'Test API Key');

    const descriptionInput = screen.getByLabelText(/description/i);
    await user.type(descriptionInput, 'Test description');

    // Submit form
    const submitButton = screen.getByText('Create API Key');
    await user.click(submitButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  it('should validate form fields', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Create API Key')).toBeInTheDocument();
    });

    // Open create modal
    const createButton = screen.getByText('Create API Key');
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    // Try to submit without name
    const submitButton = screen.getByText('Create API Key');
    await user.click(submitButton);

    // Should show validation error in notification
  });

  it('should toggle API key visibility', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    // Should show preview by default
    expect(screen.getByText('sk-...7x2K')).toBeInTheDocument();

    // Find and click the eye icon to show full key
    const eyeIcon = screen.getByRole('button', { name: /show key/i });
    await user.click(eyeIcon);

    // Should show full key (mocked in test-utils)
    await waitFor(() => {
      expect(screen.getByText(mockApiResponses.apiKeys[0].keyPreview)).toBeInTheDocument();
    });
  });

  it('should handle undefined keyPrefix gracefully', async () => {
    // Mock API response with undefined keyPrefix
    const { apiClient } = await import('../../services/api');
    const mockResponse = {
      data: [
        {
          id: 'test-key-undefined-prefix',
          name: 'Test Key with Undefined Prefix',
          keyPrefix: undefined, // This simulates the bug scenario
          liteLLMKey: null,
          liteLLMKeyId: null,
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          models: ['gpt-4'],
          modelDetails: [{ id: 'gpt-4', name: 'GPT-4', provider: 'openai' }],
          metadata: { permissions: ['read'] },
        },
      ],
      total: 1,
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Key with Undefined Prefix')).toBeInTheDocument();
    });

    // Should show fallback instead of "undefined..."
    expect(screen.getByText('sk-****...')).toBeInTheDocument();
    expect(screen.queryByText('undefined...')).not.toBeInTheDocument();
  });

  it('should copy API key to clipboard', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    // Find and click copy button
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i });
    await user.click(copyButton);

    // Should call clipboard API
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('should open API key details modal', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    // Click view button
    const viewButton = screen.getByText('View');
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('API Key Details')).toBeInTheDocument();
      expect(screen.getByText('Usage Example')).toBeInTheDocument();
    });
  });

  it('should delete API key with confirmation', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete API Key')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    // Confirm deletion
    const confirmButton = screen.getByText('Delete Key');
    await user.click(confirmButton);
  });

  it('should show empty state when no API keys exist', async () => {
    // Mock empty API keys response
    vi.mocked(require('../../services/api.ts').apiClient.get).mockResolvedValue({
      data: { data: [] },
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('No API keys found')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first API key to start using LiteMaaS services.'),
      ).toBeInTheDocument();
    });
  });

  it('should display usage statistics correctly', async () => {
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    expect(screen.getByText('1,000 requests')).toBeInTheDocument();
    expect(screen.getByText('5,000/min')).toBeInTheDocument();
  });

  it('should handle different API key statuses', async () => {
    // Mock API keys with different statuses
    const apiKeysWithStatuses = [
      { ...mockApiResponses.apiKeys[0], status: 'active' },
      { ...mockApiResponses.apiKeys[0], id: 'key-2', status: 'revoked' },
      { ...mockApiResponses.apiKeys[0], id: 'key-3', status: 'expired' },
    ];

    vi.mocked(require('../../services/api.ts').apiClient.get).mockResolvedValue({
      data: { data: apiKeysWithStatuses },
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Revoked')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });
  });

  it('should disable delete button for non-active keys', async () => {
    // Mock a revoked API key
    const revokedKey = { ...mockApiResponses.apiKeys[0], status: 'revoked' };

    vi.mocked(require('../../services/api.ts').apiClient.get).mockResolvedValue({
      data: { data: [revokedKey] },
    });

    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('Revoked')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    expect(deleteButton).toBeDisabled();
  });
});
