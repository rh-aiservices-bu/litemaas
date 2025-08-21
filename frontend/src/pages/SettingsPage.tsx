import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  Grid,
  GridItem,
  Button,
  Divider,
  Alert,
  Tooltip,
  Flex,
  FlexItem,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Form,
  FormGroup,
  TextInput,
  FormHelperText,
  ActionGroup,
  Modal,
  ModalVariant,
  ModalBody,
} from '@patternfly/react-core';
import { SyncAltIcon, UsersIcon } from '@patternfly/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { modelsService } from '../services/models.service';
import {
  adminService,
  type BulkUpdateUserLimitsRequest,
  type BulkUpdateUserLimitsResponse,
} from '../services/admin.service';

interface SyncResult {
  success: boolean;
  totalModels: number;
  newModels: number;
  updatedModels: number;
  unavailableModels: number;
  errors: string[];
  syncedAt: string;
}

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Limits Management state
  const [isLimitsLoading, setIsLimitsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [limitsFormData, setLimitsFormData] = useState({
    maxBudget: '',
    tpmLimit: '',
    rpmLimit: '',
  });
  const [lastLimitsUpdate, setLastLimitsUpdate] = useState<BulkUpdateUserLimitsResponse | null>(
    null,
  );

  // Check if user has admin permission (not admin-readonly)
  const canSync = user?.roles?.includes('admin') ?? false;
  const canUpdateLimits = user?.roles?.includes('admin') ?? false;

  const handleRefreshModels = async () => {
    if (!canSync) return;

    setIsLoading(true);
    try {
      const result = await modelsService.refreshModels();

      // Assuming the API returns sync result details
      const syncResult: SyncResult = {
        success: true,
        totalModels: result.totalModels || 0,
        newModels: result.newModels || 0,
        updatedModels: result.updatedModels || 0,
        unavailableModels: result.unavailableModels || 0,
        errors: result.errors || [],
        syncedAt: result.syncedAt || new Date().toISOString(),
      };

      setLastSyncResult(syncResult);

      addNotification({
        variant: 'success',
        title: t('pages.settings.syncSuccess'),
        description: t('pages.settings.syncSuccessDetails', {
          total: syncResult.totalModels,
          new: syncResult.newModels,
          updated: syncResult.updatedModels,
        }),
      });
    } catch (error) {
      console.error('Failed to sync models:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.settings.syncError'),
        description: error instanceof Error ? error.message : t('pages.settings.syncErrorGeneric'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatSyncTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  // Limits Management handlers
  const handleLimitsFormChange = (field: string, value: string) => {
    setLimitsFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLimitsFormSubmit = () => {
    if (!canUpdateLimits) return;

    // Validate that at least one field has a value
    const hasValues =
      limitsFormData.maxBudget || limitsFormData.tpmLimit || limitsFormData.rpmLimit;
    if (!hasValues) {
      addNotification({
        variant: 'warning',
        title: t('pages.settings.noValuesProvided'),
        description: t('pages.settings.noValuesProvidedDescription'),
      });
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmLimitsUpdate = async () => {
    if (!canUpdateLimits) return;

    setShowConfirmModal(false);
    setIsLimitsLoading(true);

    try {
      const updates: BulkUpdateUserLimitsRequest = {};

      if (limitsFormData.maxBudget) {
        updates.maxBudget = parseFloat(limitsFormData.maxBudget);
      }
      if (limitsFormData.tpmLimit) {
        updates.tpmLimit = parseInt(limitsFormData.tpmLimit);
      }
      if (limitsFormData.rpmLimit) {
        updates.rpmLimit = parseInt(limitsFormData.rpmLimit);
      }

      const result = await adminService.bulkUpdateUserLimits(updates);
      setLastLimitsUpdate(result);

      // Reset form
      setLimitsFormData({
        maxBudget: '',
        tpmLimit: '',
        rpmLimit: '',
      });

      // Show success notification
      const successMessage =
        result.failedCount > 0
          ? t('pages.settings.bulkUpdatePartial', {
              success: result.successCount,
              failed: result.failedCount,
            })
          : t('pages.settings.bulkUpdateSuccess', {
              count: result.successCount,
            });

      addNotification({
        variant: result.failedCount > 0 ? 'warning' : 'success',
        title: successMessage,
        description: successMessage,
      });
    } catch (error) {
      console.error('Failed to update user limits:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.settings.bulkUpdateError'),
        description:
          error instanceof Error ? error.message : t('pages.settings.bulkUpdateErrorGeneric'),
      });
    } finally {
      setIsLimitsLoading(false);
    }
  };

  const syncButton = (
    <Button
      variant="primary"
      icon={<SyncAltIcon />}
      onClick={handleRefreshModels}
      isAriaDisabled={!canSync || isLoading}
      isLoading={isLoading}
    >
      {isLoading ? t('pages.settings.syncInProgress') : t('pages.settings.refreshModels')}
    </Button>
  );

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.settings.title')}
        </Title>
      </PageSection>
      <PageSection>
        <Grid hasGutter>
          {/* Models Management Panel */}
          <GridItem span={12}>
            <Card>
              <CardBody>
                <Title headingLevel="h2" size="lg">
                  {t('pages.settings.models')}
                </Title>
                <Divider style={{ margin: '1rem 0' }} />

                <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                  <FlexItem>
                    <p>{t('pages.settings.modelsDescription')}</p>
                  </FlexItem>

                  {lastSyncResult && (
                    <FlexItem>
                      <Alert
                        variant={lastSyncResult.success ? 'success' : 'warning'}
                        title={t('pages.settings.lastSync')}
                        isInline
                      >
                        <DescriptionList isHorizontal>
                          <DescriptionListGroup>
                            <DescriptionListTerm>
                              {t('pages.settings.syncTime')}
                            </DescriptionListTerm>
                            <DescriptionListDescription>
                              {formatSyncTime(lastSyncResult.syncedAt)}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                          <DescriptionListGroup>
                            <DescriptionListTerm>
                              {t('pages.settings.totalModels')}
                            </DescriptionListTerm>
                            <DescriptionListDescription>
                              {lastSyncResult.totalModels}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                          <DescriptionListGroup>
                            <DescriptionListTerm>
                              {t('pages.settings.newModels')}
                            </DescriptionListTerm>
                            <DescriptionListDescription>
                              {lastSyncResult.newModels}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                          <DescriptionListGroup>
                            <DescriptionListTerm>
                              {t('pages.settings.updatedModels')}
                            </DescriptionListTerm>
                            <DescriptionListDescription>
                              {lastSyncResult.updatedModels}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                        </DescriptionList>
                        {lastSyncResult.errors.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <strong>{t('pages.settings.syncErrors')}:</strong>
                            <ul style={{ marginTop: '0.5rem' }}>
                              {lastSyncResult.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </Alert>
                    </FlexItem>
                  )}

                  <FlexItem>
                    {canSync ? (
                      syncButton
                    ) : (
                      <Tooltip content={t('pages.settings.adminRequired')}>{syncButton}</Tooltip>
                    )}
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>

          {/* Limits Management Panel */}
          {canUpdateLimits && (
            <GridItem span={12}>
              <Card>
                <CardBody>
                  <Title headingLevel="h2" size="lg">
                    {t('pages.settings.limitsManagement')}
                  </Title>
                  <Divider style={{ margin: '1rem 0' }} />

                  <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                    <FlexItem>
                      <p>{t('pages.settings.limitsDescription')}</p>
                    </FlexItem>

                    {lastLimitsUpdate && (
                      <FlexItem>
                        <Alert
                          variant={lastLimitsUpdate.failedCount > 0 ? 'warning' : 'success'}
                          title={t('pages.settings.lastLimitsUpdate')}
                          isInline
                        >
                          <DescriptionList isHorizontal>
                            <DescriptionListGroup>
                              <DescriptionListTerm>
                                {t('pages.settings.updateTime')}
                              </DescriptionListTerm>
                              <DescriptionListDescription>
                                {formatSyncTime(lastLimitsUpdate.processedAt)}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>
                                {t('pages.settings.totalUsersUpdated')}
                              </DescriptionListTerm>
                              <DescriptionListDescription>
                                {lastLimitsUpdate.totalUsers}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>
                                {t('pages.settings.successfulUpdates')}
                              </DescriptionListTerm>
                              <DescriptionListDescription>
                                {lastLimitsUpdate.successCount}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            {lastLimitsUpdate.failedCount > 0 && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>
                                  {t('pages.settings.failedUpdates')}
                                </DescriptionListTerm>
                                <DescriptionListDescription>
                                  {lastLimitsUpdate.failedCount}
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                          </DescriptionList>
                          {lastLimitsUpdate.errors.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <strong>{t('pages.settings.updateErrors')}:</strong>
                              <ul style={{ marginTop: '0.5rem' }}>
                                {lastLimitsUpdate.errors.map((error, index) => (
                                  <li key={index}>
                                    {error.username}: {error.error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </Alert>
                      </FlexItem>
                    )}

                    <FlexItem>
                      <Form>
                        <FormGroup label={t('pages.settings.maxBudgetLabel')} fieldId="max-budget">
                          <TextInput
                            id="max-budget"
                            type="number"
                            min="0"
                            step="0.01"
                            value={limitsFormData.maxBudget}
                            onChange={(_event, value) => handleLimitsFormChange('maxBudget', value)}
                            placeholder={t('pages.settings.leaveEmptyToKeep')}
                          />
                          <FormHelperText>{t('pages.settings.maxBudgetHelper')}</FormHelperText>
                        </FormGroup>

                        <FormGroup label={t('pages.settings.tpmLimitLabel')} fieldId="tpm-limit">
                          <TextInput
                            id="tpm-limit"
                            type="number"
                            min="0"
                            step="1"
                            value={limitsFormData.tpmLimit}
                            onChange={(_event, value) => handleLimitsFormChange('tpmLimit', value)}
                            placeholder={t('pages.settings.leaveEmptyToKeep')}
                          />
                          <FormHelperText>{t('pages.settings.tpmLimitHelper')}</FormHelperText>
                        </FormGroup>

                        <FormGroup label={t('pages.settings.rpmLimitLabel')} fieldId="rpm-limit">
                          <TextInput
                            id="rpm-limit"
                            type="number"
                            min="0"
                            step="1"
                            value={limitsFormData.rpmLimit}
                            onChange={(_event, value) => handleLimitsFormChange('rpmLimit', value)}
                            placeholder={t('pages.settings.leaveEmptyToKeep')}
                          />
                          <FormHelperText>{t('pages.settings.rpmLimitHelper')}</FormHelperText>
                        </FormGroup>

                        <ActionGroup>
                          <Button
                            variant="primary"
                            icon={<UsersIcon />}
                            onClick={handleLimitsFormSubmit}
                            isDisabled={isLimitsLoading}
                            isLoading={isLimitsLoading}
                          >
                            {isLimitsLoading
                              ? t('pages.settings.processing')
                              : t('pages.settings.applyToAllUsers')}
                          </Button>
                        </ActionGroup>
                      </Form>
                    </FlexItem>
                  </Flex>
                </CardBody>
              </Card>
            </GridItem>
          )}
        </Grid>

        {/* Confirmation Modal */}
        <Modal
          variant={ModalVariant.medium}
          title={t('pages.settings.confirmBulkUpdate')}
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
        >
          <ModalBody>
            <p style={{ marginBottom: '1rem' }}>{t('pages.settings.confirmBulkUpdateMessage')}</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <strong>{t('pages.settings.changesToApply')}:</strong>
              <ul style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                {limitsFormData.maxBudget && (
                  <li style={{ marginBottom: '0.25rem' }}>
                    {t('pages.settings.maxBudgetLabel')}: ${limitsFormData.maxBudget}
                  </li>
                )}
                {limitsFormData.tpmLimit && (
                  <li style={{ marginBottom: '0.25rem' }}>
                    {t('pages.settings.tpmLimitLabel')}: {limitsFormData.tpmLimit}
                  </li>
                )}
                {limitsFormData.rpmLimit && (
                  <li style={{ marginBottom: '0.25rem' }}>
                    {t('pages.settings.rpmLimitLabel')}: {limitsFormData.rpmLimit}
                  </li>
                )}
              </ul>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
              }}
            >
              <Button variant="primary" onClick={handleConfirmLimitsUpdate}>
                {t('pages.settings.confirmApply')}
              </Button>
              <Button variant="link" onClick={() => setShowConfirmModal(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </ModalBody>
        </Modal>
      </PageSection>
    </>
  );
};

export default SettingsPage;
