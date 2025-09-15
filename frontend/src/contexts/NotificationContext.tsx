import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ToastNotification } from '../components/AlertToastGroup';

export interface Notification {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  timestamp: Date;
  isRead: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface NotificationContextType {
  notifications: Notification[];
  toastNotifications: ToastNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  removeToastNotification: (id: string) => void;
  clearAll: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const lastNotificationRef = useRef<{ title: string; description?: string; timestamp: number }>({
    title: '',
    description: '',
    timestamp: 0,
  });

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
      const now = Date.now();

      // Deduplicate notifications - prevent identical notifications within 500ms
      // This handles React StrictMode double rendering and parallel API calls
      if (
        lastNotificationRef.current.title === notification.title &&
        lastNotificationRef.current.description === notification.description &&
        now - lastNotificationRef.current.timestamp < 500
      ) {
        return; // Skip duplicate notification
      }

      // Update last notification reference
      lastNotificationRef.current = {
        title: notification.title,
        description: notification.description,
        timestamp: now,
      };

      const newNotification: Notification = {
        ...notification,
        id: uuidv4(),
        timestamp: new Date(),
        isRead: false,
      };

      // Add to drawer notifications
      setNotifications((prev) => [newNotification, ...prev]);

      // Also add to toast notifications (all types auto-hide)
      const toastNotification: ToastNotification = {
        id: newNotification.id,
        title: newNotification.title,
        description: newNotification.description,
        variant: newNotification.variant === 'default' ? 'custom' : newNotification.variant,
        timeout: 2000, // All notifications auto-hide after 2 seconds
      };

      setToastNotifications((prev) => [...prev, toastNotification]);

      // Auto-remove success notifications from drawer after 5 seconds
      if (notification.variant === 'success') {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
        }, 2000);
      }
    },
    [],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const removeToastNotification = useCallback((id: string) => {
    setToastNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToastNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const value: NotificationContextType = {
    notifications,
    toastNotifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    removeToastNotification,
    clearAll,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
