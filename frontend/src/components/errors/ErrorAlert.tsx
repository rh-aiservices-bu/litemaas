import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertProps,
  AlertActionCloseButton,
  Button,
  ExpandableSection,
  List,
  ListItem,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon, RedoIcon } from '@patternfly/react-icons';
import { ExtractedError } from '../../utils/error.utils';

interface ErrorAlertProps {
  /** The extracted error to display */
  error: ExtractedError;
  /** Alert variant, defaults to 'danger' for errors */
  variant?: AlertProps['variant'];
  /** Whether to show a close button */
  closable?: boolean;
  /** Callback when alert is closed */
  onClose?: () => void;
  /** Whether to show retry button for retryable errors */
  showRetry?: boolean;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Whether retry is in progress */
  retryLoading?: boolean;
  /** Whether to show expandable details section */
  showDetails?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Whether to show request ID for debugging */
  showRequestId?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  variant = 'danger',
  closable = false,
  onClose,
  showRetry = false,
  onRetry,
  retryLoading = false,
  showDetails = process.env.NODE_ENV === 'development',
  className,
  showRequestId = true,
}) => {
  const { t } = useTranslation();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // Use suggestion as title if available, otherwise use message
  const title = error.suggestion || error.message;

  // Build action buttons array
  const actionButtons: React.ReactNode[] = [];

  // Retry button for retryable errors
  if (showRetry && error.retryable && onRetry) {
    actionButtons.push(
      <Button
        key="retry"
        variant="link"
        icon={<RedoIcon />}
        isLoading={retryLoading}
        onClick={onRetry}
        aria-label={t('errors.retryAction')}
      >
        {t('errors.retry')}
      </Button>,
    );
  }

  // Close button
  if (closable && onClose) {
    actionButtons.push(
      <AlertActionCloseButton key="close" title={t('common.close')} onClose={onClose} />,
    );
  }

  // Build alert content
  const alertContent = (
    <>
      {/* Main error message if different from title */}
      {error.suggestion && error.message !== error.suggestion && <p>{error.message}</p>}

      {/* Help URL link */}
      {error.helpUrl && (
        <p>
          <Button
            component="a"
            href={error.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="link"
            isInline
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
          >
            {t('errors.moreInfo')}
          </Button>
        </p>
      )}

      {/* Request ID for debugging */}
      {showRequestId && error.requestId && (
        <p className="pf-v6-u-color-100">
          <small>
            {t('errors.requestId')}: <code>{error.requestId}</code>
          </small>
        </p>
      )}

      {/* Retry information */}
      {error.retryable && error.retryAfter && (
        <p className="pf-v6-u-color-200">
          <small>{t('errors.retryAfter', { seconds: error.retryAfter })}</small>
        </p>
      )}

      {/* Expandable details section (development only) */}
      {showDetails && (error.details || error.code || error.statusCode) && (
        <ExpandableSection
          toggleText={isDetailsExpanded ? t('errors.hideDetails') : t('errors.showDetails')}
          onToggle={() => setIsDetailsExpanded(!isDetailsExpanded)}
          isExpanded={isDetailsExpanded}
          className="pf-v6-u-margin-top-md"
        >
          <List>
            {error.code && (
              <ListItem>
                <strong>{t('errors.errorCode')}:</strong> <code>{error.code}</code>
              </ListItem>
            )}
            {error.statusCode && (
              <ListItem>
                <strong>{t('errors.statusCode')}:</strong> {error.statusCode}
              </ListItem>
            )}
            {error.field && (
              <ListItem>
                <strong>{t('errors.field')}:</strong> <code>{error.field}</code>
              </ListItem>
            )}
            {error.details && (
              <ListItem>
                <strong>{t('errors.details')}:</strong>
                <pre className="pf-v6-u-margin-top-sm">
                  <code>{JSON.stringify(error.details, null, 2)}</code>
                </pre>
              </ListItem>
            )}
          </List>
        </ExpandableSection>
      )}
    </>
  );

  return (
    <Alert
      variant={variant}
      title={title}
      className={className}
      actionLinks={
        actionButtons.length > 0 ? (
          <Flex>
            {actionButtons.map((button, index) => (
              <FlexItem key={index}>{button}</FlexItem>
            ))}
          </Flex>
        ) : undefined
      }
    >
      {alertContent}
    </Alert>
  );
};
