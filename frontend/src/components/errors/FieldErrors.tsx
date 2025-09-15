import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormHelperText, HelperText, HelperTextItem, List, ListItem } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { ExtractedError, getValidationErrors } from '../../utils/error.utils';

interface FieldErrorsProps {
  /** The extracted error containing validation errors */
  error?: ExtractedError | unknown;
  /** Specific field name to filter errors for */
  fieldName?: string;
  /** Whether to show multiple errors per field */
  showMultiple?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Whether to use live region for screen reader announcements */
  isLiveRegion?: boolean;
}

interface SingleFieldErrorProps {
  /** Single validation error */
  error: ExtractedError;
  /** Field name to show errors for */
  fieldName: string;
  /** Whether to use live region */
  isLiveRegion?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Component for displaying field-level validation errors from an ExtractedError
 * Uses PatternFly 6 FormHelperText and HelperText components
 */
export const FieldErrors: React.FC<FieldErrorsProps> = ({
  error,
  fieldName,
  showMultiple = true,
  className,
  isLiveRegion = true,
}) => {
  const { t } = useTranslation();

  if (!error) {
    return null;
  }

  // Extract validation errors from the error object
  const validationErrors = getValidationErrors(error);

  if (validationErrors.length === 0) {
    return null;
  }

  // Filter errors for specific field if provided
  const filteredErrors = fieldName
    ? validationErrors.filter((validationError) => validationError.field === fieldName)
    : validationErrors;

  if (filteredErrors.length === 0) {
    return null;
  }

  // Show only first error if showMultiple is false
  const errorsToShow = showMultiple ? filteredErrors : filteredErrors.slice(0, 1);

  return (
    <FormHelperText className={className}>
      <HelperText>
        {errorsToShow.map((validationError, index) => (
          <HelperTextItem
            key={`${validationError.field}-${validationError.code}-${index}`}
            variant="error"
            icon={<ExclamationCircleIcon />}
            {...(isLiveRegion && { 'aria-live': 'polite' })}
          >
            {/* Try to get translated error message first */}
            {t(`errors.validation.${validationError.code}`, {
              field: validationError.field,
              defaultValue: validationError.message,
            })}
          </HelperTextItem>
        ))}
      </HelperText>
    </FormHelperText>
  );
};

/**
 * Simplified component for displaying errors for a single specific field
 * Useful when you know the field name and want cleaner usage
 */
export const SingleFieldError: React.FC<SingleFieldErrorProps> = ({
  error,
  fieldName,
  isLiveRegion = true,
  className,
}) => {
  return (
    <FieldErrors
      error={error}
      fieldName={fieldName}
      showMultiple={false}
      isLiveRegion={isLiveRegion}
      className={className}
    />
  );
};

/**
 * Component for displaying all validation errors in a summary format
 * Useful for showing all form errors at the top of a form
 */
export const ValidationErrorSummary: React.FC<{
  error?: ExtractedError | unknown;
  className?: string;
  title?: string;
}> = ({ error, className, title }) => {
  const { t } = useTranslation();

  if (!error) {
    return null;
  }

  const validationErrors = getValidationErrors(error);

  if (validationErrors.length === 0) {
    return null;
  }

  // Group errors by field for better presentation
  const errorsByField = validationErrors.reduce(
    (acc, validationError) => {
      const field = validationError.field || t('errors.unknownField');
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push(validationError);
      return acc;
    },
    {} as Record<string, typeof validationErrors>,
  );

  return (
    <FormHelperText className={className}>
      <HelperText>
        <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
          <div>
            {title && <strong>{title}</strong>}
            <List isPlain className="pf-v6-u-margin-top-sm">
              {Object.entries(errorsByField).map(([field, fieldErrors]) => (
                <ListItem key={field}>
                  <strong>{field}:</strong>{' '}
                  {fieldErrors
                    .map((fieldError) =>
                      t(`errors.validation.${fieldError.code}`, {
                        field: fieldError.field,
                        defaultValue: fieldError.message,
                      }),
                    )
                    .join(', ')}
                </ListItem>
              ))}
            </List>
          </div>
        </HelperTextItem>
      </HelperText>
    </FormHelperText>
  );
};
