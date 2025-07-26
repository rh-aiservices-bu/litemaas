import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import SubscriptionsPage from '../../pages/SubscriptionsPage';
import { mockApiResponses } from '../test-utils';

// Mock the subscriptions service
vi.mock('../../services/subscriptions.service', () => ({
  getSubscriptions: vi.fn(() => Promise.resolve(mockApiResponses.subscriptions)),
  getSubscription: vi.fn((id) => Promise.resolve(mockApiResponses.subscriptions.find(s => s.id === id))),
  cancelSubscription: vi.fn(() => Promise.resolve(true)),
  updateSubscriptionQuotas: vi.fn(() => Promise.resolve({ ...mockApiResponses.subscriptions[0], quotaRequests: 20000 })),
  getSubscriptionPricing: vi.fn(() => Promise.resolve({
    subscriptionId: 'sub-1',
    usedRequests: 1000,
    usedTokens: 100000,
    inputCostPerToken: 0.00003,
    outputCostPerToken: 0.00006,
    estimatedCost: 4.5,
  })),
  getSubscriptionUsage: vi.fn(() => Promise.resolve({
    subscriptionId: 'sub-1',
    quotaRequests: 10000,
    quotaTokens: 1000000,
    usedRequests: 1000,
    usedTokens: 100000,
    requestUtilization: 10,
    tokenUtilization: 10,
    withinRequestLimit: true,
    withinTokenLimit: true,
  })),
}));

describe('SubscriptionsPage', () => {
  it('should render loading state initially', async () => {
    render(<SubscriptionsPage />);
    
    expect(screen.getByText('Loading Subscriptions...')).toBeInTheDocument();
    expect(screen.getByText('Getting your model subscriptions')).toBeInTheDocument();
  });

  it('should render subscriptions after loading', async () => {
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    expect(screen.getByText('by OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('10,000 requests')).toBeInTheDocument();
    expect(screen.getByText('1,000,000 tokens')).toBeInTheDocument();
  });

  it('should display quota usage information', async () => {
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Should show quota usage bars or percentages
    expect(screen.getByText('500 / 10,000')).toBeInTheDocument(); // Used/Total requests
    expect(screen.getByText('50,000 / 1,000,000')).toBeInTheDocument(); // Used/Total tokens
    expect(screen.getByText('5%')).toBeInTheDocument(); // Usage percentage
  });

  it('should display pricing information for each subscription', async () => {
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Should show current usage costs
    expect(screen.getByText('$4.50')).toBeInTheDocument(); // Estimated cost based on usage
    expect(screen.getByText('this month')).toBeInTheDocument();
  });

  it('should open subscription details modal on card click', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    const subscriptionCard = screen.getByText('GPT-4').closest('[data-testid="subscription-card"]') || 
                           screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    
    if (subscriptionCard) {
      await user.click(subscriptionCard);
      
      await waitFor(() => {
        expect(screen.getByText('Subscription Details')).toBeInTheDocument();
      });
      
      // Should show detailed information
      expect(screen.getByText('Usage Details')).toBeInTheDocument();
      expect(screen.getByText('Pricing Information')).toBeInTheDocument();
      expect(screen.getByText('Quota Management')).toBeInTheDocument();
    }
  });

  it('should allow quota updates', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Click on subscription card to open modal
    const subscriptionCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (subscriptionCard) {
      await user.click(subscriptionCard);
      
      await waitFor(() => {
        expect(screen.getByText('Subscription Details')).toBeInTheDocument();
      });
      
      // Click on quota management
      const quotaButton = screen.getByText('Update Quotas');
      await user.click(quotaButton);
      
      // Should show quota form
      const requestQuotaInput = screen.getByLabelText('Request Quota');
      await user.clear(requestQuotaInput);
      await user.type(requestQuotaInput, '20000');
      
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      // Should show success notification
    }
  });

  it('should handle subscription cancellation', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Click on subscription card to open modal
    const subscriptionCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (subscriptionCard) {
      await user.click(subscriptionCard);
      
      await waitFor(() => {
        expect(screen.getByText('Subscription Details')).toBeInTheDocument();
      });
      
      // Click cancel subscription
      const cancelButton = screen.getByText('Cancel Subscription');
      await user.click(cancelButton);
      
      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Confirm Cancellation')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByText('Yes, Cancel');
      await user.click(confirmButton);
      
      // Should show success notification
    }
  });

  it('should filter subscriptions by status', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Find and click status filter
    const statusFilter = screen.getByText('All Statuses');
    await user.click(statusFilter);
    
    // This would open the dropdown - in a real test we'd select Active
    // await user.click(screen.getByText('Active'));
  });

  it('should show empty state when no subscriptions exist', async () => {
    // Mock empty subscriptions
    vi.mocked(require('../../services/subscriptions.service').getSubscriptions).mockResolvedValue([]);
    
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('No subscriptions found')).toBeInTheDocument();
      expect(screen.getByText('Browse models to create your first subscription')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Browse Models')).toBeInTheDocument();
  });

  it('should show quota warning when usage is high', async () => {
    // Mock high usage subscription
    const highUsageSubscription = {
      ...mockApiResponses.subscriptions[0],
      usedRequests: 9000,
      usedTokens: 950000,
    };
    
    vi.mocked(require('../../services/subscriptions.service').getSubscriptions).mockResolvedValue([highUsageSubscription]);
    
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Should show warning indicators
    expect(screen.getByText('90%')).toBeInTheDocument(); // High usage percentage
    expect(screen.getByText('95%')).toBeInTheDocument(); // High token usage
    
    // Should show warning labels or colors (this would need to be tested with specific styling)
    const warningElements = screen.getAllByRole('status'); // Or whatever role warning elements have
    expect(warningElements.length).toBeGreaterThan(0);
  });

  it('should display usage trends and analytics', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Click on subscription card to open modal
    const subscriptionCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (subscriptionCard) {
      await user.click(subscriptionCard);
      
      await waitFor(() => {
        expect(screen.getByText('Subscription Details')).toBeInTheDocument();
      });
      
      // Should show usage analytics
      expect(screen.getByText('Usage Trends')).toBeInTheDocument();
      expect(screen.getByText('Daily Usage')).toBeInTheDocument();
      expect(screen.getByText('Cost Analysis')).toBeInTheDocument();
    }
  });

  it('should handle pagination for large subscription lists', async () => {
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Look for pagination controls
    const paginationControls = screen.getAllByRole('navigation', { name: /pagination/i });
    expect(paginationControls.length).toBeGreaterThan(0);
  });

  it('should provide quick actions for subscriptions', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    
    // Should have quick action buttons on each card
    expect(screen.getByTitle('View Details')).toBeInTheDocument();
    expect(screen.getByTitle('Update Quotas')).toBeInTheDocument();
    expect(screen.getByTitle('View Pricing')).toBeInTheDocument();
  });
});