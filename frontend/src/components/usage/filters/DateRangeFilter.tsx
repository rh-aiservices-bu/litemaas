import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ToolbarItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  DatePicker,
} from '@patternfly/react-core';
import { CalendarAltIcon } from '@patternfly/react-icons';

/**
 * Date preset options
 */
export type DatePreset = 'any' | '1d' | '7d' | '30d' | '90d' | 'custom';

/**
 * Props for the DateRangeFilter component
 */
export interface DateRangeFilterProps {
  /** Selected date preset */
  datePreset: DatePreset;
  /** Callback when preset changes */
  onPresetChange: (preset: DatePreset) => void;
  /** Custom start date (for 'custom' preset) */
  customStartDate?: string;
  /** Custom end date (for 'custom' preset) */
  customEndDate?: string;
  /** Callback when custom start date changes */
  onStartDateChange?: (date: string) => void;
  /** Callback when custom end date changes */
  onEndDateChange?: (date: string) => void;
  /** Whether the preset select is open */
  isOpen?: boolean;
  /** Callback when preset select open state changes */
  onOpenChange?: (isOpen: boolean) => void;
  /** Whether to include "Any Date" option (defaults to false) */
  includeAnyDateOption?: boolean;
}

/**
 * DateRangeFilter Component
 *
 * Reusable date range filter with preset options (1d, 7d, 30d, 90d, custom)
 * and custom date pickers for the 'custom' preset.
 *
 * Used in both admin and user usage pages.
 *
 * @component
 * @example
 * ```tsx
 * <DateRangeFilter
 *   datePreset={datePreset}
 *   onPresetChange={setDatePreset}
 *   customStartDate={customStartDate}
 *   customEndDate={customEndDate}
 *   onStartDateChange={setCustomStartDate}
 *   onEndDateChange={setCustomEndDate}
 * />
 * ```
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  datePreset,
  onPresetChange,
  customStartDate = '',
  customEndDate = '',
  onStartDateChange,
  onEndDateChange,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  includeAnyDateOption = false,
}) => {
  const { t } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);

  // Use controlled or uncontrolled state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen =
    controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalIsOpen;

  const handleDatePresetChange = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    if (typeof value === 'string') {
      onPresetChange(value as DatePreset);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Date Preset Select */}
      <ToolbarItem>
        <Select
          id="date-preset-select"
          isOpen={isOpen}
          selected={datePreset}
          onSelect={handleDatePresetChange}
          onOpenChange={(isOpen) => setIsOpen(isOpen)}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsOpen(!isOpen)}
              isExpanded={isOpen}
              icon={<CalendarAltIcon />}
              aria-label={t('adminUsage.selectDateRange', 'Select date range')}
            >
              {t(`adminUsage.datePresets.${datePreset}`, datePreset)}
            </MenuToggle>
          )}
          aria-label={t('adminUsage.dateRangeSelect', 'Date range selection')}
        >
          <SelectList>
            {includeAnyDateOption && (
              <SelectOption value="any">{t('adminUsage.datePresets.any', 'Any Date')}</SelectOption>
            )}
            <SelectOption value="1d">{t('adminUsage.datePresets.1d', 'Last Day')}</SelectOption>
            <SelectOption value="7d">{t('adminUsage.datePresets.7d', 'Last 7 days')}</SelectOption>
            <SelectOption value="30d">
              {t('adminUsage.datePresets.30d', 'Last 30 days')}
            </SelectOption>
            <SelectOption value="90d">
              {t('adminUsage.datePresets.90d', 'Last 90 days')}
            </SelectOption>
            <SelectOption value="custom">
              {t('adminUsage.datePresets.custom', 'Custom range')}
            </SelectOption>
          </SelectList>
        </Select>
      </ToolbarItem>

      {/* Custom Date Pickers - Only shown when 'custom' is selected */}
      {datePreset === 'custom' && (
        <>
          <ToolbarItem>
            <DatePicker
              value={customStartDate}
              onChange={(_event, value) => onStartDateChange?.(value)}
              placeholder={t('adminUsage.startDate', 'Start date')}
              aria-label={t('adminUsage.startDate', 'Start date')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              value={customEndDate}
              onChange={(_event, value) => onEndDateChange?.(value)}
              placeholder={t('adminUsage.endDate', 'End date')}
              aria-label={t('adminUsage.endDate', 'End date')}
            />
          </ToolbarItem>
        </>
      )}
    </>
  );
};
