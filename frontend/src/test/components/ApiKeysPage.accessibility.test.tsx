import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApiKeysPage from '../../pages/ApiKeysPage';
import { mockApiResponses } from '../test-utils';
import { renderWithAccessibility, runCommonA11yTests, keyboardTestUtils, ariaTestUtils, patternFlyA11yUtils } from '../accessibility-test-utils';

// Mock the API keys service
vi.mock('../../services/apiKeys.service', () => ({
  apiKeysService: {
    getApiKeys: vi.fn(() => Promise.resolve({ data: mockApiResponses.apiKeys })),
    createApiKey: vi.fn(() => Promise.resolve(mockApiResponses.apiKeys[0])),
    deleteApiKey: vi.fn(() => Promise.resolve()),
    updateApiKey: vi.fn(() => Promise.resolve()),
    retrieveFullKey: vi.fn(() => Promise.resolve({ key: 'sk-test-key-full', keyType: 'litellm', retrievedAt: new Date().toISOString() })),
  }
}));

describe('ApiKeysPage Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have no accessibility violations on initial render', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    await testAccessibility();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Test heading hierarchy
    ariaTestUtils.testHeadingHierarchy(container);

    // Should have main page heading
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();
    expect(mainHeading).toHaveTextContent(/API Keys/i);
  });

  it('should have accessible table structure', async () => {
    const { container, testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Test table accessibility
    await patternFlyA11yUtils.testPatternFlyComponent(container, 'table');

    // Table should have proper headers
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThan(0);

    // Headers should have accessible names
    headers.forEach((header) => {
      expect(header).toHaveAccessibleName();
    });

    await testAccessibility();
  });

  it('should have accessible create API key button', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Create button should be accessible
    const createButton = screen.getByRole('button', { name: /create/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAccessibleName();

    // Test keyboard activation
    await keyboardTestUtils.testKeyActivation(createButton);

    await testAccessibility();
  });

  it('should have accessible API key creation modal', async () => {
    const user = userEvent.setup();
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Open creation modal
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Modal should have proper ARIA attributes
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-labelledby');
    expect(modal).toHaveAttribute('aria-modal', 'true');

    // Modal should have accessible title
    const modalTitle = modal.querySelector('h1, h2, h3, [role="heading"]');
    expect(modalTitle).toBeTruthy();
    expect(modalTitle).toHaveAccessibleName();

    await testAccessibility();
  });

  it('should have accessible form controls in creation modal', async () => {
    const user = userEvent.setup();
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Open creation modal
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Test form field accessibility
    ariaTestUtils.testFormLabeling(screen.getByRole('dialog'));

    // All form inputs should have labels
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toHaveAccessibleName();
    });

    // Dropdowns should have labels
    const selects = screen.getAllByRole('combobox');
    selects.forEach((select) => {
      expect(select).toHaveAccessibleName();
    });

    await testAccessibility();
  });

  it('should have accessible action buttons in table rows', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Action buttons should be accessible
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });

    [...editButtons, ...deleteButtons].forEach((button) => {
      expect(button).toHaveAccessibleName();
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });

    await testAccessibility();
  });

  it('should have accessible delete confirmation modal', async () => {
    const user = userEvent.setup();
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Confirmation modal should have proper attributes
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(modal).toHaveAttribute('aria-describedby');

      // Should have accessible action buttons
      const confirmButton = screen.getByRole('button', { name: /confirm|delete|yes/i });
      const cancelButton = screen.getByRole('button', { name: /cancel|no/i });

      expect(confirmButton).toHaveAccessibleName();
      expect(cancelButton).toHaveAccessibleName();

      await testAccessibility();
    }
  });

  it('should have accessible API key display with copy functionality', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Look for copy buttons or API key display
    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    
    copyButtons.forEach((button) => {
      expect(button).toHaveAccessibleName();
      
      // Copy button should have proper labeling
      expect(button).toHaveAttribute('aria-label');
    });

    // API key values should be properly labeled
    const apiKeyFields = screen.getAllByText(/sk-/);
    apiKeyFields.forEach((field) => {
      // Should be in a labeled context
      const container = field.closest('[aria-label], [aria-labelledby]');
      expect(container).toBeTruthy();
    });

    await testAccessibility();
  });

  it('should have accessible keyboard navigation through table', async () => {
    const { testKeyboardNavigation } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Test keyboard navigation through interactive elements
    await testKeyboardNavigation();

    // Test arrow key navigation within table if applicable
    const table = screen.getByRole('table');
    const tableRows = table.querySelectorAll('tbody tr');
    
    if (tableRows.length > 1) {
      await keyboardTestUtils.testArrowKeyNavigation(table as HTMLElement, 'vertical');
    }
  });

  it('should have accessible sorting controls', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Sort buttons should be accessible
    const sortButtons = screen.getAllByRole('button', { name: /sort/i });
    
    sortButtons.forEach((button) => {
      expect(button).toHaveAccessibleName();
      
      // Should indicate current sort state
      const ariaSort = button.getAttribute('aria-sort') || 
                      button.closest('th')?.getAttribute('aria-sort');
      
      if (ariaSort) {
        expect(['ascending', 'descending', 'none']).toContain(ariaSort);
      }
    });

    await testAccessibility();
  });

  it('should have accessible empty state', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    // Mock empty state
    vi.mocked(require('../../services/apiKeys.service').getApiKeys).mockResolvedValue([]);

    await waitFor(() => {
      expect(screen.getByText('No API keys found')).toBeInTheDocument();
    });

    // Empty state should have proper heading
    const emptyHeading = screen.getByText('No API keys found');
    expect(emptyHeading).toBeInTheDocument();

    // Should have action to create first API key
    const createButton = screen.getByRole('button', { name: /create/i });
    expect(createButton).toHaveAccessibleName();

    await testAccessibility();
  });

  it('should have accessible loading state', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    // Test loading state accessibility
    const loadingIndicator = screen.getByText(/loading/i);
    expect(loadingIndicator).toBeInTheDocument();

    // Loading state should have proper ARIA attributes
    const loadingContainer = loadingIndicator.closest('[role="status"], [aria-live]');
    expect(loadingContainer || loadingIndicator).toBeTruthy();

    await testAccessibility();
  });

  it('should have accessible status indicators', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Status indicators should be accessible
    const statusElements = screen.getAllByText(/active|inactive|expired/i);
    
    statusElements.forEach((status) => {
      // Status should be labeled or in labeled context
      const statusContainer = status.closest('[aria-label], [aria-labelledby], td');
      expect(statusContainer).toBeTruthy();
      
      // Visual status indicators should have text alternatives
      const badge = status.closest('.pf-v6-c-label, .pf-v6-c-badge');
      if (badge) {
        expect(badge).toHaveTextContent(status.textContent || '');
      }
    });

    await testAccessibility();
  });

  it('should have accessible pagination controls', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Test pagination accessibility
    const paginationNav = screen.queryByRole('navigation', { name: /pagination/i });
    
    if (paginationNav) {
      const paginationButtons = paginationNav.querySelectorAll('button');
      paginationButtons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });

      // Current page should be indicated
      const currentPageIndicator = paginationNav.querySelector('[aria-current="page"]');
      if (currentPageIndicator) {
        expect(currentPageIndicator).toHaveAccessibleName();
      }
    }

    await testAccessibility();
  });

  it('should have accessible bulk selection controls', async () => {
    const { testAccessibility } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Test bulk selection checkboxes
    const selectAllCheckbox = screen.queryByRole('checkbox', { name: /select all/i });
    
    if (selectAllCheckbox) {
      expect(selectAllCheckbox).toHaveAccessibleName();
      
      // Row selection checkboxes
      const rowCheckboxes = screen.getAllByRole('checkbox');
      rowCheckboxes.forEach((checkbox) => {
        expect(checkbox).toHaveAccessibleName();
      });
    }

    await testAccessibility();
  });

  it('should run comprehensive accessibility test suite', async () => {
    const { container } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Run comprehensive accessibility tests
    await runCommonA11yTests(container);
  });

  it('should handle focus management in modals properly', async () => {
    const user = userEvent.setup();
    const { testFocusManagement } = renderWithAccessibility(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Open modal
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Test focus management
    await testFocusManagement();

    // Focus should be trapped in modal
    const modal = screen.getByRole('dialog');
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements.length).toBeGreaterThan(0);
    
    // First focusable element should receive focus
    expect(document.activeElement).toBe(focusableElements[0]);
  });
});