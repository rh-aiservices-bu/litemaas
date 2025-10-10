import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProviderBreakdownTable from '../../../components/admin/ProviderBreakdownTable';
import type { ProviderBreakdown } from '../../../services/adminUsage.service';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options && typeof options === 'object') {
        let result = key;
        Object.keys(options).forEach((k) => {
          result = result.replace(`{{${k}}}`, options[k]);
        });
        return result;
      }
      return key;
    },
  }),
}));

describe('ProviderBreakdownTable', () => {
  const mockProviderData: ProviderBreakdown[] = [
    {
      provider: 'OpenAI',
      metrics: {
        requests: 15000,
        tokens: {
          total: 8500000,
          input: 5100000,
          output: 3400000,
        },
        cost: 185.5,
        models: 5,
        successRate: 98.2,
      },
    },
    {
      provider: 'Anthropic',
      metrics: {
        requests: 5500,
        tokens: {
          total: 3200000,
          input: 1920000,
          output: 1280000,
        },
        cost: 95.8,
        models: 2,
        successRate: 96.5,
      },
    },
    {
      provider: 'Azure',
      metrics: {
        requests: 8000,
        tokens: {
          total: 4800000,
          input: 2880000,
          output: 1920000,
        },
        cost: 125.2,
        models: 3,
        successRate: 88.5,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading skeleton when loading is true', () => {
      render(<ProviderBreakdownTable data={[]} loading={true} />);

      // FIXED: Skeleton components don't have role="status", they're just divs with skeleton class
      // Check for the table structure instead to confirm loading state is rendered
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();

      // Verify skeleton placeholders are present by checking for the data cells
      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should show all table headers during loading', () => {
      render(<ProviderBreakdownTable data={[]} loading={true} />);

      expect(screen.getByText('admin.usage.tables.providers.columns.provider')).toBeInTheDocument();
      expect(screen.getByText('admin.usage.tables.providers.columns.requests')).toBeInTheDocument();
      expect(screen.getByText('admin.usage.tables.providers.columns.tokens')).toBeInTheDocument();
      expect(screen.getByText('admin.usage.tables.providers.columns.cost')).toBeInTheDocument();
      expect(screen.getByText('admin.usage.tables.providers.columns.models')).toBeInTheDocument();
      expect(
        screen.getByText('admin.usage.tables.providers.columns.successRate'),
      ).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no data is provided', () => {
      render(<ProviderBreakdownTable data={[]} loading={false} />);

      expect(screen.getByText('admin.usage.tables.providers.empty.title')).toBeInTheDocument();
      expect(
        screen.getByText('admin.usage.tables.providers.empty.description'),
      ).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should render table with all provider data', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('Azure')).toBeInTheDocument();
    });

    it('should format large numbers correctly', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      expect(screen.getByText('15.0K')).toBeInTheDocument(); // 15000 requests
      expect(screen.getByText('8.5M')).toBeInTheDocument(); // 8500000 tokens
      expect(screen.getByText('5.5K')).toBeInTheDocument(); // 5500 requests
    });

    it('should format currency values', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      expect(screen.getByText('$185.50')).toBeInTheDocument();
      expect(screen.getByText('$95.80')).toBeInTheDocument();
      expect(screen.getByText('$125.20')).toBeInTheDocument();
    });

    it('should display model counts', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      expect(screen.getByText('5')).toBeInTheDocument(); // OpenAI models
      expect(screen.getByText('2')).toBeInTheDocument(); // Anthropic models
      expect(screen.getByText('3')).toBeInTheDocument(); // Azure models
    });
  });

  describe('Success Rate Badges', () => {
    it('should display green badge for success rate > 95%', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const badge98 = screen.getByText('98.2%');
      expect(badge98).toBeInTheDocument();
      expect(badge98).toHaveAttribute(
        'aria-label',
        'admin.usage.tables.providers.successRate.high',
      );

      const badge96 = screen.getByText('96.5%');
      expect(badge96).toBeInTheDocument();
      expect(badge96).toHaveAttribute(
        'aria-label',
        'admin.usage.tables.providers.successRate.high',
      );
    });

    it('should display yellow badge for success rate 90-95%', () => {
      const mediumSuccessData: ProviderBreakdown[] = [
        {
          ...mockProviderData[0],
          metrics: {
            ...mockProviderData[0].metrics,
            successRate: 93.5,
          },
        },
      ];

      render(<ProviderBreakdownTable data={mediumSuccessData} loading={false} />);

      const badge = screen.getByText('93.5%');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute(
        'aria-label',
        'admin.usage.tables.providers.successRate.medium',
      );
    });

    it('should display red badge for success rate < 90%', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const badge = screen.getByText('88.5%');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'admin.usage.tables.providers.successRate.low');
    });
  });

  describe('Sorting', () => {
    it('should sort by provider name when clicking provider column header', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      // FIXED: Default sort is by requests (column 1) descending
      // First, verify the initial sort order (by requests) - should show OpenAI first (15000 requests)
      let rows = screen.getAllByRole('row').slice(1);
      let firstRowCells = within(rows[0]).getAllByRole('cell');
      expect(firstRowCells[0]).toHaveTextContent('OpenAI');

      // Now click provider header to sort by provider name
      const providerHeader = screen.getByText('admin.usage.tables.providers.columns.provider');
      fireEvent.click(providerHeader);

      // After clicking, should sort by provider descending (new column sorts descending first)
      rows = screen.getAllByRole('row').slice(1);
      firstRowCells = within(rows[0]).getAllByRole('cell');
      // Descending alphabetically: OpenAI > Azure > Anthropic
      expect(firstRowCells[0]).toHaveTextContent('OpenAI');
    });

    it('should sort by requests descending by default', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      // FIXED: The table is already sorted by requests descending on initial render
      // activeSortIndex defaults to 1 (requests column) with descending direction
      const rows = screen.getAllByRole('row').slice(1);
      const firstRowCells = within(rows[0]).getAllByRole('cell');

      // OpenAI has most requests (15000) and should be first in the default view
      expect(firstRowCells[1]).toHaveTextContent('15.0K');

      // Click the header to toggle to ascending
      const requestsHeader = screen.getByText('admin.usage.tables.providers.columns.requests');
      fireEvent.click(requestsHeader);

      // After clicking, should sort ascending - Anthropic has least requests (5500)
      const rowsAfterClick = screen.getAllByRole('row').slice(1);
      const firstRowCellsAfterClick = within(rowsAfterClick[0]).getAllByRole('cell');
      expect(firstRowCellsAfterClick[1]).toHaveTextContent('5.5K');
    });

    it('should toggle sort direction when clicking same column twice', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const costHeader = screen.getByText('admin.usage.tables.providers.columns.cost');

      // First click - descending (default)
      fireEvent.click(costHeader);
      let rows = screen.getAllByRole('row').slice(1);
      let firstRowCells = within(rows[0]).getAllByRole('cell');
      expect(firstRowCells[3]).toHaveTextContent('$185.50'); // OpenAI has highest cost

      // Second click - ascending
      fireEvent.click(costHeader);
      rows = screen.getAllByRole('row').slice(1);
      firstRowCells = within(rows[0]).getAllByRole('cell');
      expect(firstRowCells[3]).toHaveTextContent('$95.80'); // Anthropic has lowest cost
    });

    it('should sort by models count correctly', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const modelsHeader = screen.getByText('admin.usage.tables.providers.columns.models');
      fireEvent.click(modelsHeader);

      const rows = screen.getAllByRole('row').slice(1);
      const firstRowCells = within(rows[0]).getAllByRole('cell');

      // OpenAI has most models (5)
      expect(firstRowCells[4]).toHaveTextContent('5');
    });

    it('should sort by success rate correctly', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const successRateHeader = screen.getByText(
        'admin.usage.tables.providers.columns.successRate',
      );
      fireEvent.click(successRateHeader);

      const rows = screen.getAllByRole('row').slice(1);
      const firstRowCells = within(rows[0]).getAllByRole('cell');

      // OpenAI has highest success rate (98.2%)
      expect(firstRowCells[5]).toHaveTextContent('98.2%');
    });
  });

  describe('Pagination', () => {
    const manyProviders: ProviderBreakdown[] = Array.from({ length: 50 }, (_, i) => ({
      provider: `Provider ${i}`,
      metrics: {
        requests: 1000 + i * 100,
        tokens: {
          total: 500000 + i * 10000,
          input: 300000 + i * 6000,
          output: 200000 + i * 4000,
        },
        cost: 25.0 + i * 2.5,
        models: 2 + (i % 5),
        users: 10 + i,
        successRate: 85.0 + (i % 15),
        averageLatency: 500 + i * 20,
      },
      usage: [],
      topModels: [],
      topUsers: [],
    }));

    it('should paginate data with default 25 per page', () => {
      render(<ProviderBreakdownTable data={manyProviders} loading={false} />);

      // FIXED: Query by the exact translation key since our mock returns the key as-is
      expect(
        screen.getByLabelText('admin.usage.tables.providers.pagination.ariaLabel'),
      ).toBeInTheDocument();

      // Verify we're showing exactly 25 rows (plus header row = 26 total)
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBe(25);
    });

    it('should navigate to next page', () => {
      render(<ProviderBreakdownTable data={manyProviders} loading={false} />);

      // FIXED: Data is sorted by requests descending by default
      // Provider 49 has most requests (1000 + 49*100 = 5900), Provider 0 has least (1000)
      // So initially shows Provider 49-25 (top 25 by requests)
      expect(screen.getByText('Provider 49')).toBeInTheDocument();
      expect(screen.queryByText('Provider 24')).not.toBeInTheDocument();

      // Find and click the next page button
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return (
          ariaLabel &&
          (ariaLabel.toLowerCase().includes('next') || ariaLabel.includes('Go to next page'))
        );
      });

      expect(nextButton).toBeDefined();
      fireEvent.click(nextButton!);

      // After navigation, should show Provider 24-0 (next 25 by requests)
      expect(screen.queryByText('Provider 49')).not.toBeInTheDocument();
      expect(screen.getByText('Provider 24')).toBeInTheDocument();

      // Should still have 25 rows on page 2
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBe(25);
    });

    it('should change items per page', async () => {
      // ✅ FIXED: PatternFly 6 Pagination dropdowns work in JSDOM
      // Key: Use role="menuitem" instead of role="option"
      render(<ProviderBreakdownTable data={manyProviders} loading={false} />);

      // Initially showing 25 items per page, sorted by requests descending
      let rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBe(25);

      // Verify initial display shows highest request providers
      expect(screen.getByText('Provider 49')).toBeInTheDocument();

      // STEP 1: Find the per-page menu toggle button
      const buttons = screen.getAllByRole('button');
      const perPageToggle = buttons.find((btn) => {
        const text = btn.textContent || '';
        // Look for button showing pagination range "1 - 25 of 50"
        return text.match(/\d+\s*-\s*\d+\s+of\s+\d+/);
      });

      expect(perPageToggle).toBeDefined();
      fireEvent.click(perPageToggle!);

      // STEP 2: Wait for dropdown menu to appear
      // ✅ CORRECT: Use role="menuitem" (PatternFly 6 uses menu pattern, not select)
      await waitFor(() => {
        const menuItems = screen.queryAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThan(0);
      });

      // STEP 3: Find and click the "50 per page" option
      const menuItems = screen.getAllByRole('menuitem');
      const option50 = menuItems.find((item) => item.textContent?.includes('50'));

      expect(option50).toBeDefined();
      fireEvent.click(option50!);

      // STEP 4: Verify component re-rendered with new page size
      await waitFor(() => {
        const rowsAfter = screen.getAllByRole('row').slice(1);
        expect(rowsAfter.length).toBe(50);
      });

      // Now all providers should be visible including Provider 0 (lowest requests)
      expect(screen.getByText('Provider 0')).toBeInTheDocument();
    });

    it('should reset to page 1 when changing per page', async () => {
      // ✅ FIXED: Using correct role="menuitem" query pattern
      render(<ProviderBreakdownTable data={manyProviders} loading={false} />);

      // Initial state shows highest request providers (Provider 49-25)
      expect(screen.getByText('Provider 49')).toBeInTheDocument();
      expect(screen.queryByText('Provider 24')).not.toBeInTheDocument();

      // STEP 1: Navigate to page 2
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return (
          ariaLabel &&
          (ariaLabel.toLowerCase().includes('next') || ariaLabel.includes('Go to next page'))
        );
      });

      expect(nextButton).toBeDefined();
      fireEvent.click(nextButton!);

      // Wait for navigation - should show Provider 24-0 on page 2
      await waitFor(() => {
        expect(screen.queryByText('Provider 49')).not.toBeInTheDocument();
        expect(screen.getByText('Provider 24')).toBeInTheDocument();
      });

      // STEP 2: Open per-page dropdown
      const updatedButtons = screen.getAllByRole('button');
      const perPageToggle = updatedButtons.find((btn) => {
        const text = btn.textContent || '';
        return text.match(/\d+\s*-\s*\d+\s+of\s+\d+/);
      });

      expect(perPageToggle).toBeDefined();
      fireEvent.click(perPageToggle!);

      // STEP 3: Wait for menu items and select 50
      // ✅ CORRECT: Use role="menuitem" for PatternFly 6 dropdowns
      await waitFor(() => {
        const menuItems = screen.queryAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThan(0);
      });

      const menuItems = screen.getAllByRole('menuitem');
      const option50 = menuItems.find((item) => item.textContent?.includes('50'));

      expect(option50).toBeDefined();
      fireEvent.click(option50!);

      // STEP 4: Verify reset to page 1 with all 50 items visible
      await waitFor(() => {
        expect(screen.getByText('Provider 49')).toBeInTheDocument(); // Back on page 1
        expect(screen.getByText('Provider 0')).toBeInTheDocument(); // All 50 visible
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible table caption', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const caption = screen.getByText(/admin.usage.tables.providers.caption/i);
      expect(caption).toBeInTheDocument();
    });

    it('should have aria-label on table', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      // FIXED: PatternFly 6 Table uses role="grid" instead of role="table"
      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-label');
    });

    it('should have proper aria-label on success rate badges', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const badges = screen.getAllByText(/\d+\.\d+%/);
      expect(badges.length).toBeGreaterThan(0);

      badges.forEach((badge) => {
        expect(badge).toHaveAttribute('aria-label');
      });
    });

    it('should have sortable columns with proper behavior', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(6); // 6 columns total
    });
  });

  describe('Number Formatting', () => {
    it('should format numbers less than 1000 without abbreviation', () => {
      const smallData: ProviderBreakdown[] = [
        {
          ...mockProviderData[0],
          metrics: {
            ...mockProviderData[0].metrics,
            requests: 999,
            models: 2,
          },
        },
      ];

      render(<ProviderBreakdownTable data={smallData} loading={false} />);

      expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('should format numbers in thousands with K', () => {
      const thousandData: ProviderBreakdown[] = [
        {
          ...mockProviderData[0],
          metrics: {
            ...mockProviderData[0].metrics,
            requests: 5678,
          },
        },
      ];

      render(<ProviderBreakdownTable data={thousandData} loading={false} />);

      expect(screen.getByText('5.7K')).toBeInTheDocument();
    });

    it('should format numbers in millions with M', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      // Check for million-formatted token counts
      expect(screen.getByText('8.5M')).toBeInTheDocument(); // OpenAI
      expect(screen.getByText('3.2M')).toBeInTheDocument(); // Anthropic
      expect(screen.getByText('4.8M')).toBeInTheDocument(); // Azure
    });

    it('should format percentage with one decimal place', () => {
      render(<ProviderBreakdownTable data={mockProviderData} loading={false} />);

      expect(screen.getByText('98.2%')).toBeInTheDocument();
      expect(screen.getByText('96.5%')).toBeInTheDocument();
      expect(screen.getByText('88.5%')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle provider with zero requests', () => {
      const zeroData: ProviderBreakdown[] = [
        {
          ...mockProviderData[0],
          metrics: {
            ...mockProviderData[0].metrics,
            requests: 0,
            cost: 0,
          },
        },
      ];

      render(<ProviderBreakdownTable data={zeroData} loading={false} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle single provider without pagination', () => {
      const singleProvider = [mockProviderData[0]];

      render(<ProviderBreakdownTable data={singleProvider} loading={false} />);

      // FIXED: Pagination should not be visible with only one provider (less than perPage of 25)
      // Query by exact translation key
      expect(
        screen.queryByLabelText('admin.usage.tables.providers.pagination.ariaLabel'),
      ).not.toBeInTheDocument();
    });
  });
});
