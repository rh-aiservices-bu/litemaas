import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
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
import { apiClient } from '../../services/api';

interface ApiKeyOption {
  id: string;
  name: string;
  keyAlias: string;
  userId: string;
  username: string;
  email: string;
}

interface ApiKeyFilterSelectProps {
  selected: string[];
  onSelect: (keyAliases: string[]) => void;
  selectedUserIds: string[];
  isDisabled?: boolean;
}

/**
 * Multi-select typeahead filter for API keys
 * Follows PatternFly 6 Multiple typeahead with checkboxes pattern
 * Cascades from UserFilterSelect - only enabled when users are selected
 */
export const ApiKeyFilterSelect: React.FC<ApiKeyFilterSelectProps> = ({
  selected,
  onSelect,
  selectedUserIds,
  isDisabled = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(
    t('adminUsage.filters.apiKeysPlaceholder', 'Select users first to filter by API keys'),
  );
  const textInputRef = useRef<HTMLInputElement>(undefined);

  const NO_RESULTS = 'no results';

  // Fetch API keys from API - only when users are selected
  const { data: apiKeysData, error: apiKeysError } = useQuery(
    ['api-keys-for-filter', selectedUserIds.sort().join(',')],
    async () => {
      const params = new URLSearchParams();
      selectedUserIds.forEach((id) => params.append('userIds', id));
      const response = await apiClient.get<{ apiKeys: ApiKeyOption[] }>(
        `/admin/api-keys?${params.toString()}`,
      );
      return response.apiKeys;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      enabled: selectedUserIds.length > 0 && !isDisabled,
    },
  );

  const allApiKeys = apiKeysData || [];

  // Convert API keys to select options
  const initialSelectOptions: SelectOptionProps[] = allApiKeys.map((apiKey) => ({
    value: apiKey.keyAlias,
    children: `${apiKey.name} (${apiKey.username})`,
  }));

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 15): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Helper function to get API key display name
  const getApiKeyDisplayName = (keyAlias: string): string => {
    const apiKey = allApiKeys.find((k) => k.keyAlias === keyAlias);
    return apiKey ? apiKey.name : keyAlias;
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
            children: t('adminUsage.filters.noApiKeysFound', 'No API keys found for "{{query}}"', {
              query: inputValue,
            }),
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
    if (isDisabled || selectedUserIds.length === 0) {
      setPlaceholder(
        t('adminUsage.filters.apiKeysPlaceholder', 'Select users first to filter by API keys'),
      );
    } else if (selected.length === 0) {
      setPlaceholder(
        t('adminUsage.filters.apiKeysPlaceholderActive', 'All API keys (click to filter)'),
      );
    } else {
      setPlaceholder(''); // Empty when labels are shown
    }
  }, [selected, selectedUserIds, isDisabled, t]);

  // Show error state if API key loading failed
  useEffect(() => {
    if (apiKeysError && selectedUserIds.length > 0 && !isDisabled) {
      setPlaceholder(t('adminUsage.filters.apiKeysLoadError', 'Failed to load API keys'));
    }
  }, [apiKeysError, selectedUserIds, isDisabled, t]);

  // Show no API keys available state
  useEffect(() => {
    if (
      selectedUserIds.length > 0 &&
      !isDisabled &&
      !apiKeysError &&
      allApiKeys.length === 0 &&
      apiKeysData !== undefined
    ) {
      setPlaceholder(
        t('adminUsage.filters.noApiKeysAvailable', 'No API keys available for selected users'),
      );
    }
  }, [selectedUserIds, isDisabled, apiKeysError, allApiKeys, apiKeysData, t]);

  const createItemId = (value: any) =>
    `select-multi-typeahead-api-keys-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

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
    if (isDisabled) {
      return;
    }
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
    if (isDisabled) {
      return;
    }

    const focusedItem = focusedItemIndex !== null ? selectOptions[focusedItemIndex] : null;

    switch (event.key) {
      case 'Enter':
        if (
          isOpen &&
          focusedItem &&
          focusedItem.value !== NO_RESULTS &&
          !focusedItem.isAriaDisabled
        ) {
          handleSelect(focusedItem.value as string);
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
    if (isDisabled) {
      return;
    }
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onTextInputChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    if (isDisabled) {
      return;
    }
    setInputValue(value);
    resetActiveAndFocusedItem();
  };

  const handleSelect = (value: string) => {
    if (value && value !== NO_RESULTS) {
      const newSelected = selected.includes(value)
        ? selected.filter((selection) => selection !== value)
        : [...selected, value];
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
      aria-label={t('adminUsage.filters.apiKeys', 'Filter by API keys')}
      onClick={onToggleClick}
      innerRef={toggleRef}
      isExpanded={isOpen}
      isFullWidth
      isDisabled={isDisabled}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="multi-typeahead-select-api-keys-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={placeholder}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-multi-typeahead-api-keys-listbox"
          disabled={isDisabled}
        >
          <LabelGroup aria-label={t('adminUsage.filters.selectedApiKeys', 'Selected API keys')}>
            {selected.map((keyAlias, index) => (
              <Label
                key={index}
                variant="outline"
                isCompact
                onClose={(ev) => {
                  ev.stopPropagation();
                  handleSelect(keyAlias);
                }}
              >
                {truncateText(getApiKeyDisplayName(keyAlias))}
              </Label>
            ))}
          </LabelGroup>
        </TextInputGroupMain>
        <TextInputGroupUtilities
          {...(selected.length === 0 || isDisabled ? { style: { display: 'none' } } : {})}
        >
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label={t('adminUsage.filters.clearApiKeysFilter', 'Clear API key filter')}
            icon={<TimesIcon />}
            isDisabled={isDisabled}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      role="menu"
      id="multi-typeahead-api-keys-select"
      isOpen={isOpen && !isDisabled}
      selected={selected}
      onSelect={(_event, selection) => handleSelect(selection as string)}
      onOpenChange={(isOpen) => {
        !isOpen && closeMenu();
      }}
      toggle={toggle}
      variant="typeahead"
    >
      <SelectList isAriaMultiselectable id="select-multi-typeahead-api-keys-listbox">
        {selectOptions.map((option, index) => (
          <SelectOption
            {...(!option.isDisabled && !option.isAriaDisabled && { hasCheckbox: true })}
            isSelected={selected.includes(option.value as string)}
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
