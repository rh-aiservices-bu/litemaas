import React, { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../contexts/NotificationContext';
import { ScreenReaderAnnouncement } from './ScreenReaderAnnouncement';

interface NotificationDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = (_props) => {
  const { t } = useTranslation();
  const { notifications, markAsRead, markAllAsRead, removeNotification, clearAll } =
    useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Track new notifications for announcements
  React.useEffect(() => {
    if (notifications.length > lastNotificationCount && lastNotificationCount > 0) {
      // New notifications detected - the individual notifications will be announced
      // via the ScreenReaderAnnouncement component below
    }
    setLastNotificationCount(notifications.length);
  }, [notifications.length, lastNotificationCount]);

  const onDropdownSelect = () => {
    setIsDropdownOpen(false);
  };

  const onDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const notificationDrawerActions = (
    <>
      <DropdownItem key="markAllRead" onClick={markAllAsRead}>
        {t('ui.notifications.markAllRead')}
      </DropdownItem>
      <DropdownItem key="clearAll" onClick={clearAll}>
        {t('ui.notifications.clearAll')}
      </DropdownItem>
    </>
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

  // Get the latest unread notification for announcement
  const latestUnreadNotification = notifications.find((n) => !n.isRead);
  const notificationAnnouncement = latestUnreadNotification
    ? `${latestUnreadNotification.title}. ${latestUnreadNotification.description || ''}`
    : '';

  return (
    <>
      {latestUnreadNotification && (
        <ScreenReaderAnnouncement
          message={notificationAnnouncement}
          priority={latestUnreadNotification.variant === 'danger' ? 'assertive' : 'polite'}
          announcementKey={latestUnreadNotification.id}
        />
      )}
      <PFNotificationDrawer>
        <NotificationDrawerHeader count={unreadCount}>
          <Dropdown
            id="notification-drawer-0"
            isOpen={isDropdownOpen}
            onSelect={onDropdownSelect}
            popperProps={{ position: 'right' }}
            onOpenChange={(isOpen: boolean) => !isOpen && setIsDropdownOpen(false)}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                isExpanded={isDropdownOpen}
                variant="plain"
                onClick={onDropdownToggle}
                aria-label={t('ui.notifications.drawerActions')}
                icon={<EllipsisVIcon />}
              />
            )}
          >
            <DropdownList>{notificationDrawerActions}</DropdownList>
          </Dropdown>
        </NotificationDrawerHeader>
        <NotificationDrawerBody>
          {notifications.length === 0 ? (
            <EmptyState variant={EmptyStateVariant.sm}>
              <BellIcon
                style={{
                  fontSize: 'var(--pf-t--global--font--size--3xl)',
                  color: 'var(--pf-t--global--color--nonstatus--gray--default)',
                }}
              />
              <Title headingLevel="h3" size="md">
                {t('ui.notifications.noNotificationsFound')}
              </Title>
              <EmptyStateBody>{t('ui.notifications.noNotificationsDescription')}</EmptyStateBody>
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
                    srTitle={t('ui.notifications.notificationSrTitle')}
                  >
                    <Button
                      variant="plain"
                      aria-label={`Remove notification: ${notification.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                    >
                      ×
                    </Button>
                  </NotificationDrawerListItemHeader>
                  <NotificationDrawerListItemBody
                    timestamp={notification.timestamp.toLocaleString()}
                  >
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
    </>
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
  const { t } = useTranslation();
  return (
    <NotificationBadge
      count={unreadCount}
      onClick={onClick}
      aria-label={t('ui.notifications.notificationsLabel')}
    />
  );
};
