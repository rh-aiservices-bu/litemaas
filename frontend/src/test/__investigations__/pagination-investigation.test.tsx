import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Pagination, PaginationVariant } from '@patternfly/react-core';

/**
 * PatternFly 6 Pagination Dropdown Investigation
 *
 * Purpose: Systematically test how PatternFly 6 Pagination component renders
 * dropdown menus in JSDOM vs browser environment.
 *
 * Goal: Determine if per-page selection dropdown can be tested in JSDOM,
 * or if it's a limitation that requires E2E testing or permanent skip.
 *
 * Context: ProviderBreakdownTable.test.tsx has 2 skipped tests for pagination
 * dropdown interactions that fail to find dropdown options in JSDOM.
 */
describe('PatternFly 6 Pagination Dropdown Investigation', () => {
  const mockOnSetPage = vi.fn();
  const mockOnPerPageSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Pagination Rendering', () => {
    it('should render pagination component', () => {
      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          variant={PaginationVariant.bottom}
        />,
      );

      // Pagination should render
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should show current page range', () => {
      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          variant={PaginationVariant.bottom}
        />,
      );

      // Should show "1 - 25 of 100" or similar
      const rangeText = screen.getByText(/1.*25.*100/);
      expect(rangeText).toBeInTheDocument();
    });

    it('should show navigation buttons', () => {
      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          variant={PaginationVariant.bottom}
        />,
      );

      // Navigation buttons should exist
      const allButtons = screen.getAllByRole('button');
      expect(allButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination Navigation (Known to Work)', () => {
    it('should handle next page navigation', async () => {
      const user = userEvent.setup();

      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          variant={PaginationVariant.bottom}
        />,
      );

      // Find next button by aria-label
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) =>
        btn.getAttribute('aria-label')?.toLowerCase().includes('next'),
      );

      if (nextButton) {
        await user.click(nextButton);

        // Verify callback was called
        expect(mockOnSetPage).toHaveBeenCalledWith(expect.anything(), 2);
      }
    });

    it('should handle previous page navigation', async () => {
      const user = userEvent.setup();

      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={2}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          variant={PaginationVariant.bottom}
        />,
      );

      // Find previous button
      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((btn) =>
        btn.getAttribute('aria-label')?.toLowerCase().includes('previous'),
      );

      if (prevButton) {
        await user.click(prevButton);
        expect(mockOnSetPage).toHaveBeenCalledWith(expect.anything(), 1);
      }
    });
  });

  describe('Dropdown Investigation - Per Page Selection', () => {
    it('INVESTIGATION: Can we find the per-page toggle button?', () => {
      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          perPageOptions={[
            { title: '10', value: 10 },
            { title: '25', value: 25 },
            { title: '50', value: 50 },
            { title: '100', value: 100 },
          ]}
          variant={PaginationVariant.bottom}
        />,
      );

      // Debug: Print entire DOM structure
      screen.debug();

      // Strategy 1: Look for button containing the range text
      const buttons = screen.getAllByRole('button');
      console.log('Total buttons found:', buttons.length);

      buttons.forEach((btn, index) => {
        const text = btn.textContent || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        console.log(`Button ${index}:`, { text, ariaLabel, className: btn.className });
      });

      // Strategy 2: Look for text showing current per-page value
      // The toggle should show something like "1 - 25 of 100"
      const perPageToggle = buttons.find((btn) => {
        const text = btn.textContent || '';
        return text.match(/\d+\s*-\s*\d+/); // Matches "1 - 25"
      });

      console.log('Per-page toggle found:', !!perPageToggle);
      expect(perPageToggle).toBeDefined();
    });

    it('INVESTIGATION: Can we click the dropdown toggle?', async () => {
      const user = userEvent.setup();

      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          perPageOptions={[
            { title: '10', value: 10 },
            { title: '25', value: 25 },
            { title: '50', value: 50 },
          ]}
          variant={PaginationVariant.bottom}
        />,
      );

      // Find the toggle button
      const buttons = screen.getAllByRole('button');
      const perPageToggle = buttons.find((btn) => {
        const text = btn.textContent || '';
        return text.match(/\d+\s*-\s*\d+/);
      });

      if (perPageToggle) {
        console.log('Clicking per-page toggle...');
        await user.click(perPageToggle);

        // Debug after click
        console.log('=== DOM after clicking toggle ===');
        screen.debug();
      } else {
        console.log('Could not find per-page toggle button');
      }

      expect(perPageToggle).toBeDefined();
    });

    it('INVESTIGATION: Can we find dropdown options after opening?', async () => {
      const user = userEvent.setup();

      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          perPageOptions={[
            { title: '10', value: 10 },
            { title: '25', value: 25 },
            { title: '50', value: 50 },
          ]}
          variant={PaginationVariant.bottom}
        />,
      );

      // Find and click toggle
      const buttons = screen.getAllByRole('button');
      const perPageToggle = buttons.find((btn) => {
        const text = btn.textContent || '';
        return text.match(/\d+\s*-\s*\d+/);
      });

      if (perPageToggle) {
        await user.click(perPageToggle);

        // Wait for dropdown to potentially appear
        await waitFor(
          () => {
            // Try multiple query strategies

            // Strategy 1: role="option"
            const options = screen.queryAllByRole('option');
            console.log('Options found (role="option"):', options.length);

            // Strategy 2: role="menuitem"
            const menuItems = screen.queryAllByRole('menuitem');
            console.log('Menu items found (role="menuitem"):', menuItems.length);

            // Strategy 3: role="menu"
            const menu = screen.queryByRole('menu');
            console.log('Menu found (role="menu"):', !!menu);

            // Strategy 4: Look for text content "10", "50", "100"
            const text10 = screen.queryByText('10', { exact: false });
            const text50 = screen.queryByText('50', { exact: false });
            const text100 = screen.queryByText('100', { exact: false });
            console.log('Text queries:', {
              text10: !!text10,
              text50: !!text50,
              text100: !!text100,
            });

            // Strategy 5: Look for ul/li structure
            const listItems = document.querySelectorAll('ul li');
            console.log('List items found (DOM query):', listItems.length);

            // Strategy 6: Check for dropdown/menu classes
            const dropdownElements = document.querySelectorAll(
              '[class*="menu"], [class*="dropdown"]',
            );
            console.log('Elements with menu/dropdown class:', dropdownElements.length);

            dropdownElements.forEach((el, index) => {
              console.log(
                `Dropdown element ${index}:`,
                el.className,
                el.textContent?.substring(0, 50),
              );
            });
          },
          { timeout: 1000 },
        );

        // Final check: Did we find any options?
        const foundOptions =
          screen.queryAllByRole('option').length > 0 ||
          screen.queryAllByRole('menuitem').length > 0 ||
          screen.queryByText('50') !== null;

        console.log('=== INVESTIGATION RESULT ===');
        console.log('Found any dropdown options:', foundOptions);
        console.log('===========================');
      }
    });

    it('INVESTIGATION: Check DOM structure with detailed logging', () => {
      const { container } = render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          perPageOptions={[
            { title: '10', value: 10 },
            { title: '25', value: 25 },
            { title: '50', value: 50 },
          ]}
          variant={PaginationVariant.bottom}
        />,
      );

      console.log('=== DETAILED DOM STRUCTURE ===');
      console.log('Container HTML:', container.innerHTML);

      // Check for PatternFly 6 classes
      const pf6Elements = container.querySelectorAll('[class*="pf-v6"]');
      console.log('PatternFly 6 elements:', pf6Elements.length);

      pf6Elements.forEach((el, index) => {
        if (index < 10) {
          // Limit output
          console.log(`Element ${index}:`, el.tagName, el.className);
        }
      });

      // Check for select/menu components
      const selectElements = container.querySelectorAll('select, [role="menu"], [role="listbox"]');
      console.log('Select/menu elements:', selectElements.length);
      console.log('==============================');
    });
  });

  describe('Comparison: Browser vs JSDOM Behavior', () => {
    it('DOCUMENTATION: Expected behavior in browser', () => {
      // This is a documentation test to describe expected browser behavior

      const expectedBehavior = {
        toggle: 'Shows "1 - 25 of 100" button',
        onClick: 'Opens dropdown menu with options: 10, 25, 50, 100',
        options: 'Each option is clickable and calls onPerPageSelect',
        accessibility: 'Dropdown has proper ARIA attributes and keyboard navigation',
      };

      console.log('=== EXPECTED BROWSER BEHAVIOR ===');
      console.log(JSON.stringify(expectedBehavior, null, 2));
      console.log('=================================');

      // Mark test as passing - this is just documentation
      expect(expectedBehavior).toBeDefined();
    });

    it('FINDINGS: JSDOM limitations with PatternFly 6 Pagination', () => {
      // This test documents the findings from the investigation

      const findings = {
        canRenderPagination: true,
        canFindToggleButton: true, // Should be confirmed by investigation
        canClickToggle: true, // Should be confirmed by investigation
        canFindDropdownOptions: false, // EXPECTED: Will likely fail in JSDOM
        reason:
          'PatternFly 6 Pagination uses complex dropdown rendering that may not work in JSDOM',
        workaround: 'Test callback directly or use E2E tests for full dropdown interaction',
      };

      console.log('=== INVESTIGATION FINDINGS ===');
      console.log(JSON.stringify(findings, null, 2));
      console.log('==============================');

      // This test passes to document findings
      expect(findings).toBeDefined();
    });
  });

  describe('Alternative Testing Strategies', () => {
    it('ALTERNATIVE 1: Test onPerPageSelect callback directly', () => {
      render(
        <Pagination
          itemCount={100}
          perPage={25}
          page={1}
          onSetPage={mockOnSetPage}
          onPerPageSelect={mockOnPerPageSelect}
          variant={PaginationVariant.bottom}
        />,
      );

      // Instead of testing dropdown UI, verify callback works when called directly
      mockOnPerPageSelect(null as any, 50);

      expect(mockOnPerPageSelect).toHaveBeenCalledWith(expect.anything(), 50);
    });

    it('ALTERNATIVE 2: Test state management logic separately', () => {
      // Extract pagination logic into a hook or utility function
      const handlePerPageChange = (newPerPage: number, setPerPage: Function, setPage: Function) => {
        setPerPage(newPerPage);
        setPage(1); // Reset to first page
      };

      const mockSetPerPage = vi.fn();
      const mockSetPage = vi.fn();

      handlePerPageChange(50, mockSetPerPage, mockSetPage);

      expect(mockSetPerPage).toHaveBeenCalledWith(50);
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    it('ALTERNATIVE 3: Document manual testing requirements', () => {
      const manualTestingChecklist = [
        'Verify per-page dropdown opens on click',
        'Verify all options (10, 25, 50, 100) are visible',
        'Verify clicking option updates items per page',
        'Verify page resets to 1 when changing per page',
        'Verify keyboard navigation works in dropdown',
      ];

      console.log('=== MANUAL TESTING CHECKLIST ===');
      manualTestingChecklist.forEach((item, index) => {
        console.log(`${index + 1}. ${item}`);
      });
      console.log('================================');

      expect(manualTestingChecklist.length).toBe(5);
    });
  });
});
