import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Radio,
  Form,
  FormGroup,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { adminUsageService, type AdminUsageFilters } from '../../services/adminUsage.service';
import { usageService, type UserUsageFilters } from '../../services/usage.service';
import { format } from 'date-fns';

/**
 * Props for the ExportModal component
 */
export interface ExportModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Filter parameters for the export query */
  filters: AdminUsageFilters | UserUsageFilters;
  /** Optional flag to indicate if this is for user export (vs admin) */
  isUserExport?: boolean;
}

/**
 * Export format options
 */
type ExportFormat = 'csv' | 'json';

/**
 * ExportModal Component
 *
 * Modal dialog for exporting admin usage analytics data in CSV or JSON format.
 * Provides format selection, date range confirmation, and download handling.
 *
 * @component
 * @example
 * ```tsx
 * <ExportModal
 *   isOpen={isExportModalOpen}
 *   onClose={() => setIsExportModalOpen(false)}
 *   filters={{
 *     startDate: '2024-01-01',
 *     endDate: '2024-01-31'
 *   }}
 * />
 * ```
 */
export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  filters,
  isUserExport = false,
}) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const { handleError } = useErrorHandler();

  // State
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Handle format selection change
   */
  const handleFormatChange = (event: React.FormEvent<HTMLInputElement>, _checked: boolean) => {
    const target = event.currentTarget || event.target;
    const format = (target as HTMLInputElement).value as ExportFormat;
    setSelectedFormat(format);
  };

  /**
   * Handle export action
   * Triggers the download of the exported data
   */
  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Use appropriate service based on context
      const blob = isUserExport
        ? await usageService.exportUsageData(filters as UserUsageFilters, selectedFormat)
        : await adminUsageService.exportUsageData(filters as AdminUsageFilters, selectedFormat);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `usage-report-${format(new Date(), 'yyyy-MM-dd')}.${selectedFormat}`;
      link.setAttribute(
        'aria-label',
        t('adminUsage.exportModal.downloadFile', 'Download export file'),
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL to prevent memory leaks
      URL.revokeObjectURL(url);

      // Show success notification
      addNotification({
        title: t('adminUsage.exportModal.success', 'Export successful'),
        description: t(
          'adminUsage.exportModal.downloaded',
          'Usage data has been downloaded successfully.',
        ),
        variant: 'success',
      });

      // Close modal
      onClose();
    } catch (error) {
      handleError(error, {
        fallbackMessageKey: 'adminUsage.errors.export',
      });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle modal close
   * Reset state when modal is closed
   */
  const handleClose = () => {
    if (!isExporting) {
      setSelectedFormat('csv'); // Reset to default
      onClose();
    }
  };

  /**
   * Format file extension for display
   */
  const getFileExtension = (format: ExportFormat): string => {
    return format.toUpperCase();
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title={t('adminUsage.exportModal.title', 'Export Usage Data')}
      isOpen={isOpen}
      onClose={handleClose}
      aria-describedby="export-modal-description"
    >
      <ModalHeader />
      <ModalBody id="export-modal-description">
        <Form>
          {/* Format Selection */}
          <FormGroup
            label={t('adminUsage.exportModal.format', 'Format')}
            fieldId="export-format"
            role="group"
            aria-labelledby="export-format-label"
          >
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
              {/* CSV Option */}
              <FlexItem>
                <Radio
                  id="format-csv"
                  name="export-format"
                  label={
                    <>
                      <strong>{getFileExtension('csv')}</strong>
                      <span> </span>
                      <span>
                        {t('adminUsage.exportModal.csvFullName', '(Comma-Separated Values)')}
                      </span>
                    </>
                  }
                  description={t(
                    'adminUsage.exportModal.csvDescription',
                    'Best for spreadsheets. Compatible with Excel, Google Sheets, and other data analysis tools.',
                  )}
                  value="csv"
                  isChecked={selectedFormat === 'csv'}
                  onChange={handleFormatChange}
                  aria-describedby="csv-description"
                />
              </FlexItem>

              {/* JSON Option */}
              <FlexItem>
                <Radio
                  id="format-json"
                  name="export-format"
                  label={
                    <>
                      <strong>{getFileExtension('json')}</strong>
                      <span> </span>
                      <span>
                        {t('adminUsage.exportModal.jsonFullName', '(JavaScript Object Notation)')}
                      </span>
                    </>
                  }
                  description={t(
                    'adminUsage.exportModal.jsonDescription',
                    'Best for developers. Structured data format for programmatic access and API integration.',
                  )}
                  value="json"
                  isChecked={selectedFormat === 'json'}
                  onChange={handleFormatChange}
                  aria-describedby="json-description"
                />
              </FlexItem>
            </Flex>
          </FormGroup>

          {/* Date Range Confirmation */}
          <FormGroup
            label={t('adminUsage.exportModal.dateRange', 'Date Range')}
            fieldId="export-date-range"
          >
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsXs' }}>
              <FlexItem>
                <Content component={ContentVariants.small}>
                  <strong>{t('adminUsage.exportModal.from', 'From')}:</strong> {filters.startDate}
                </Content>
              </FlexItem>
              <FlexItem>
                <Content component={ContentVariants.small}>
                  <strong>{t('adminUsage.exportModal.to', 'To')}:</strong> {filters.endDate}
                </Content>
              </FlexItem>
            </Flex>
          </FormGroup>
        </Form>
      </ModalBody>

      <ModalFooter>
        <Button
          key="export"
          variant="primary"
          onClick={handleExport}
          isDisabled={isExporting}
          isLoading={isExporting}
          icon={!isExporting ? <DownloadIcon /> : undefined}
          aria-label={t('adminUsage.exportModal.exportButton', 'Export usage data')}
        >
          {isExporting
            ? t('adminUsage.exportModal.exporting', 'Exporting...')
            : t('adminUsage.exportModal.export', 'Export')}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={isExporting}
          aria-label={t('common.cancel', 'Cancel')}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
