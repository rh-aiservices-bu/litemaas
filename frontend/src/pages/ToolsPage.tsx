import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Button,
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
  Tabs,
  Tab,
  TabTitleText,
  TabContent,
  TabContentBody,
} from '@patternfly/react-core';
import { SyncAltIcon, UsersIcon, PlusIcon } from '@patternfly/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useBanners } from '../contexts/BannerContext';
import { modelsService } from '../services/models.service';
import { bannerService } from '../services/banners.service';
import {
  adminService,
  type BulkUpdateUserLimitsRequest,
  type BulkUpdateUserLimitsResponse,
} from '../services/admin.service';
import type { SimpleBannerUpdateRequest, CreateBannerRequest, Banner } from '../types/banners';
import { BannerEditModal, BannerTable } from '../components/banners';
import { useQuery, useQueryClient } from 'react-query';

interface SyncResult {
  success: boolean;
  totalModels: number;
  newModels: number;
  updatedModels: number;
  unavailableModels: number;
  errors: string[];
  syncedAt: string;
}

const ToolsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { updateBanner, bulkUpdateVisibility } = useBanners();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string | number>('models');

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

  // Banner Management state
  const [isBannerLoading, setIsBannerLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [pendingVisibilityChanges, setPendingVisibilityChanges] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Check permissions - separate view from modify access
  const canSync = user?.roles?.includes('admin') ?? false; // Only full admins can sync
  const canViewLimits =
    (user?.roles?.includes('admin') || user?.roles?.includes('admin-readonly')) ?? false;
  const canUpdateLimits = user?.roles?.includes('admin') ?? false; // Only full admins can modify
  const canViewBanners =
    (user?.roles?.includes('admin') || user?.roles?.includes('admin-readonly')) ?? false;
  const canManageBanners = user?.roles?.includes('admin') ?? false; // Only full admins can modify

  // Fetch all banners for admin management
  const { data: allBanners = [] } = useQuery(['allBanners'], () => bannerService.getAllBanners(), {
    enabled: canViewBanners,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  // Tab handler
  const handleTabClick = (_event: React.MouseEvent, tabIndex: string | number) => {
    setActiveTabKey(tabIndex);
  };

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
        title: t('pages.tools.syncSuccess'),
        description: t('pages.tools.syncSuccessDetails', {
          total: syncResult.totalModels,
          new: syncResult.newModels,
          updated: syncResult.updatedModels,
        }),
      });
    } catch (error) {
      console.error('Failed to sync models:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.tools.syncError'),
        description: error instanceof Error ? error.message : t('pages.tools.syncErrorGeneric'),
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
        title: t('pages.tools.noValuesProvided'),
        description: t('pages.tools.noValuesProvidedDescription'),
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
          ? t('pages.tools.bulkUpdatePartial', {
              success: result.successCount,
              failed: result.failedCount,
            })
          : t('pages.tools.bulkUpdateSuccess', {
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
        title: t('pages.tools.bulkUpdateError'),
        description:
          error instanceof Error ? error.message : t('pages.tools.bulkUpdateErrorGeneric'),
      });
    } finally {
      setIsLimitsLoading(false);
    }
  };

  // Banner Management handlers
  const handleCreateBanner = () => {
    setIsCreateMode(true);
    setEditingBanner(null);
    setIsEditModalOpen(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setIsCreateMode(false);
    setEditingBanner(banner);
    setIsEditModalOpen(true);
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!canManageBanners) return;

    try {
      setIsBannerLoading(true);
      await bannerService.deleteBanner(bannerId);

      // Refresh the banners list
      queryClient.invalidateQueries(['allBanners']);

      addNotification({
        variant: 'success',
        title: t('pages.tools.bannerDeleted'),
        description: t('pages.tools.bannerDeletedDescription'),
      });
    } catch (error) {
      console.error('Failed to delete banner:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.tools.bannerDeleteError'),
        description:
          error instanceof Error ? error.message : t('pages.tools.bannerDeleteErrorGeneric'),
      });
    } finally {
      setIsBannerLoading(false);
    }
  };

  const handleVisibilityToggle = (bannerId: string, isVisible: boolean) => {
    // Update pending changes
    const newPendingChanges = new Map(pendingVisibilityChanges);

    // Check if more than one banner would be visible
    if (isVisible) {
      // First, set all others to false in pending changes
      allBanners.forEach((banner) => {
        if (banner.id !== bannerId) {
          newPendingChanges.set(banner.id, false);
        }
      });
    }

    newPendingChanges.set(bannerId, isVisible);
    setPendingVisibilityChanges(newPendingChanges);
    setHasUnsavedChanges(true);
  };

  const handleApplyChanges = async () => {
    if (!canManageBanners || pendingVisibilityChanges.size === 0) return;

    try {
      setIsBannerLoading(true);

      // Convert Map to plain object for API call
      const visibilityUpdates: Record<string, boolean> = {};
      pendingVisibilityChanges.forEach((isVisible, bannerId) => {
        visibilityUpdates[bannerId] = isVisible;
      });

      // Use the context's bulkUpdateVisibility instead of direct service call
      await bulkUpdateVisibility(visibilityUpdates);

      // Clear pending changes
      setPendingVisibilityChanges(new Map());
      setHasUnsavedChanges(false);

      // Refresh the banners list for the admin table
      queryClient.invalidateQueries(['allBanners']);

      // Note: Success notification is handled by the context
    } catch (error) {
      console.error('Failed to apply visibility changes:', error);
      // Error notification is handled by the context
    } finally {
      setIsBannerLoading(false);
    }
  };

  const handleModalSave = async (data: CreateBannerRequest) => {
    if (!canManageBanners) return;

    try {
      setIsBannerLoading(true);

      if (isCreateMode) {
        await bannerService.createBanner(data);
        addNotification({
          variant: 'success',
          title: t('pages.tools.bannerCreated'),
          description: t('pages.tools.bannerCreatedDescription'),
        });
      } else if (editingBanner) {
        const updates: SimpleBannerUpdateRequest = {
          name: data.name,
          isActive: editingBanner.isActive, // Keep current visibility state
          content: data.content,
          variant: data.variant || 'info',
          isDismissible: data.isDismissible,
          markdownEnabled: data.markdownEnabled,
        };

        await updateBanner(editingBanner.id, updates);
        addNotification({
          variant: 'success',
          title: t('pages.tools.bannerSaved'),
          description: t('pages.tools.bannerSavedDescription'),
        });
      }

      // Close modal and refresh data
      setIsEditModalOpen(false);
      setEditingBanner(null);
      queryClient.invalidateQueries(['allBanners']);
    } catch (error) {
      console.error('Failed to save banner:', error);
      addNotification({
        variant: 'danger',
        title: t('pages.tools.bannerSaveError'),
        description:
          error instanceof Error ? error.message : t('pages.tools.bannerSaveErrorGeneric'),
      });
      throw error; // Re-throw to prevent modal from closing
    } finally {
      setIsBannerLoading(false);
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
      {isLoading ? t('pages.tools.syncInProgress') : t('pages.tools.refreshModels')}
    </Button>
  );

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.tools.title')}
        </Title>
      </PageSection>
      <PageSection>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick}>
          {/* Models Management Tab */}
          <Tab eventKey="models" title={<TabTitleText>{t('pages.tools.models')}</TabTitleText>}>
            <TabContent id="models-tab-content" style={{ paddingTop: '10px' }}>
              <TabContentBody>
                <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                  <FlexItem>
                    <p>{t('pages.tools.modelsDescription')}</p>
                  </FlexItem>

                  {lastSyncResult && (
                    <FlexItem>
                      <Alert
                        variant={lastSyncResult.success ? 'success' : 'warning'}
                        title={t('pages.tools.lastSync')}
                        isInline
                      >
                        <DescriptionList isHorizontal>
                          <DescriptionListGroup>
                            <DescriptionListTerm>{t('pages.tools.syncTime')}</DescriptionListTerm>
                            <DescriptionListDescription>
                              {formatSyncTime(lastSyncResult.syncedAt)}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                          <DescriptionListGroup>
                            <DescriptionListTerm>
                              {t('pages.tools.totalModels')}
                            </DescriptionListTerm>
                            <DescriptionListDescription>
                              {lastSyncResult.totalModels}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                          <DescriptionListGroup>
                            <DescriptionListTerm>{t('pages.tools.newModels')}</DescriptionListTerm>
                            <DescriptionListDescription>
                              {lastSyncResult.newModels}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                          <DescriptionListGroup>
                            <DescriptionListTerm>
                              {t('pages.tools.updatedModels')}
                            </DescriptionListTerm>
                            <DescriptionListDescription>
                              {lastSyncResult.updatedModels}
                            </DescriptionListDescription>
                          </DescriptionListGroup>
                        </DescriptionList>
                        {lastSyncResult.errors.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <strong>{t('pages.tools.syncErrors')}:</strong>
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
                      <Tooltip content={t('pages.tools.adminRequired')}>{syncButton}</Tooltip>
                    )}
                  </FlexItem>
                </Flex>
              </TabContentBody>
            </TabContent>
          </Tab>

          {/* Limits Management Tab */}
          {canViewLimits && (
            <Tab
              eventKey="limits"
              title={<TabTitleText>{t('pages.tools.limitsManagement')}</TabTitleText>}
            >
              <TabContent id="limits-tab-content" style={{ paddingTop: '10px' }}>
                <TabContentBody>
                  <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                    <FlexItem>
                      <p>{t('pages.tools.limitsDescription')}</p>
                    </FlexItem>

                    {lastLimitsUpdate && (
                      <FlexItem>
                        <Alert
                          variant={lastLimitsUpdate.failedCount > 0 ? 'warning' : 'success'}
                          title={t('pages.tools.lastLimitsUpdate')}
                          isInline
                        >
                          <DescriptionList isHorizontal>
                            <DescriptionListGroup>
                              <DescriptionListTerm>
                                {t('pages.tools.updateTime')}
                              </DescriptionListTerm>
                              <DescriptionListDescription>
                                {formatSyncTime(lastLimitsUpdate.processedAt)}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>
                                {t('pages.tools.totalUsersUpdated')}
                              </DescriptionListTerm>
                              <DescriptionListDescription>
                                {lastLimitsUpdate.totalUsers}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>
                                {t('pages.tools.successfulUpdates')}
                              </DescriptionListTerm>
                              <DescriptionListDescription>
                                {lastLimitsUpdate.successCount}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            {lastLimitsUpdate.failedCount > 0 && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>
                                  {t('pages.tools.failedUpdates')}
                                </DescriptionListTerm>
                                <DescriptionListDescription>
                                  {lastLimitsUpdate.failedCount}
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                          </DescriptionList>
                          {lastLimitsUpdate.errors.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <strong>{t('pages.tools.updateErrors')}:</strong>
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
                        <FormGroup label={t('pages.tools.maxBudgetLabel')} fieldId="max-budget">
                          <TextInput
                            id="max-budget"
                            type="number"
                            min="0"
                            step="0.01"
                            value={limitsFormData.maxBudget}
                            onChange={(_event, value) => handleLimitsFormChange('maxBudget', value)}
                            placeholder={t('pages.tools.leaveEmptyToKeep')}
                            isDisabled={!canUpdateLimits}
                          />
                          <FormHelperText>{t('pages.tools.maxBudgetHelper')}</FormHelperText>
                        </FormGroup>

                        <FormGroup label={t('pages.tools.tpmLimitLabel')} fieldId="tpm-limit">
                          <TextInput
                            id="tpm-limit"
                            type="number"
                            min="0"
                            step="1"
                            value={limitsFormData.tpmLimit}
                            onChange={(_event, value) => handleLimitsFormChange('tpmLimit', value)}
                            placeholder={t('pages.tools.leaveEmptyToKeep')}
                            isDisabled={!canUpdateLimits}
                          />
                          <FormHelperText>{t('pages.tools.tpmLimitHelper')}</FormHelperText>
                        </FormGroup>

                        <FormGroup label={t('pages.tools.rpmLimitLabel')} fieldId="rpm-limit">
                          <TextInput
                            id="rpm-limit"
                            type="number"
                            min="0"
                            step="1"
                            value={limitsFormData.rpmLimit}
                            onChange={(_event, value) => handleLimitsFormChange('rpmLimit', value)}
                            placeholder={t('pages.tools.leaveEmptyToKeep')}
                            isDisabled={!canUpdateLimits}
                          />
                          <FormHelperText>{t('pages.tools.rpmLimitHelper')}</FormHelperText>
                        </FormGroup>

                        <ActionGroup>
                          <Button
                            variant="primary"
                            icon={<UsersIcon />}
                            onClick={handleLimitsFormSubmit}
                            isDisabled={!canUpdateLimits || isLimitsLoading}
                            isLoading={isLimitsLoading}
                          >
                            {isLimitsLoading
                              ? t('pages.tools.processing')
                              : t('pages.tools.applyToAllUsers')}
                          </Button>
                        </ActionGroup>
                      </Form>
                    </FlexItem>
                  </Flex>
                </TabContentBody>
              </TabContent>
            </Tab>
          )}

          {/* Banner Management Tab */}
          {canViewBanners && (
            <Tab
              eventKey="banners"
              title={<TabTitleText>{t('pages.tools.bannerManagement')}</TabTitleText>}
            >
              <TabContent id="banners-tab-content" style={{ paddingTop: '10px' }}>
                <TabContentBody>
                  <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                    <FlexItem>
                      <p>{t('pages.tools.bannerDescription')}</p>
                    </FlexItem>

                    {/* Create Banner Button */}
                    <FlexItem>
                      <Button
                        variant="primary"
                        icon={<PlusIcon />}
                        onClick={handleCreateBanner}
                        isDisabled={!canManageBanners || isBannerLoading}
                      >
                        {t('pages.tools.createNewBanner')}
                      </Button>
                    </FlexItem>

                    {/* Banner Table */}
                    <FlexItem>
                      <BannerTable
                        banners={allBanners}
                        pendingChanges={pendingVisibilityChanges}
                        onVisibilityToggle={handleVisibilityToggle}
                        onEdit={handleEditBanner}
                        onDelete={handleDeleteBanner}
                        hasUnsavedChanges={hasUnsavedChanges}
                        readOnly={!canManageBanners}
                      />
                    </FlexItem>

                    {/* Apply Changes Button */}
                    {hasUnsavedChanges && canManageBanners && (
                      <FlexItem>
                        <Button
                          variant="primary"
                          onClick={handleApplyChanges}
                          isLoading={isBannerLoading}
                          isDisabled={isBannerLoading}
                        >
                          {isBannerLoading
                            ? t('pages.tools.applying')
                            : t('pages.tools.applyChanges')}
                        </Button>
                      </FlexItem>
                    )}
                    {/* Info Alert */}
                    <Alert variant="info" isInline title={t('pages.tools.bannerVisibilityNote')}>
                      {t('pages.tools.bannerVisibilityNoteDescription')}
                    </Alert>
                  </Flex>
                </TabContentBody>
              </TabContent>
            </Tab>
          )}
        </Tabs>

        {/* Confirmation Modal */}
        <Modal
          variant={ModalVariant.medium}
          title={t('pages.tools.confirmBulkUpdate')}
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
        >
          <ModalBody>
            <p style={{ marginBottom: '1rem' }}>{t('pages.tools.confirmBulkUpdateMessage')}</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <strong>{t('pages.tools.changesToApply')}:</strong>
              <ul style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                {limitsFormData.maxBudget && (
                  <li style={{ marginBottom: '0.25rem' }}>
                    {t('pages.tools.maxBudgetLabel')}: ${limitsFormData.maxBudget}
                  </li>
                )}
                {limitsFormData.tpmLimit && (
                  <li style={{ marginBottom: '0.25rem' }}>
                    {t('pages.tools.tpmLimitLabel')}: {limitsFormData.tpmLimit}
                  </li>
                )}
                {limitsFormData.rpmLimit && (
                  <li style={{ marginBottom: '0.25rem' }}>
                    {t('pages.tools.rpmLimitLabel')}: {limitsFormData.rpmLimit}
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
                {t('pages.tools.confirmApply')}
              </Button>
              <Button variant="link" onClick={() => setShowConfirmModal(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </ModalBody>
        </Modal>

        {/* Banner Edit Modal */}
        <BannerEditModal
          isOpen={isEditModalOpen}
          mode={isCreateMode ? 'create' : 'edit'}
          banner={editingBanner || undefined}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingBanner(null);
          }}
          onSave={handleModalSave}
          isLoading={isBannerLoading}
          canEdit={canManageBanners}
        />
      </PageSection>
    </>
  );
};

export default ToolsPage;
