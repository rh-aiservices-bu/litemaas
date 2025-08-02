import React from 'react';
import { Alert, AlertProps, AlertGroup, AlertActionCloseButton } from '@patternfly/react-core';

export interface ToastNotification {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'custom';
  timeout?: number;
}

interface AlertToastGroupProps {
  notifications: ToastNotification[];
  onRemove: (id: string) => void;
}

export const AlertToastGroup: React.FC<AlertToastGroupProps> = ({ notifications, onRemove }) => {
  // Map our variant types to PatternFly AlertVariant
  const getAlertVariant = (variant?: string): AlertProps['variant'] => {
    switch (variant) {
      case 'success':
        return 'success';
      case 'danger':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'custom';
    }
  };

  return (
    <AlertGroup isToast isLiveRegion>
      {notifications.map((notification) => (
        <Alert
          key={notification.id}
          variant={getAlertVariant(notification.variant)}
          title={notification.title}
          timeout={notification.timeout || 5000}
          onTimeout={() => onRemove(notification.id)}
          actionClose={
            <AlertActionCloseButton
              title={`Close ${notification.title}`}
              variantLabel={`${getAlertVariant(notification.variant)} alert`}
              onClose={() => onRemove(notification.id)}
            />
          }
        >
          {notification.description}
        </Alert>
      ))}
    </AlertGroup>
  );
};
