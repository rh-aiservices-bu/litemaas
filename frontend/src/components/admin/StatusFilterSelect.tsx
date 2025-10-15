import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectOption,
  SelectList,
  SelectOptionProps,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
  Label,
  LabelGroup,
} from '@patternfly/react-core';
import TimesIcon from '@patternfly/react-icons/dist/esm/icons/times-icon';
import type { SubscriptionStatus } from '../../types/admin';

interface StatusFilterSelectProps {
  selected: SubscriptionStatus[];
  onSelect: (statuses: SubscriptionStatus[]) => void;
}

/**
 * Multi-select typeahead filter for subscription statuses
 * Follows PatternFly 6 Multiple typeahead with checkboxes pattern
 */
export const StatusFilterSelect: React.FC<StatusFilterSelectProps> = ({ selected, onSelect }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(
    t('pages.adminSubscriptions.filters.statusPlaceholder', 'All statuses'),
  );
  const textInputRef = useRef<HTMLInputElement>(undefined);

  const NO_RESULTS = 'no results';

  // All available subscription statuses
  const allStatuses: SubscriptionStatus[] = ['pending', 'active', 'denied', 'suspended', 'expired'];

  // Convert statuses to select options
  const initialSelectOptions: SelectOptionProps[] = allStatuses.map((status) => ({
    value: status,
    children: t(`pages.subscriptions.status.${status}`),
  }));

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 15): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Helper function to get status display name
  const getStatusDisplayName = (status: SubscriptionStatus): string => {
    return t(`pages.subscriptions.status.${status}`);
  };

  useEffect(() => {
    let newSelectOptions: SelectOptionProps[] = initialSelectOptions;

    // Filter menu items based on the text input value when one exists
    if (inputValue) {
      newSelectOptions = initialSelectOptions.filter((menuItem) =>
        String(menuItem.children).toLowerCase().includes(inputValue.toLowerCase()),
      );

      // When no options are found after filtering, display 'No results found'
      if (!newSelectOptions.length) {
        newSelectOptions = [
          {
            isAriaDisabled: true,
            children: t(
              'pages.adminSubscriptions.filters.noStatusesFound',
              'No statuses found for "{{query}}"',
              {
                query: inputValue,
              },
            ),
            value: NO_RESULTS,
            hasCheckbox: false,
          },
        ];
      }

      // Open the menu when the input value changes and the new value is not empty
      if (!isOpen) {
        setIsOpen(true);
      }
    }

    setSelectOptions(newSelectOptions);
  }, [inputValue, initialSelectOptions.length]);

  useEffect(() => {
    if (selected.length === 0) {
      setPlaceholder(
        t('pages.adminSubscriptions.filters.statusPlaceholder', 'All statuses (click to filter)'),
      );
    } else {
      setPlaceholder(''); // Empty when labels are shown
    }
  }, [selected, t]);

  const createItemId = (value: any) =>
    `select-multi-typeahead-statuses-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions[itemIndex];
    setActiveItemId(createItemId(focusedItem.value));
  };

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (selectOptions.every((option) => option.isDisabled)) {
      return;
    }

    if (key === 'ArrowUp') {
      // When no index is set or at the first index, focus to the last, otherwise decrement focus index
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = selectOptions.length - 1;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }

      // Skip disabled options
      while (selectOptions[indexToFocus].isDisabled) {
        indexToFocus--;
        if (indexToFocus === -1) {
          indexToFocus = selectOptions.length - 1;
        }
      }
    }

    if (key === 'ArrowDown') {
      // When no index is set or at the last index, focus to the first, otherwise increment focus index
      if (focusedItemIndex === null || focusedItemIndex === selectOptions.length - 1) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }

      // Skip disabled options
      while (selectOptions[indexToFocus].isDisabled) {
        indexToFocus++;
        if (indexToFocus === selectOptions.length) {
          indexToFocus = 0;
        }
      }
    }

    setActiveAndFocusedItem(indexToFocus);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions[focusedItemIndex] : null;

    switch (event.key) {
      case 'Enter':
        if (
          isOpen &&
          focusedItem &&
          focusedItem.value !== NO_RESULTS &&
          !focusedItem.isAriaDisabled
        ) {
          handleSelect(focusedItem.value as SubscriptionStatus);
        }

        if (!isOpen) {
          setIsOpen(true);
        }

        break;
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        handleMenuArrowKeys(event.key);
        break;
    }
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onTextInputChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setInputValue(value);
    resetActiveAndFocusedItem();
  };

  const handleSelect = (value: SubscriptionStatus | string) => {
    // Type guard: NO_RESULTS is a UI-only sentinel value, not a valid SubscriptionStatus
    if (value && value !== NO_RESULTS) {
      const newSelected = selected.includes(value as SubscriptionStatus)
        ? selected.filter((selection) => selection !== value)
        : [...selected, value as SubscriptionStatus];
      onSelect(newSelected);
    }

    textInputRef.current?.focus();
  };

  const onClearButtonClick = () => {
    onSelect([]);
    setInputValue('');
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      variant="typeahead"
      aria-label={t('pages.adminSubscriptions.filters.status', 'Filter by status')}
      onClick={onToggleClick}
      innerRef={toggleRef}
      isExpanded={isOpen}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="multi-typeahead-select-statuses-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={placeholder}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-multi-typeahead-statuses-listbox"
        >
          <LabelGroup
            aria-label={t('pages.adminSubscriptions.filters.selectedStatuses', 'Selected statuses')}
          >
            {selected.map((status, index) => (
              <Label
                key={index}
                variant="outline"
                isCompact
                onClose={(ev) => {
                  ev.stopPropagation();
                  handleSelect(status);
                }}
              >
                {truncateText(getStatusDisplayName(status))}
              </Label>
            ))}
          </LabelGroup>
        </TextInputGroupMain>
        <TextInputGroupUtilities {...(selected.length === 0 ? { style: { display: 'none' } } : {})}>
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label={t(
              'pages.adminSubscriptions.filters.clearStatuses',
              'Clear status selection',
            )}
            icon={<TimesIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      role="menu"
      id="multi-typeahead-statuses-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={(_event, selection) => handleSelect(selection as SubscriptionStatus)}
      onOpenChange={(isOpen) => {
        !isOpen && closeMenu();
      }}
      toggle={toggle}
      variant="typeahead"
    >
      <SelectList isAriaMultiselectable id="select-multi-typeahead-statuses-listbox">
        {selectOptions.map((option, index) => (
          <SelectOption
            {...(!option.isDisabled && !option.isAriaDisabled && { hasCheckbox: true })}
            isSelected={selected.includes(option.value as SubscriptionStatus)}
            key={option.value || option.children}
            isFocused={focusedItemIndex === index}
            className={option.className}
            id={createItemId(option.value)}
            {...option}
            ref={null}
          />
        ))}
      </SelectList>
    </Select>
  );
};
