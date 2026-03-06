import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Title,
  Button,
  Alert,
  Tooltip,
  Form,
  TextInput,
  ActionGroup,
  Divider,
  Content,
  ContentVariants,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
} from '@patternfly/react-core';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin.service';
import type { ApiKeyQuotaDefaults } from '../../types/users';
import { extractErrorDetails } from '../../utils/error.utils';
import { useCurrency } from '../../contexts/ConfigContext';

interface ApiKeyQuotaDefaultsSectionProps {
  canEdit: boolean;
  isVisible: boolean;
}

const ApiKeyQuotaDefaultsSection: React.FC<ApiKeyQuotaDefaultsSectionProps> = ({
  canEdit,
  isVisible,
}) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const { currencyCode } = useCurrency();

  const [apiKeyDefaults, setApiKeyDefaults] = useState<ApiKeyQuotaDefaults>({
    defaults: {},
    maximums: {},
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load API key defaults when section becomes visible
  useEffect(() => {
    if (isVisible) {
      adminService
        .getApiKeyDefaults()
        .then((data) => {
          setApiKeyDefaults(data);
        })
        .catch((err) => {
          console.error('Failed to load API key defaults:', err);
        });
    }
  }, [isVisible]);

  const handleFieldChange = (section: 'defaults' | 'maximums', field: string, value: string) => {
    setSaveSuccess(false);
    setApiKeyDefaults((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value === '' ? null : field === 'budgetDuration' ? value : parseFloat(value),
      },
    }));
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setIsLoading(true);
    setSaveSuccess(false);

    try {
      const result = await adminService.updateApiKeyDefaults(apiKeyDefaults);
      setApiKeyDefaults(result);
      setSaveSuccess(true);

      addNotification({
        variant: 'success',
        title: t('pages.tools.apiKeyDefaults.saveSuccess'),
        description: t('pages.tools.apiKeyDefaults.saveSuccessDescription'),
      });
    } catch (error) {
      console.error('Failed to save API key defaults:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.tools.apiKeyDefaults.saveError'),
        description:
          extractErrorDetails(error).message || t('pages.tools.apiKeyDefaults.saveErrorGeneric'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const labelWithTooltip = (labelKey: string, tooltipKey: string, interpolation?: Record<string, string>) => (
    <span>
      {t(labelKey, interpolation)}{' '}
      <Tooltip content={t(tooltipKey, interpolation)}>
        <OutlinedQuestionCircleIcon
          style={{ color: 'var(--pf-t--global--icon--color--subtle)', cursor: 'pointer' }}
        />
      </Tooltip>
    </span>
  );

  return (
    <>
      <Divider style={{ margin: '1.5rem 0' }} />
      <Title headingLevel="h3" size="lg" style={{ marginBottom: '0.5rem' }}>
        {t('pages.tools.apiKeyDefaults.title')}
      </Title>
      <Content component={ContentVariants.p} style={{ marginBottom: '1rem' }}>
        {t('pages.tools.apiKeyDefaults.description')}
      </Content>

      {saveSuccess && (
        <Alert
          variant="success"
          title={t('pages.tools.apiKeyDefaults.saveSuccess')}
          isInline
          style={{ marginBottom: '1rem' }}
        />
      )}

      <Form>
        {/* Column headers */}
        <Grid hasGutter>
          <GridItem span={4} />
          <GridItem span={4}>
            <Content component={ContentVariants.small}>
              <strong>{t('pages.tools.apiKeyDefaults.columnDefault')}</strong>
            </Content>
          </GridItem>
          <GridItem span={4}>
            <Content component={ContentVariants.small}>
              <strong>{t('pages.tools.apiKeyDefaults.columnMaximum')}</strong>
            </Content>
          </GridItem>
        </Grid>

        {/* TPM row */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.apiKeyDefaults.tpmLabel',
              'pages.tools.apiKeyDefaults.tpmTooltip',
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="defaults-tpm-limit"
              type="number"
              min="0"
              step="1000"
              value={apiKeyDefaults.defaults.tpmLimit ?? ''}
              onChange={(_event, value) => handleFieldChange('defaults', 'tpmLimit', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noDefault')}
              isDisabled={!canEdit}
              aria-label={
                t('pages.tools.apiKeyDefaults.tpmLabel') +
                ' - ' +
                t('pages.tools.apiKeyDefaults.columnDefault')
              }
            />
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="maximums-tpm-limit"
              type="number"
              min="0"
              step="1000"
              value={apiKeyDefaults.maximums.tpmLimit ?? ''}
              onChange={(_event, value) => handleFieldChange('maximums', 'tpmLimit', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noMaximum')}
              isDisabled={!canEdit}
              aria-label={
                t('pages.tools.apiKeyDefaults.tpmLabel') +
                ' - ' +
                t('pages.tools.apiKeyDefaults.columnMaximum')
              }
            />
          </GridItem>
        </Grid>

        {/* RPM row */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.apiKeyDefaults.rpmLabel',
              'pages.tools.apiKeyDefaults.rpmTooltip',
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="defaults-rpm-limit"
              type="number"
              min="0"
              step="10"
              value={apiKeyDefaults.defaults.rpmLimit ?? ''}
              onChange={(_event, value) => handleFieldChange('defaults', 'rpmLimit', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noDefault')}
              isDisabled={!canEdit}
              aria-label={
                t('pages.tools.apiKeyDefaults.rpmLabel') +
                ' - ' +
                t('pages.tools.apiKeyDefaults.columnDefault')
              }
            />
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="maximums-rpm-limit"
              type="number"
              min="0"
              step="10"
              value={apiKeyDefaults.maximums.rpmLimit ?? ''}
              onChange={(_event, value) => handleFieldChange('maximums', 'rpmLimit', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noMaximum')}
              isDisabled={!canEdit}
              aria-label={
                t('pages.tools.apiKeyDefaults.rpmLabel') +
                ' - ' +
                t('pages.tools.apiKeyDefaults.columnMaximum')
              }
            />
          </GridItem>
        </Grid>

        {/* Max Budget row */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.apiKeyDefaults.maxBudgetLabel',
              'pages.tools.apiKeyDefaults.maxBudgetTooltip',
              { currencyCode },
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="defaults-max-budget"
              type="number"
              min="0"
              step="1"
              value={apiKeyDefaults.defaults.maxBudget ?? ''}
              onChange={(_event, value) => handleFieldChange('defaults', 'maxBudget', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noDefault')}
              isDisabled={!canEdit}
              aria-label={
                t('pages.tools.apiKeyDefaults.maxBudgetLabel', { currencyCode }) +
                ' - ' +
                t('pages.tools.apiKeyDefaults.columnDefault')
              }
            />
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="maximums-max-budget"
              type="number"
              min="0"
              step="1"
              value={apiKeyDefaults.maximums.maxBudget ?? ''}
              onChange={(_event, value) => handleFieldChange('maximums', 'maxBudget', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noMaximum')}
              isDisabled={!canEdit}
              aria-label={
                t('pages.tools.apiKeyDefaults.maxBudgetLabel', { currencyCode }) +
                ' - ' +
                t('pages.tools.apiKeyDefaults.columnMaximum')
              }
            />
          </GridItem>
        </Grid>

        {/* Budget Duration row — default only */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.apiKeyDefaults.budgetDurationLabel',
              'pages.tools.apiKeyDefaults.budgetDurationTooltip',
            )}
          </GridItem>
          <GridItem span={4}>
            <FormSelect
              id="defaults-budget-duration"
              value={apiKeyDefaults.defaults.budgetDuration ?? ''}
              onChange={(_event, value) => handleFieldChange('defaults', 'budgetDuration', value)}
              isDisabled={!canEdit}
              aria-label={t('pages.tools.apiKeyDefaults.budgetDurationLabel')}
            >
              <FormSelectOption value="" label={t('pages.tools.apiKeyDefaults.noDefault')} />
              <FormSelectOption value="daily" label={t('pages.tools.apiKeyDefaults.daily')} />
              <FormSelectOption value="weekly" label={t('pages.tools.apiKeyDefaults.weekly')} />
              <FormSelectOption value="monthly" label={t('pages.tools.apiKeyDefaults.monthly')} />
              <FormSelectOption value="yearly" label={t('pages.tools.apiKeyDefaults.yearly')} />
            </FormSelect>
          </GridItem>
          <GridItem span={4}>
            <Content
              component={ContentVariants.small}
              style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
            >
              —
            </Content>
          </GridItem>
        </Grid>

        {/* Soft Budget row — hidden (requires LiteLLM Enterprise) */}
        {/* When LiteLLM Enterprise is available, uncomment this block:
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.apiKeyDefaults.softBudgetLabel',
              'pages.tools.apiKeyDefaults.softBudgetTooltip',
              { currencyCode },
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="defaults-soft-budget"
              type="number"
              min="0"
              step="1"
              value={apiKeyDefaults.defaults.softBudget ?? ''}
              onChange={(_event, value) => handleFieldChange('defaults', 'softBudget', value)}
              placeholder={t('pages.tools.apiKeyDefaults.noDefault')}
              isDisabled={!canEdit}
              aria-label={t('pages.tools.apiKeyDefaults.softBudgetLabel', { currencyCode })}
            />
          </GridItem>
          <GridItem span={4}>
            <Content component={ContentVariants.small} style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
              —
            </Content>
          </GridItem>
        </Grid>
        */}

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSave}
            isDisabled={!canEdit || isLoading}
            isLoading={isLoading}
          >
            {isLoading
              ? t('pages.tools.apiKeyDefaults.saving')
              : t('pages.tools.apiKeyDefaults.saveDefaults')}
          </Button>
        </ActionGroup>
      </Form>
    </>
  );
};

export default ApiKeyQuotaDefaultsSection;
