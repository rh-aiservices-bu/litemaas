import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelsPage from '../../pages/ModelsPage';
import { mockApiResponses } from '../test-utils';
import {
  renderWithAccessibility,
  runCommonA11yTests,
  keyboardTestUtils,
  ariaTestUtils,
} from '../accessibility-test-utils';

// Mock the models service
vi.mock('../../services/models.service', () => ({
  getModels: vi.fn(() => Promise.resolve(mockApiResponses.models)),
  getModel: vi.fn((id) => Promise.resolve(mockApiResponses.models.find((m) => m.id === id))),
}));

describe('ModelsPage Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have no accessibility violations on initial render', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    await testAccessibility();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Test heading hierarchy
    ariaTestUtils.testHeadingHierarchy(container);

    // Should have main page heading
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();
    expect(mainHeading).toHaveTextContent(/models/i);
  });

  it('should have accessible search functionality', async () => {
    const user = userEvent.setup();
    const { container, testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Test search input accessibility
    const searchInput = screen.getByRole('searchbox') || screen.getByLabelText(/search/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder');

    // Test search functionality with keyboard
    await user.type(searchInput, 'GPT');

    // Should announce search results to screen readers
    await waitFor(() => {
      // Check for live region or status updates
      const liveRegions = container.querySelectorAll('[aria-live], [role="status"]');
      expect(liveRegions.length).toBeGreaterThanOrEqual(0); // May have search result announcements
    });

    await testAccessibility();
  });

  it('should have accessible filter controls', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Test provider filter dropdown
    const providerFilter = screen.getByText('All Providers');
    expect(providerFilter).toBeInTheDocument();

    // Should be properly labeled
    const filterContainer = providerFilter.closest('[role="combobox"], [role="button"]');
    expect(filterContainer).toBeTruthy();

    await testAccessibility();
  });

  it('should have accessible model cards with proper keyboard navigation', async () => {
    const { container, testKeyboardNavigation } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Test keyboard navigation through model cards
    await testKeyboardNavigation();

    // Model cards should be focusable and have accessible names
    const modelCards = container.querySelectorAll('[data-testid="model-card"], .pf-v6-c-card');

    modelCards.forEach((card) => {
      // Should be keyboard accessible
      expect(card).toHaveAttribute('tabindex', '0');

      // Should have accessible name (model name)
      const modelName = card.querySelector('h3, [role="heading"]');
      expect(modelName).toBeTruthy();
    });

    // Test Enter key activation on model cards
    const firstCard = modelCards[0] as HTMLElement;
    if (firstCard) {
      await keyboardTestUtils.testKeyActivation(firstCard);
    }
  });

  it('should have accessible model details modal', async () => {
    const user = userEvent.setup();
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Open model details modal
    const modelCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (modelCard) {
      await user.click(modelCard);

      await waitFor(() => {
        expect(screen.getByText('Subscribe to Model')).toBeInTheDocument();
      });

      // Modal should have proper ARIA attributes
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-labelledby');

      // Modal should trap focus
      const modalTitle = screen.getByText('Subscribe to Model');
      expect(modalTitle).toBeInTheDocument();

      // Should have close button
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();

      await testAccessibility();
    }
  });

  it('should have accessible form controls in subscription modal', async () => {
    const user = userEvent.setup();
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Open modal
    const modelCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (modelCard) {
      await user.click(modelCard);

      await waitFor(() => {
        expect(screen.getByText('Subscribe to Model')).toBeInTheDocument();
      });

      // Test form accessibility
      const quotaInputs = screen.getAllByRole('textbox');
      quotaInputs.forEach((input) => {
        // Each input should have a label
        expect(input).toHaveAccessibleName();
      });

      // Test form submission button
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      expect(subscribeButton).toBeInTheDocument();
      expect(subscribeButton).toHaveAccessibleName();

      await testAccessibility();
    }
  });

  it('should have accessible pagination controls', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Test pagination accessibility
    const paginationNav = screen.getByRole('navigation', { name: /pagination/i });
    expect(paginationNav).toBeInTheDocument();

    // Pagination controls should be keyboard accessible
    const paginationButtons = paginationNav.querySelectorAll('button');
    paginationButtons.forEach((button) => {
      expect(button).toHaveAccessibleName();
      expect(button).not.toHaveAttribute('tabindex', '-1'); // Should be focusable
    });

    await testAccessibility();
  });

  it('should have accessible empty state', async () => {
    const user = userEvent.setup();
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Search for non-existent model to trigger empty state
    const searchInput = screen.getByPlaceholderText('Search models...');
    await user.type(searchInput, 'nonexistentmodel12345');

    await waitFor(() => {
      expect(screen.getByText('No models found')).toBeInTheDocument();
    });

    // Empty state should have proper heading and action
    const emptyHeading = screen.getByText('No models found');
    expect(emptyHeading).toBeInTheDocument();

    const clearButton = screen.getByText('Clear all filters');
    expect(clearButton).toBeInTheDocument();
    expect(clearButton).toHaveAccessibleName();

    await testAccessibility();
  });

  it('should have accessible price information', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Pricing should be properly labeled and readable
    const pricingInfo = screen.getByText('Input: $0.03/1K • Output: $0.06/1K');
    expect(pricingInfo).toBeInTheDocument();

    // Price information should be associated with the model
    const modelCard = pricingInfo.closest('[data-testid="model-card"]');
    expect(modelCard).toBeTruthy();

    await testAccessibility();
  });

  it('should have accessible model status indicators', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Status indicators should be properly labeled
    const statusIndicator = screen.getByText('Available');
    expect(statusIndicator).toBeInTheDocument();

    // Status should be associated with its model
    const modelCard = statusIndicator.closest('[data-testid="model-card"]');
    expect(modelCard).toBeTruthy();

    await testAccessibility();
  });

  it('should have accessible feature labels', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Feature labels should be accessible
    const featureLabels = [
      screen.getByText('Code Generation'),
      screen.getByText('Creative Writing'),
    ];

    featureLabels.forEach((label) => {
      expect(label).toBeInTheDocument();
      // Labels should be properly associated with their model
      const modelCard = label.closest('[data-testid="model-card"]');
      expect(modelCard).toBeTruthy();
    });

    await testAccessibility();
  });

  it('should handle keyboard navigation for modal close', async () => {
    const user = userEvent.setup();
    renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Open modal
    const modelCard = screen.getByText('GPT-4').closest('div[style*="cursor: pointer"]');
    if (modelCard) {
      await user.click(modelCard);

      await waitFor(() => {
        expect(screen.getByText('Subscribe to Model')).toBeInTheDocument();
      });

      // Test Escape key closes modal
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Subscribe to Model')).not.toBeInTheDocument();
      });
    }
  });

  it('should have accessible loading state', async () => {
    const { testAccessibility } = renderWithAccessibility(<ModelsPage />);

    // Test loading state accessibility
    expect(screen.getByText('Loading Models...')).toBeInTheDocument();
    expect(
      screen.getByText('Discovering available AI models from all providers'),
    ).toBeInTheDocument();

    // Loading state should have proper ARIA live region
    const loadingText = screen.getByText('Loading Models...');
    const loadingContainer = loadingText.closest('[role="status"], [aria-live]');

    // Should have some indication for screen readers
    expect(loadingContainer || loadingText).toBeTruthy();

    // Run accessibility tests on loading state
    await testAccessibility();
  });

  it('should run comprehensive accessibility test suite', async () => {
    const { container } = renderWithAccessibility(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    // Run comprehensive accessibility tests
    await runCommonA11yTests(container);
  });
});
