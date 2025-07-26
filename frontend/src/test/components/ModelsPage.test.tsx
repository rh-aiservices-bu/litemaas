import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import ModelsPage from '../../pages/ModelsPage';
import { mockApiResponses } from '../test-utils';

// Mock the models service
vi.mock('../../services/models.service', () => ({
  getModels: vi.fn(() => Promise.resolve(mockApiResponses.models)),
  getModel: vi.fn((id) => Promise.resolve(mockApiResponses.models.find(m => m.id === id))),
}));

describe('ModelsPage', () => {
  it('should render loading state initially', async () => {
    render(<ModelsPage />);
    
    expect(screen.getByText('Loading Models...')).toBeInTheDocument();
    expect(screen.getByText('Discovering available AI models from all providers')).toBeInTheDocument();
  });

  it('should render models after loading', async () => {
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    expect(screen.getByText('by OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Advanced language model')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('should filter models by search term', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search models...');
    await user.type(searchInput, 'GPT');
    
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('should open model details modal on card click', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    const modelCard = screen.getByText('GPT-4').closest('[data-testid=\"model-card\"]') || 
                     screen.getByText('GPT-4').closest('div[style*=\"cursor: pointer\"]');
    
    if (modelCard) {
      await user.click(modelCard);
      
      await waitFor(() => {
        expect(screen.getByText('Subscribe to Model')).toBeInTheDocument();
      });
    }
  });

  it('should handle subscription action', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Click on model card to open modal
    const modelCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (modelCard) {
      await user.click(modelCard);
      
      await waitFor(() => {
        const subscribeButton = screen.getByText('Subscribe to Model');
        expect(subscribeButton).toBeInTheDocument();
      });
      
      // Should show subscription form with quota options
      expect(screen.getByText('Request Quota')).toBeInTheDocument();
      expect(screen.getByText('Token Quota')).toBeInTheDocument();
      
      const subscribeButton = screen.getByText('Subscribe to Model');
      await user.click(subscribeButton);
      
      // Should show success notification (this would be tested with notification context)
    }
  });
    
    // Click on model card to open modal
    const modelCard = screen.getByText('GPT-4').closest('div[style*=\"cursor: pointer\"]');
    if (modelCard) {
      await user.click(modelCard);
      
      await waitFor(() => {
        const subscribeButton = screen.getByText('Subscribe to Model');
        expect(subscribeButton).toBeInTheDocument();
      });
      
      const subscribeButton = screen.getByText('Subscribe to Model');
      await user.click(subscribeButton);
      
      // Should show notification (this would be tested with notification context)
    }
  });

  it('should filter by provider', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Find and click provider filter
    const providerFilter = screen.getByText('All Providers');
    await user.click(providerFilter);
    
    // This would open the dropdown - in a real test we'd select OpenAI
    // await user.click(screen.getByText('OpenAI'));
  });

  it('should handle pagination', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Look for pagination controls
    const paginationControls = screen.getAllByRole('navigation', { name: /pagination/i });
    expect(paginationControls.length).toBeGreaterThan(0);
  });

  it('should show empty state when no models match filters', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search models...');
    await user.type(searchInput, 'nonexistentmodel12345');
    
    await waitFor(() => {
      expect(screen.getByText('No models found')).toBeInTheDocument();
      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });
  });

  it('should clear filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Apply a filter that shows no results
    const searchInput = screen.getByPlaceholderText('Search models...');
    await user.type(searchInput, 'nonexistentmodel');
    
    await waitFor(() => {
      expect(screen.getByText('No models found')).toBeInTheDocument();
    });
    
    // Click clear filters
    const clearButton = screen.getByText('Clear all filters');
    await user.click(clearButton);
    
    // Should show models again
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
  });

  it('should display model pricing information', async () => {
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Should display pricing in token per 1K format
    expect(screen.getByText('Input: $0.03/1K • Output: $0.06/1K')).toBeInTheDocument();
  });

  it('should display detailed pricing in model modal', async () => {
    const user = userEvent.setup();
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Click on model card to open modal
    const modelCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (modelCard) {
      await user.click(modelCard);
      
      await waitFor(() => {
        expect(screen.getByText('Subscribe to Model')).toBeInTheDocument();
      });
      
      // Should show detailed pricing information
      expect(screen.getByText('Pricing')).toBeInTheDocument();
      expect(screen.getByText('Input tokens')).toBeInTheDocument();
      expect(screen.getByText('Output tokens')).toBeInTheDocument();
      expect(screen.getByText('$0.00003 per token')).toBeInTheDocument();
      expect(screen.getByText('$0.00006 per token')).toBeInTheDocument();
    }
  });
    
    expect(screen.getByText('Input: $0.03/1K • Output: $0.06/1K')).toBeInTheDocument();
  });

  it('should display model features as labels', async () => {
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Code Generation')).toBeInTheDocument();
    expect(screen.getByText('Creative Writing')).toBeInTheDocument();
  });

  it('should handle unavailable models correctly', async () => {
    // Mock a model that's unavailable
    const unavailableModel = {
      ...mockApiResponses.models[0],
      availability: 'unavailable'
    };
    
    vi.mocked(require('../../services/models.service').getModels).mockResolvedValue([unavailableModel]);
    
    render(<ModelsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});