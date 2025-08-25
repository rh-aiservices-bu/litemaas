import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import {
  Button,
  Switch,
  Badge,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  Modal,
  ModalVariant,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core';
import { PencilAltIcon, TrashIcon } from '@patternfly/react-icons';
import type { Banner } from '../../types/banners';

interface BannerTableProps {
  banners: Banner[];
  pendingChanges: Map<string, boolean>;
  onVisibilityToggle: (bannerId: string, isVisible: boolean) => void;
  onEdit: (banner: Banner) => void;
  onDelete: (bannerId: string) => void;
  hasUnsavedChanges: boolean;
  readOnly?: boolean;
}

const BannerTable: React.FC<BannerTableProps> = ({
  banners,
  pendingChanges,
  onVisibilityToggle,
  onEdit,
  onDelete,
  hasUnsavedChanges: _hasUnsavedChanges,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    banner: Banner | null;
  }>({
    isOpen: false,
    banner: null,
  });

  // Helper to get effective visibility state (pending changes override current state)
  const getEffectiveVisibility = (banner: Banner): boolean => {
    return pendingChanges.has(banner.id) ? pendingChanges.get(banner.id)! : banner.isActive;
  };

  // Get variant badge color
  const getVariantBadgeColor = (variant: Banner['variant']) => {
    switch (variant) {
      case 'info':
        return 'blue';
      case 'warning':
        return 'orange';
      case 'danger':
        return 'red';
      case 'success':
        return 'green';
      default:
        return 'grey';
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (banner: Banner) => {
    setDeleteConfirmModal({
      isOpen: true,
      banner,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmModal.banner) {
      onDelete(deleteConfirmModal.banner.id);
    }
    setDeleteConfirmModal({
      isOpen: false,
      banner: null,
    });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmModal({
      isOpen: false,
      banner: null,
    });
  };

  return (
    <>
      <Table aria-label={t('pages.tools.bannersTableAriaLabel')} variant="compact">
        <Thead>
          <Tr>
            <Th>{t('pages.tools.bannerName')}</Th>
            <Th>{t('pages.tools.visibility')}</Th>
            <Th>{t('pages.tools.variant')}</Th>
            <Th>{t('pages.tools.lastUpdated')}</Th>
            <Th>{t('pages.tools.actions')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {banners.length === 0 ? (
            <Tr>
              <Td colSpan={5}>
                <Flex justifyContent={{ default: 'justifyContentCenter' }}>
                  <FlexItem>
                    <Content>{t('pages.tools.noBannersFound')}</Content>
                  </FlexItem>
                </Flex>
              </Td>
            </Tr>
          ) : (
            banners.map((banner) => {
              const effectiveVisibility = getEffectiveVisibility(banner);
              const hasPendingChange = pendingChanges.has(banner.id);

              return (
                <Tr key={banner.id}>
                  {/* Name Column */}
                  <Td dataLabel={t('pages.tools.bannerName')}>
                    <Flex
                      direction={{ default: 'column' }}
                      spaceItems={{ default: 'spaceItemsNone' }}
                    >
                      <FlexItem>
                        <strong>{banner.name}</strong>
                      </FlexItem>
                      <FlexItem>
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {banner.content.en
                            ? banner.content.en.substring(0, 60) +
                              (banner.content.en.length > 60 ? '...' : '')
                            : t('pages.tools.noContent')}
                        </Content>
                      </FlexItem>
                    </Flex>
                  </Td>

                  {/* Visibility Column */}
                  <Td dataLabel={t('pages.tools.visibility')}>
                    <Flex
                      alignItems={{ default: 'alignItemsCenter' }}
                      spaceItems={{ default: 'spaceItemsSm' }}
                    >
                      <FlexItem>
                        <Switch
                          id={`visibility-${banner.id}`}
                          aria-label={t('pages.tools.toggleVisibility', { name: banner.name })}
                          isChecked={effectiveVisibility}
                          onChange={(_event, checked) => onVisibilityToggle(banner.id, checked)}
                          isDisabled={readOnly}
                        />
                      </FlexItem>
                      <FlexItem>
                        <Content component={ContentVariants.small}>
                          {effectiveVisibility ? t('pages.tools.visible') : t('pages.tools.hidden')}
                          {hasPendingChange && (
                            <Content
                              component={ContentVariants.small}
                              style={{ color: 'var(--pf-v6-global--warning-color--100)' }}
                            >
                              {' (' + t('pages.tools.pending') + ')'}
                            </Content>
                          )}
                        </Content>
                      </FlexItem>
                    </Flex>
                  </Td>

                  {/* Variant Column */}
                  <Td dataLabel={t('pages.tools.variant')}>
                    <Badge color={getVariantBadgeColor(banner.variant)}>
                      {t(
                        `pages.tools.variant${banner.variant.charAt(0).toUpperCase() + banner.variant.slice(1)}`,
                      )}
                    </Badge>
                  </Td>

                  {/* Last Updated Column */}
                  <Td dataLabel={t('pages.tools.lastUpdated')}>
                    <Content component={ContentVariants.small}>
                      {formatDate(banner.updatedAt)}
                    </Content>
                  </Td>

                  {/* Actions Column */}
                  <Td dataLabel={t('pages.tools.actions')}>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                      <FlexItem>
                        <Button
                          variant="secondary"
                          icon={<PencilAltIcon />}
                          onClick={() => onEdit(banner)}
                          aria-label={t('pages.tools.editBanner', { name: banner.name })}
                          size="sm"
                        >
                          {readOnly ? t('common.view') : t('pages.apiKeys.editKey')}
                        </Button>
                      </FlexItem>
                      <FlexItem>
                        <Button
                          variant="danger"
                          icon={<TrashIcon />}
                          onClick={() => handleDeleteClick(banner)}
                          aria-label={t('pages.tools.deleteBanner', { name: banner.name })}
                          size="sm"
                          isDisabled={readOnly}
                        >
                          {t('pages.apiKeys.deleteKey')}
                        </Button>
                      </FlexItem>
                    </Flex>
                  </Td>
                </Tr>
              );
            })
          )}
        </Tbody>
      </Table>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title={t('pages.tools.confirmDeleteBanner')}
        isOpen={deleteConfirmModal.isOpen}
        onClose={handleDeleteCancel}
      >
        <ModalBody>
          <Content>
            {t('pages.tools.confirmDeleteBannerMessage', { name: deleteConfirmModal.banner?.name })}
          </Content>
          <Content
            component={ContentVariants.small}
            style={{
              marginTop: '0.5rem',
              color: 'var(--pf-v6-global--Color--200)',
            }}
          >
            {t('pages.tools.deleteWarning')}
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            {t('common.delete')}
          </Button>
          <Button variant="link" onClick={handleDeleteCancel}>
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default BannerTable;
