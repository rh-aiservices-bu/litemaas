import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import i18n from '../../../i18n';
import BannerTable from '../../../components/banners/BannerTable';
import type { Banner } from '../../../types/banners';

describe('BannerTable', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const createMockBanner = (overrides?: Partial<Banner>): Banner => ({
    id: 'banner-1',
    name: 'Test Banner',
    content: {
      en: 'This is a test banner content',
      es: '',
      fr: '',
      de: '',
      it: '',
      ja: '',
      ko: '',
      zh: '',
      elv: '',
    },
    variant: 'info',
    isDismissible: true,
    priority: 1,
    markdownEnabled: false,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
    ...overrides,
  });

  const renderComponent = (props: Partial<Parameters<typeof BannerTable>[0]> = {}) => {
    const defaultProps = {
      banners: [createMockBanner()],
      pendingChanges: new Map<string, boolean>(),
      onVisibilityToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      hasUnsavedChanges: false,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <BannerTable {...defaultProps} {...props} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  };

  describe('Table Rendering', () => {
    it('should render table with banners', () => {
      renderComponent();

      // Table should be present - PatternFly 6 tables use role="grid"
      const table = screen.getByRole('grid', { name: /banner.*table/i });
      expect(table).toBeInTheDocument();

      // Headers should be present
      expect(screen.getByText(/banner name/i)).toBeInTheDocument();
      expect(screen.getByText(/visibility/i)).toBeInTheDocument();
      expect(screen.getByText(/type/i)).toBeInTheDocument(); // "variant" translates to "Type"
      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
      expect(screen.getByText(/actions/i)).toBeInTheDocument();

      // Banner data should be displayed
      expect(screen.getByText('Test Banner')).toBeInTheDocument();
    });

    it('should show empty state when no banners', () => {
      renderComponent({ banners: [] });

      expect(screen.getByText(/no banners found/i)).toBeInTheDocument();
    });
  });

  describe('Banner Display', () => {
    it('should display banner name and content preview', () => {
      const longContent =
        'This is a long content that should be truncated after sixty characters and more text here';
      const banner = createMockBanner({
        name: 'Important Notice',
        content: {
          en: longContent,
          es: '',
          fr: '',
          de: '',
          it: '',
          ja: '',
          ko: '',
          zh: '',
          elv: '',
        },
      });
      renderComponent({ banners: [banner] });

      expect(screen.getByText('Important Notice')).toBeInTheDocument();
      // Content should be truncated to 60 chars + "..." (only if content is > 60 chars)
      // The component shows: banner.content.en.substring(0, 60) + "..." = first 60 chars + "..."
      const expectedTruncated = longContent.substring(0, 60) + '...';
      expect(screen.getByText(expectedTruncated)).toBeInTheDocument();
    });

    it('should display variant badge with correct color', () => {
      const banners = [
        createMockBanner({ id: '1', variant: 'info' }),
        createMockBanner({ id: '2', variant: 'warning' }),
        createMockBanner({ id: '3', variant: 'danger' }),
        createMockBanner({ id: '4', variant: 'success' }),
      ];
      renderComponent({ banners });

      // Check that badges are rendered (text content will be "Info", "Warning", etc.)
      expect(screen.getByText(/info/i)).toBeInTheDocument();
      expect(screen.getByText(/warning/i)).toBeInTheDocument();
      expect(screen.getByText(/danger/i)).toBeInTheDocument();
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    it('should format and display last updated date', () => {
      const banner = createMockBanner({ updatedAt: '2025-01-15T10:30:00Z' });
      renderComponent({ banners: [banner] });

      // Date should be formatted (exact format depends on locale, but should contain year)
      const dateCell = screen.getByText(/2025|1\/15/);
      expect(dateCell).toBeInTheDocument();
    });
  });

  describe('Visibility Toggle', () => {
    it('should render visibility switch', () => {
      const banner = createMockBanner({ isActive: true });
      renderComponent({ banners: [banner] });

      const visibilitySwitch = screen.getByRole('switch', {
        name: /toggle visibility.*test banner/i,
      });
      expect(visibilitySwitch).toBeInTheDocument();
      expect(visibilitySwitch).toBeChecked();

      // Should show "Visible" text
      expect(screen.getByText(/visible/i)).toBeInTheDocument();
    });

    it('should call onVisibilityToggle when switched', async () => {
      const user = userEvent.setup();
      const onVisibilityToggle = vi.fn();
      const banner = createMockBanner({ isActive: true });
      renderComponent({ banners: [banner], onVisibilityToggle });

      const visibilitySwitch = screen.getByRole('switch', {
        name: /toggle visibility.*test banner/i,
      });
      await user.click(visibilitySwitch);

      expect(onVisibilityToggle).toHaveBeenCalledWith('banner-1', false);
    });

    it('should show pending indicator when banner has pending changes', () => {
      const banner = createMockBanner({ isActive: false });
      const pendingChanges = new Map([['banner-1', true]]);
      renderComponent({ banners: [banner], pendingChanges });

      // Switch should reflect pending state (true), not current state (false)
      const visibilitySwitch = screen.getByRole('switch');
      expect(visibilitySwitch).toBeChecked();

      // Should show "pending" text
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render edit button and call onEdit when clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const banner = createMockBanner();
      renderComponent({ banners: [banner], onEdit });

      // Query by simpler pattern - button shows translated "Edit" or similar
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();

      await user.click(editButton);

      expect(onEdit).toHaveBeenCalledWith(banner);
    });

    it('should show "View" instead of "Edit" in read-only mode', () => {
      renderComponent({ readOnly: true });

      // In read-only mode, button shows "View" (common.view translation)
      const buttons = screen.getAllByRole('button');
      const hasViewButton = buttons.some((btn) => btn.textContent?.match(/view/i));
      expect(hasViewButton).toBe(true);
    });

    it('should render delete button and show confirmation modal when clicked', async () => {
      const user = userEvent.setup();
      const banner = createMockBanner();
      renderComponent({ banners: [banner] });

      // Find delete button by simple pattern
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();

      await user.click(deleteButton);

      // Confirmation modal should appear - title is "Delete Banner"
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Modal should contain the banner name
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText(/test banner/i)).toBeInTheDocument();
    });
  });

  describe('Read-only Mode', () => {
    it('should disable visibility switch in read-only mode', () => {
      renderComponent({ readOnly: true });

      const visibilitySwitch = screen.getByRole('switch');
      expect(visibilitySwitch).toBeDisabled();
    });

    it('should disable delete button in read-only mode', () => {
      renderComponent({ readOnly: true });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Delete Confirmation Modal', () => {
    it('should show delete confirmation modal with banner name', async () => {
      const user = userEvent.setup();
      const banner = createMockBanner({ name: 'Important Banner' });
      renderComponent({ banners: [banner] });

      // Find delete button in table
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Wait for modal to appear and verify content within modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText(/important banner/i)).toBeInTheDocument();
    });

    it('should call onDelete when delete is confirmed', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const banner = createMockBanner();
      renderComponent({ banners: [banner], onDelete });

      // Open delete modal - click the delete button in the table
      const tableDeleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(tableDeleteButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find and click delete button within the modal
      const modal = screen.getByRole('dialog');
      const modalDeleteButton = within(modal).getByRole('button', { name: /delete/i });
      await user.click(modalDeleteButton);

      expect(onDelete).toHaveBeenCalledWith('banner-1');
    });

    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const banner = createMockBanner();
      renderComponent({ banners: [banner], onDelete });

      // Open delete modal
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // onDelete should not have been called
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content gracefully', () => {
      const banner = createMockBanner({
        content: { en: '', es: '', fr: '', de: '', it: '', ja: '', ko: '', zh: '', elv: '' },
      });
      renderComponent({ banners: [banner] });

      // Should show "no content" message
      expect(screen.getByText(/no content/i)).toBeInTheDocument();
    });

    it('should handle multiple banners', () => {
      const banners = [
        createMockBanner({ id: '1', name: 'Banner 1' }),
        createMockBanner({ id: '2', name: 'Banner 2' }),
        createMockBanner({ id: '3', name: 'Banner 3' }),
      ];
      renderComponent({ banners });

      expect(screen.getByText('Banner 1')).toBeInTheDocument();
      expect(screen.getByText('Banner 2')).toBeInTheDocument();
      expect(screen.getByText('Banner 3')).toBeInTheDocument();
    });
  });
});
