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

interface UserOption {
  userId: string;
  username: string;
  email: string;
}

interface UserFilterSelectProps {
  selected: string[];
  onSelect: (userIds: string[]) => void;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Multi-select typeahead filter for users
 * Follows PatternFly 6 Multiple typeahead with checkboxes pattern
 *
 * When dateRange is provided, fetches users from usage data (including inactive users).
 * Otherwise fetches currently active users from /admin/users endpoint.
 */
export const UserFilterSelect: React.FC<UserFilterSelectProps> = ({
  selected,
  onSelect,
  dateRange,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(
    t('adminUsage.filters.usersPlaceholder', '0 users selected', { count: 0 }),
  );
  const textInputRef = useRef<HTMLInputElement>(undefined);

  const NO_RESULTS = 'no results';

  // Fetch users from API - either from /admin/users or from usage data based on dateRange
  const { data: usersData } = useQuery(
    dateRange ? ['users-from-usage', dateRange.startDate, dateRange.endDate] : ['users-for-filter'],
    async () => {
      if (dateRange) {
        // Fetch users that have usage data in the specified date range
        const response = await apiClient.get<{
          models: Array<{ id: string; name: string; provider: string }>;
          users: UserOption[];
        }>(
          `/admin/usage/filter-options?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        );
        return response.users;
      } else {
        // Fetch currently active users
        const response = await apiClient.get<{ users: UserOption[] }>('/admin/users');
        return response.users;
      }
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      enabled: !dateRange || (!!dateRange.startDate && !!dateRange.endDate),
    },
  );

  const allUsers = usersData || [];

  // Convert users to select options
  const initialSelectOptions: SelectOptionProps[] = allUsers.map((user) => ({
    value: user.userId,
    children: `${user.username} (${user.email})`,
  }));

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 15): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Helper function to get user display name
  const getUserDisplayName = (userId: string): string => {
    const user = allUsers.find((u) => u.userId === userId);
    return user ? user.username : userId;
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
            children: t('adminUsage.filters.noUsersFound', 'No users found for "{{query}}"', {
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
    if (selected.length === 0) {
      setPlaceholder(t('adminUsage.filters.usersPlaceholder', 'All users (click to filter)'));
    } else {
      setPlaceholder(''); // Empty when labels are shown
    }
  }, [selected, t]);

  const createItemId = (value: any) =>
    `select-multi-typeahead-users-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

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
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onTextInputChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
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
      aria-label={t('adminUsage.filters.users', 'Filter by users')}
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
          id="multi-typeahead-select-users-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={placeholder}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-multi-typeahead-users-listbox"
        >
          <LabelGroup aria-label={t('adminUsage.filters.selectedUsers', 'Selected users')}>
            {selected.map((userId, index) => (
              <Label
                key={index}
                variant="outline"
                isCompact
                onClose={(ev) => {
                  ev.stopPropagation();
                  handleSelect(userId);
                }}
              >
                {truncateText(getUserDisplayName(userId))}
              </Label>
            ))}
          </LabelGroup>
        </TextInputGroupMain>
        <TextInputGroupUtilities {...(selected.length === 0 ? { style: { display: 'none' } } : {})}>
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label={t('adminUsage.filters.clearUsers', 'Clear user selection')}
            icon={<TimesIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      role="menu"
      id="multi-typeahead-users-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={(_event, selection) => handleSelect(selection as string)}
      onOpenChange={(isOpen) => {
        !isOpen && closeMenu();
      }}
      toggle={toggle}
      variant="typeahead"
    >
      <SelectList isAriaMultiselectable id="select-multi-typeahead-users-listbox">
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
