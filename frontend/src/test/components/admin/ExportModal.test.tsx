import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportModal } from '../../../components/usage/ExportModal';
import { adminUsageService } from '../../../services/adminUsage.service';
import type { AdminUsageFilters } from '../../../services/adminUsage.service';

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

// Mock modules
const mockAddNotification = vi.fn();
vi.mock('../../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: mockAddNotification,
  }),
}));

const mockHandleError = vi.fn();
vi.mock('../../../hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: mockHandleError,
  }),
}));

vi.mock('../../../services/adminUsage.service', () => ({
  adminUsageService: {
    exportUsageData: vi.fn(),
  },
}));

describe('ExportModal', () => {
  const mockFilters: AdminUsageFilters = {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders the modal when open', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export usage data/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ExportModal isOpen={false} onClose={mockOnClose} filters={mockFilters} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays format selection options', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    expect(screen.getByRole('radio', { name: /CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /JSON/i })).toBeInTheDocument();
    expect(screen.getByText(/Comma-Separated Values/i)).toBeInTheDocument();
    expect(screen.getByText(/JavaScript Object Notation/i)).toBeInTheDocument();
  });

  it('defaults to CSV format selected', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const csvRadio = screen.getByRole('radio', { name: /CSV/i }) as HTMLInputElement;
    const jsonRadio = screen.getByRole('radio', { name: /JSON/i }) as HTMLInputElement;

    expect(csvRadio.checked).toBe(true);
    expect(jsonRadio.checked).toBe(false);
  });

  it('displays both CSV and JSON radio options', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const csvRadio = screen.getByRole('radio', { name: /CSV/i });
    const jsonRadio = screen.getByRole('radio', { name: /JSON/i });

    expect(csvRadio).toBeInTheDocument();
    expect(jsonRadio).toBeInTheDocument();
  });

  it('displays the date range from filters', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('2024-01-31')).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('exports CSV data when Export button is clicked', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
    vi.mocked(adminUsageService.exportUsageData).mockResolvedValue(mockBlob);

    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const exportButton = screen.getByRole('button', { name: /export usage data/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(adminUsageService.exportUsageData).toHaveBeenCalledWith(mockFilters, 'csv');
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('exports data using the exportUsageData service', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['data'], { type: 'text/csv' });
    vi.mocked(adminUsageService.exportUsageData).mockResolvedValue(mockBlob);

    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const exportButton = screen.getByRole('button', { name: /export usage data/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(adminUsageService.exportUsageData).toHaveBeenCalled();
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during export', async () => {
    const user = userEvent.setup();
    let resolveExport: (value: Blob) => void;
    const exportPromise = new Promise<Blob>((resolve) => {
      resolveExport = resolve;
    });
    vi.mocked(adminUsageService.exportUsageData).mockReturnValue(exportPromise);

    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const exportButton = screen.getByRole('button', { name: /export usage data/i });
    await user.click(exportButton);

    // Check loading state
    expect(screen.getByText(/exporting\.\.\./i)).toBeInTheDocument();
    expect(exportButton).toBeDisabled();

    // Resolve the export
    resolveExport!(new Blob(['data'], { type: 'text/csv' }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('disables Cancel button during export', async () => {
    const user = userEvent.setup();
    let resolveExport: (value: Blob) => void;
    const exportPromise = new Promise<Blob>((resolve) => {
      resolveExport = resolve;
    });
    vi.mocked(adminUsageService.exportUsageData).mockReturnValue(exportPromise);

    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const exportButton = screen.getByRole('button', { name: /export usage data/i });
    await user.click(exportButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();

    // Resolve the export
    resolveExport!(new Blob(['data'], { type: 'text/csv' }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Export failed');
    vi.mocked(adminUsageService.exportUsageData).mockRejectedValue(mockError);

    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const exportButton = screen.getByRole('button', { name: /export usage data/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(adminUsageService.exportUsageData).toHaveBeenCalled();
    });

    // Modal should remain open on error
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('always starts with CSV format by default', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const csvRadio = screen.getByRole('radio', { name: /CSV/i }) as HTMLInputElement;
    expect(csvRadio.checked).toBe(true);
  });

  it('has proper ARIA labels for accessibility', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    expect(screen.getByRole('button', { name: /export usage data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
  });

  it('calls exportUsageData with correct format', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
    vi.mocked(adminUsageService.exportUsageData).mockResolvedValue(mockBlob);

    render(<ExportModal isOpen={true} onClose={mockOnClose} filters={mockFilters} />);

    const exportButton = screen.getByRole('button', { name: /export usage data/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(adminUsageService.exportUsageData).toHaveBeenCalledWith(mockFilters, 'csv');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
