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
  Content,
  ContentVariants,
  Grid,
  GridItem,
} from '@patternfly/react-core';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin.service';
import type { UserDefaults } from '../../types/users';
import { extractErrorDetails } from '../../utils/error.utils';

interface EnvDefaults {
  maxBudget: number | null;
  tpmLimit: number | null;
  rpmLimit: number | null;
}

interface UserDefaultsSectionProps {
  canEdit: boolean;
  isVisible: boolean;
}

const UserDefaultsSection: React.FC<UserDefaultsSectionProps> = ({ canEdit, isVisible }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const [userDefaults, setUserDefaults] = useState<UserDefaults>({});
  const [envDefaults, setEnvDefaults] = useState<EnvDefaults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load user defaults when section becomes visible
  useEffect(() => {
    if (isVisible) {
      adminService
        .getUserDefaults()
        .then((data) => {
          const { envDefaults: env, ...dbValues } = data;
          setUserDefaults(dbValues);
          setEnvDefaults(env);
        })
        .catch((err) => {
          console.error('Failed to load user defaults:', err);
        });
    }
  }, [isVisible]);

  const handleFieldChange = (field: string, value: string) => {
    setSaveSuccess(false);
    setUserDefaults((prev) => ({
      ...prev,
      [field]: value === '' ? null : parseFloat(value),
    }));
  };

  const getPlaceholder = (field: keyof EnvDefaults): string => {
    const envValue = envDefaults?.[field];
    if (envValue != null) {
      return t('pages.tools.userDefaults.envDefault', { value: envValue });
    }
    return t('pages.tools.userDefaults.notSet');
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setIsLoading(true);
    setSaveSuccess(false);

    try {
      const result = await adminService.updateUserDefaults(userDefaults);
      // PUT returns UserDefaults (no envDefaults), keep existing envDefaults
      setUserDefaults(result);
      setSaveSuccess(true);

      addNotification({
        variant: 'success',
        title: t('pages.tools.userDefaults.saveSuccess'),
        description: t('pages.tools.userDefaults.saveSuccessDescription'),
      });
    } catch (error) {
      console.error('Failed to save user defaults:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.tools.userDefaults.saveError'),
        description:
          extractErrorDetails(error).message || t('pages.tools.userDefaults.saveErrorGeneric'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const labelWithTooltip = (labelKey: string, tooltipKey: string) => (
    <span>
      {t(labelKey)}{' '}
      <Tooltip content={t(tooltipKey)}>
        <OutlinedQuestionCircleIcon
          style={{ color: 'var(--pf-t--global--icon--color--subtle)', cursor: 'pointer' }}
        />
      </Tooltip>
    </span>
  );

  return (
    <>
      <Title headingLevel="h3" size="lg" style={{ marginBottom: '0.5rem' }}>
        {t('pages.tools.userDefaults.title')}
      </Title>
      <Content component={ContentVariants.p} style={{ marginBottom: '1rem' }}>
        {t('pages.tools.userDefaults.description')}
      </Content>

      {saveSuccess && (
        <Alert
          variant="success"
          title={t('pages.tools.userDefaults.saveSuccess')}
          isInline
          style={{ marginBottom: '1rem' }}
        />
      )}

      <Form>
        {/* TPM row */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.userDefaults.tpmLabel',
              'pages.tools.userDefaults.tpmTooltip',
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="user-defaults-tpm-limit"
              type="number"
              min="0"
              step="1000"
              value={userDefaults.tpmLimit ?? ''}
              onChange={(_event, value) => handleFieldChange('tpmLimit', value)}
              placeholder={getPlaceholder('tpmLimit')}
              isDisabled={!canEdit}
              aria-label={t('pages.tools.userDefaults.tpmLabel')}
            />
          </GridItem>
        </Grid>

        {/* RPM row */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.userDefaults.rpmLabel',
              'pages.tools.userDefaults.rpmTooltip',
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="user-defaults-rpm-limit"
              type="number"
              min="0"
              step="10"
              value={userDefaults.rpmLimit ?? ''}
              onChange={(_event, value) => handleFieldChange('rpmLimit', value)}
              placeholder={getPlaceholder('rpmLimit')}
              isDisabled={!canEdit}
              aria-label={t('pages.tools.userDefaults.rpmLabel')}
            />
          </GridItem>
        </Grid>

        {/* Max Budget row */}
        <Grid hasGutter alignItems={{ default: 'alignItemsCenter' }}>
          <GridItem span={4}>
            {labelWithTooltip(
              'pages.tools.userDefaults.maxBudgetLabel',
              'pages.tools.userDefaults.maxBudgetTooltip',
            )}
          </GridItem>
          <GridItem span={4}>
            <TextInput
              id="user-defaults-max-budget"
              type="number"
              min="0"
              step="1"
              value={userDefaults.maxBudget ?? ''}
              onChange={(_event, value) => handleFieldChange('maxBudget', value)}
              placeholder={getPlaceholder('maxBudget')}
              isDisabled={!canEdit}
              aria-label={t('pages.tools.userDefaults.maxBudgetLabel')}
            />
          </GridItem>
        </Grid>

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSave}
            isDisabled={!canEdit || isLoading}
            isLoading={isLoading}
          >
            {isLoading
              ? t('pages.tools.userDefaults.saving')
              : t('pages.tools.userDefaults.saveDefaults')}
          </Button>
        </ActionGroup>
      </Form>
    </>
  );
};

export default UserDefaultsSection;
