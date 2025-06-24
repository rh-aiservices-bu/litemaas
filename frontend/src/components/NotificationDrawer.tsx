import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NotificationDrawer as PFNotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  Button,
  NotificationBadge,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';
import { BellIcon, EllipsisVIcon } from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = () => {
  const { t } = useTranslation();
  const { notifications, markAsRead, markAllAsRead, removeNotification, clearAll } =
    useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownItems = (
    <DropdownList>
      <DropdownItem key="mark-all-read" onClick={markAllAsRead}>
        {t('ui.notifications.markRead')}
      </DropdownItem>
      <DropdownItem key="clear-all" onClick={clearAll}>
        {t('ui.notifications.clear')}
      </DropdownItem>
    </DropdownList>
  );

  const getVariantIcon = (variant?: string) => {
    switch (variant) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'danger':
        return '❌';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  return (
    <PFNotificationDrawer>
      <NotificationDrawerHeader>
        <Title headingLevel="h2" size="lg">
          {t('ui.notifications.title')}
        </Title>
        <Dropdown
          isOpen={isDropdownOpen}
          onSelect={() => setIsDropdownOpen(false)}
          onOpenChange={setIsDropdownOpen}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              aria-label="Notification actions"
              variant="plain"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <EllipsisVIcon />
            </MenuToggle>
          )}
        >
          {dropdownItems}
        </Dropdown>
      </NotificationDrawerHeader>
      <NotificationDrawerBody>
        {notifications.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.sm}>
            <BellIcon
              style={{
                fontSize: '3rem',
                color: 'var(--pf-t--global--color--nonstatus--gray--default)',
              }}
            />
            <Title headingLevel="h3" size="md">
              {t('ui.notifications.empty')}
            </Title>
            <EmptyStateBody>
              You're all caught up! No new notifications at this time.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <NotificationDrawerList>
            {notifications.map((notification) => (
              <NotificationDrawerListItem
                key={notification.id}
                variant={notification.variant === 'default' ? 'custom' : notification.variant}
                isRead={notification.isRead}
                onClick={() => markAsRead(notification.id)}
              >
                <NotificationDrawerListItemHeader
                  variant={notification.variant === 'default' ? 'custom' : notification.variant}
                  title={notification.title}
                  srTitle="Notification"
                >
                  <Dropdown
                    onSelect={() => removeNotification(notification.id)}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        aria-label="Notification actions"
                        variant="plain"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                      >
                        ×
                      </MenuToggle>
                    )}
                  >
                    <DropdownList>
                      <DropdownItem
                        key="remove"
                        onClick={() => removeNotification(notification.id)}
                      >
                        Remove
                      </DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </NotificationDrawerListItemHeader>
                <NotificationDrawerListItemBody timestamp={notification.timestamp.toLocaleString()}>
                  {notification.description && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {getVariantIcon(notification.variant)} {notification.description}
                    </div>
                  )}
                  {notification.actions && notification.actions.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      {notification.actions.map((action, index) => (
                        <Button
                          key={index}
                          variant="link"
                          isInline
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                          }}
                          style={{ marginRight: '1rem' }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </NotificationDrawerListItemBody>
              </NotificationDrawerListItem>
            ))}
          </NotificationDrawerList>
        )}
      </NotificationDrawerBody>
    </PFNotificationDrawer>
  );
};

interface NotificationBadgeButtonProps {
  onClick: () => void;
  unreadCount: number;
}

export const NotificationBadgeButton: React.FC<NotificationBadgeButtonProps> = ({
  onClick,
  unreadCount,
}) => {
  return (
    <Button variant="plain" aria-label="Notifications" onClick={onClick}>
      <NotificationBadge count={unreadCount}>
        <BellIcon />
      </NotificationBadge>
    </Button>
  );
};
