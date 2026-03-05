import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardTitle,
  FormGroup,
  Form,
  FormSelect,
  FormSelectOption,
  ActionGroup,
  Button,
  Alert,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import { useQuery, useQueryClient } from 'react-query';
import { adminService } from '../../services/admin.service';
import { useNotifications } from '../../contexts/NotificationContext';
import { useCurrency } from '../../contexts/ConfigContext';
import { extractErrorDetails } from '../../utils/error.utils';
import type { CurrencySettings } from '../../types/currency';

interface CurrencyTabProps {
  canManage: boolean;
}

const CurrencyTab: React.FC<CurrencyTabProps> = ({ canManage }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const { currencyCode: currentCode } = useCurrency();

  const [selectedCode, setSelectedCode] = useState(currentCode);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch supported currencies
  const {
    data: supportedCurrencies,
    isLoading: isLoadingCurrencies,
    error: loadError,
  } = useQuery<CurrencySettings[]>(
    ['supportedCurrencies'],
    () => adminService.getSupportedCurrencies(),
    {
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  );

  // Sync local state when config changes
  useEffect(() => {
    setSelectedCode(currentCode);
  }, [currentCode]);

  const selectedCurrency = supportedCurrencies?.find((c) => c.code === selectedCode);

  const formatPreview = (amount: number): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: selectedCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${selectedCode} ${amount.toFixed(2)}`;
    }
  };

  const handleSave = async () => {
    if (!selectedCurrency) return;

    setIsSaving(true);
    try {
      await adminService.updateCurrencySettings(selectedCurrency);
      // Invalidate config query to refresh currency across the app
      await queryClient.invalidateQueries(['backendConfig', 'v2']);
      addNotification({
        title: t('pages.tools.currency.saveSuccess'),
        variant: 'success',
      });
    } catch (error) {
      const details = extractErrorDetails(error);
      addNotification({
        title: t('pages.tools.currency.saveError'),
        description: details.message,
        variant: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedCode !== currentCode;

  if (loadError) {
    return (
      <Alert variant="danger" isInline title={t('pages.tools.currency.loadError')}>
        {(loadError as Error).message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardTitle>{t('pages.tools.currency.tabTitle')}</CardTitle>
      <CardBody>
        <Content component={ContentVariants.p} style={{ marginBottom: '1rem' }}>
          {t('pages.tools.currency.description')}
        </Content>

        <Form>
          <FormGroup label={t('pages.tools.currency.selectCurrency')} fieldId="currency-select">
            <FormSelect
              id="currency-select"
              value={selectedCode}
              onChange={(_event, value) => setSelectedCode(value)}
              isDisabled={!canManage || isLoadingCurrencies}
              aria-label={t('pages.tools.currency.currencySelectAriaLabel')}
            >
              {(supportedCurrencies ?? []).map((currency) => (
                <FormSelectOption
                  key={currency.code}
                  value={currency.code}
                  label={`${currency.name} (${currency.symbol})`}
                />
              ))}
            </FormSelect>
          </FormGroup>

          {selectedCurrency && (
            <FormGroup label={t('pages.tools.currency.previewTitle')} fieldId="currency-preview">
              <Content component={ContentVariants.p}>
                {t('pages.tools.currency.previewExample')}: {formatPreview(1234.56)}
              </Content>
            </FormGroup>
          )}

          <Alert
            variant="info"
            isInline
            isPlain
            title={t('pages.tools.currency.note')}
            style={{ marginBottom: '1rem' }}
          >
            {t('pages.tools.currency.noteDescription')}
          </Alert>

          {canManage && (
            <ActionGroup>
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={isSaving}
                isDisabled={isSaving || !hasChanges}
              >
                {isSaving ? t('pages.tools.currency.saving') : t('pages.tools.currency.save')}
              </Button>
            </ActionGroup>
          )}
        </Form>
      </CardBody>
    </Card>
  );
};

export default CurrencyTab;
