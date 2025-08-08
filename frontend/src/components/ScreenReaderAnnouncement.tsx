import React, { useEffect, useState } from 'react';

export interface ScreenReaderAnnouncementProps {
  /** Message to announce to screen readers */
  message: string;
  /** Priority of the announcement - 'polite' (default) or 'assertive' */
  priority?: 'polite' | 'assertive';
  /** Clear the announcement after this delay in milliseconds (default: 1000) */
  clearDelay?: number;
  /** Unique key to force re-announcement of the same message */
  announcementKey?: string | number;
}

/**
 * ScreenReaderAnnouncement component for announcing dynamic content changes
 * to screen reader users via ARIA live regions.
 *
 * This component provides a centralized way to announce important state changes,
 * form submissions, data updates, and other dynamic content changes that screen
 * reader users should be aware of.
 */
export const ScreenReaderAnnouncement: React.FC<ScreenReaderAnnouncementProps> = ({
  message,
  priority = 'polite',
  clearDelay = 1000,
  announcementKey,
}) => {
  const [currentMessage, setCurrentMessage] = useState<string>('');

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);

      // Clear the message after the specified delay to allow for re-announcement
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, clearDelay);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [message, clearDelay, announcementKey]);

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="pf-v6-screen-reader"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {currentMessage}
    </div>
  );
};

/**
 * Hook for managing screen reader announcements
 */
export const useScreenReaderAnnouncement = () => {
  const [announcement, setAnnouncement] = useState<{
    message: string;
    priority: 'polite' | 'assertive';
    key: number;
  }>({
    message: '',
    priority: 'polite',
    key: 0,
  });

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement({
      message,
      priority,
      key: Date.now(), // Use timestamp as key to force re-announcement
    });
  };

  return {
    announcement,
    announce,
  };
};
