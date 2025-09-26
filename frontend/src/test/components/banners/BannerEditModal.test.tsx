import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import i18n from '../../../i18n';
import BannerEditModal from '../../../components/banners/BannerEditModal';
import type { Banner } from '../../../types/banners';

describe('BannerEditModal', () => {
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
      en: 'English content',
      es: 'Spanish content',
      fr: 'French content',
      de: 'German content',
      it: 'Italian content',
      ja: 'Japanese content',
      ko: 'Korean content',
      zh: 'Chinese content',
      elv: 'Elvish content',
    },
    variant: 'info',
    isDismissible: true,
    priority: 1,
    markdownEnabled: false,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  const renderComponent = (props: Partial<Parameters<typeof BannerEditModal>[0]> = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSave: vi.fn(),
      mode: 'create' as const,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <BannerEditModal {...defaultProps} {...props} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  };

  describe('Modal Rendering', () => {
    it('should render modal in create mode', async () => {
      renderComponent({ mode: 'create' });

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
      });

      // Modal should be present and contain create form
      const nameInput = screen.getByRole('textbox', { name: /banner name/i });
      expect(nameInput).toHaveValue('');
    });

    it('should render modal in edit mode with banner data', async () => {
      const banner = createMockBanner();
      renderComponent({ mode: 'edit', banner });

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
      });

      // Should populate form with banner data
      const nameInput = screen.getByRole('textbox', { name: /banner name/i });
      expect(nameInput).toHaveValue('Test Banner');

      // Content textarea - find by id since role might be ambiguous with tabs
      const contentInput = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      expect(contentInput).toHaveValue('English content');
    });

    it('should render modal in view mode (edit with canEdit=false)', async () => {
      const banner = createMockBanner();
      renderComponent({ mode: 'edit', banner, canEdit: false });

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
      });

      // All form fields should be disabled in view mode
      const nameInput = screen.getByRole('textbox', { name: /banner name/i });
      expect(nameInput).toBeDisabled();
    });
  });

  describe('Form Fields', () => {
    it('should render name input field', () => {
      renderComponent({ mode: 'create' });

      const nameInput = screen.getByRole('textbox', { name: 'Banner Name' });
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveAttribute('type', 'text');
    });

    it('should allow typing in name field', async () => {
      const user = userEvent.setup();
      renderComponent({ mode: 'create' });

      const nameInput = screen.getByRole('textbox', { name: 'Banner Name' });
      await user.type(nameInput, 'New Banner Name');

      expect(nameInput).toHaveValue('New Banner Name');
    });

    it('should render content textarea with language tabs', () => {
      renderComponent({ mode: 'create' });

      // Should show English tab by default
      const contentInput = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      expect(contentInput).toBeInTheDocument();
      expect(contentInput.tagName).toBe('TEXTAREA');

      // Should show language tabs with flag emojis
      expect(screen.getByRole('tab', { name: /🇺🇸.*english/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /🇪🇸.*español/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /🇫🇷.*français/i })).toBeInTheDocument();
    });

    it('should render variant select dropdown', () => {
      renderComponent({ mode: 'create' });

      const variantSelect = screen.getByRole('button', { name: /select banner style/i });
      expect(variantSelect).toBeInTheDocument();
    });

    it('should render isDismissible checkbox', () => {
      renderComponent({ mode: 'create' });

      const dismissibleCheckbox = screen.getByRole('checkbox', { name: /allow users to dismiss/i });
      expect(dismissibleCheckbox).toBeInTheDocument();
    });

    it('should render markdownEnabled checkbox', () => {
      renderComponent({ mode: 'create' });

      const markdownCheckbox = screen.getByRole('checkbox', { name: /enable.*markdown/i });
      expect(markdownCheckbox).toBeInTheDocument();
    });
  });

  describe('Language Tabs', () => {
    it('should switch between language tabs', async () => {
      const user = userEvent.setup();
      const banner = createMockBanner();
      renderComponent({ mode: 'edit', banner });

      // Initially shows English content
      let contentInput = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      expect(contentInput).toHaveValue('English content');

      // Click Spanish tab - query with flag emoji
      const spanishTab = screen.getByRole('tab', { name: /🇪🇸.*español/i });
      await user.click(spanishTab);

      // Should show Spanish content
      await waitFor(() => {
        contentInput = document.querySelector('#banner-content-es') as HTMLTextAreaElement;
        expect(contentInput).toHaveValue('Spanish content');
      });
    });

    it('should preserve content when switching tabs', async () => {
      const user = userEvent.setup();
      renderComponent({ mode: 'create' });

      // Type in English tab
      const englishContent = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      await user.type(englishContent, 'English text');

      // Switch to Spanish tab - query with flag emoji
      const spanishTab = screen.getByRole('tab', { name: /🇪🇸.*español/i });
      await user.click(spanishTab);

      // Type in Spanish tab
      await waitFor(() => {
        const spanishContent = document.querySelector('#banner-content-es') as HTMLTextAreaElement;
        expect(spanishContent).toBeInTheDocument();
      });
      const spanishContent = document.querySelector('#banner-content-es') as HTMLTextAreaElement;
      await user.type(spanishContent, 'Spanish text');

      // Switch back to English - query with flag emoji
      const englishTab = screen.getByRole('tab', { name: /🇺🇸.*english/i });
      await user.click(englishTab);

      // English content should be preserved
      await waitFor(() => {
        const englishContentAgain = document.querySelector(
          '#banner-content-en',
        ) as HTMLTextAreaElement;
        expect(englishContentAgain).toHaveValue('English text');
      });
    });
  });

  describe('Validation', () => {
    it('should show error when name is empty', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderComponent({ mode: 'create', onSave });

      // Try to submit without filling name - button shows "Create Banner" in create mode
      const saveButton = screen.getByRole('button', { name: /create banner/i });
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });

      // Should not call onSave
      expect(onSave).not.toHaveBeenCalled();
    });

    it('should show error when English content is empty', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderComponent({ mode: 'create', onSave });

      // Fill name but leave English content empty
      const nameInput = screen.getByRole('textbox', { name: /banner name/i });
      await user.type(nameInput, 'Test Banner');

      // Try to submit - button shows "Create Banner" in create mode
      const saveButton = screen.getByRole('button', { name: /create banner/i });
      await user.click(saveButton);

      // Should show validation error - use getAllByText since helper text is also present
      await waitFor(() => {
        const errors = screen.getAllByText(/english.*required/i);
        expect(errors.length).toBeGreaterThan(0);
      });

      // Should not call onSave
      expect(onSave).not.toHaveBeenCalled();
    });

    it('should allow save when all required fields are filled', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderComponent({ mode: 'create', onSave });

      // Fill required fields
      const nameInput = screen.getByRole('textbox', { name: /banner name/i });
      await user.type(nameInput, 'Test Banner');

      const contentInput = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      await user.type(contentInput, 'Test content');

      // Submit form - button shows "Create Banner" in create mode
      const saveButton = screen.getByRole('button', { name: /create banner/i });
      await user.click(saveButton);

      // Should call onSave with form data
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Banner',
            content: expect.objectContaining({
              en: 'Test content',
            }),
          }),
        );
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with all field values', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderComponent({ mode: 'create', onSave });

      // Fill all fields
      const nameInput = screen.getByRole('textbox', { name: /banner name/i });
      await user.type(nameInput, 'Test Banner');

      const contentInput = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      await user.type(contentInput, 'Test content');

      // Toggle checkboxes
      const dismissibleCheckbox = screen.getByRole('checkbox', { name: /allow users to dismiss/i });
      await user.click(dismissibleCheckbox);

      const markdownCheckbox = screen.getByRole('checkbox', { name: /enable.*markdown/i });
      await user.click(markdownCheckbox);

      // Note: Variant selection via dropdown is tested in E2E tests
      // The default variant is 'info'

      // Submit form - button shows "Create Banner" in create mode
      const saveButton = screen.getByRole('button', { name: /create banner/i });
      await user.click(saveButton);

      // Verify onSave called with correct data (default variant is 'info')
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Banner',
            content: expect.objectContaining({
              en: 'Test content',
            }),
            variant: 'info', // Default variant
            isDismissible: true,
            markdownEnabled: true,
          }),
        );
      });
    });

    it('should close modal when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderComponent({ mode: 'create', onClose });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should disable form during loading', () => {
      renderComponent({ mode: 'create', isLoading: true });

      // Save button should be disabled when loading
      const saveButton = screen.getByRole('button', { name: /create banner/i });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toBeDisabled();

      // Cancel button should still be enabled but disabled during loading
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Read-only Mode', () => {
    it('should disable all form fields in read-only mode', () => {
      const banner = createMockBanner();
      renderComponent({ mode: 'edit', banner, canEdit: false });

      // All fields should be disabled
      const nameInput = screen.getByRole('textbox', { name: 'Banner Name' });
      expect(nameInput).toBeDisabled();

      const contentInput = document.querySelector('#banner-content-en') as HTMLTextAreaElement;
      expect(contentInput).toBeDisabled();

      const variantToggle = screen.getByRole('button', { name: /select banner style/i });
      expect(variantToggle).toBeDisabled();

      const dismissibleCheckbox = screen.getByRole('checkbox', { name: /allow users to dismiss/i });
      expect(dismissibleCheckbox).toBeDisabled();

      const markdownCheckbox = screen.getByRole('checkbox', { name: /enable.*markdown/i });
      expect(markdownCheckbox).toBeDisabled();
    });

    it('should hide save button in read-only mode', () => {
      const banner = createMockBanner();
      renderComponent({ mode: 'edit', banner, canEdit: false });

      // Save button should not be present
      const saveButton = screen.queryByRole('button', { name: /save banner/i });
      expect(saveButton).not.toBeInTheDocument();

      // Close button should still be present - use getAllByRole since modal has X button too
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Loading State', () => {
    it('should show spinner when loading', () => {
      renderComponent({ mode: 'create', isLoading: true });

      // Should show loading spinner - PatternFly Button with isLoading shows a spinner
      const spinner = document.querySelector('.pf-v6-c-spinner');
      expect(spinner).toBeTruthy(); // Use toBeTruthy since it's a DOM element query
    });

    it('should disable all interactions when loading', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderComponent({ mode: 'create', isLoading: true, onSave });

      // Save button should be disabled (shows same text, just disabled)
      const saveButton = screen.getByRole('button', { name: /create banner/i });
      expect(saveButton).toBeDisabled();

      // Try to click (should not work)
      await user.click(saveButton);
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Variant Selection', () => {
    it('should render variant selector', () => {
      renderComponent({ mode: 'create' });

      // Variant selector should be present
      const variantToggle = screen.getByRole('button', { name: /select banner style|info/i });
      expect(variantToggle).toBeInTheDocument();

      // Note: Dropdown menu interaction is tested in E2E tests
      // PatternFly 6 Select dropdowns don't fully render in JSDOM
    });

    it('should default to info variant in create mode', () => {
      renderComponent({ mode: 'create' });

      const variantToggle = screen.getByRole('button', { name: /select banner style/i });
      // The toggle should show "Info" as the default selected value
      expect(variantToggle).toHaveTextContent(/info/i);
    });
  });

  describe('Checkbox Components', () => {
    it('should toggle isDismissible checkbox', async () => {
      const user = userEvent.setup();
      renderComponent({ mode: 'create' });

      const dismissibleCheckbox = screen.getByRole('checkbox', { name: /allow users to dismiss/i });

      // Should be unchecked by default in create mode
      expect(dismissibleCheckbox).not.toBeChecked();

      // Click to toggle
      await user.click(dismissibleCheckbox);

      // Should be checked
      expect(dismissibleCheckbox).toBeChecked();

      // Click again to toggle off
      await user.click(dismissibleCheckbox);

      // Should be unchecked again
      expect(dismissibleCheckbox).not.toBeChecked();
    });

    it('should toggle markdownEnabled checkbox', async () => {
      const user = userEvent.setup();
      renderComponent({ mode: 'create' });

      const markdownCheckbox = screen.getByRole('checkbox', { name: /enable.*markdown/i });

      // Should be unchecked by default in create mode
      expect(markdownCheckbox).not.toBeChecked();

      // Click to toggle
      await user.click(markdownCheckbox);

      // Should be checked
      expect(markdownCheckbox).toBeChecked();
    });
  });
});
