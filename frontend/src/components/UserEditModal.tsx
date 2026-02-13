import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  ModalVariant,
  ModalBody,
  Button,
  Alert,
  Spinner,
  Tabs,
  Tab,
  TabTitleText,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { User, UserUpdateData } from '../types/users';
import { usersService } from '../services/users.service';
import { useNotifications } from '../contexts/NotificationContext';
import UserProfileTab from './admin/UserProfileTab';
import UserBudgetLimitsTab from './admin/UserBudgetLimitsTab';
import UserApiKeysTab from './admin/UserApiKeysTab';
import UserSubscriptionsTab from './admin/UserSubscriptionsTab';

interface UserEditModalProps {
  user: User;
  canEdit: boolean;
  onClose: () => void;
  onSave: () => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, canEdit, onClose, onSave }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  // Tab state
  const [activeTabKey, setActiveTabKey] = useState<string | number>('profile');

  // Form state for profile tab (roles)
  const [roles, setRoles] = useState<string[]>(user.roles || []);

  // UI state
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Focus management
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Track changes (for profile/roles tab)
  useEffect(() => {
    const rolesChanged = JSON.stringify(roles.sort()) !== JSON.stringify((user.roles || []).sort());
    setHasChanges(rolesChanged);
  }, [roles, user.roles]);

  // Reset form when user changes
  useEffect(() => {
    setRoles(user.roles || []);
    setError(null);
    setHasChanges(false);
    setActiveTabKey('profile');
  }, [user]);

  const handleRoleToggle = (role: string, checked: boolean) => {
    if (!canEdit) return;

    setRoles((prevRoles) => {
      if (checked) {
        return [...prevRoles.filter((r) => r !== role), role];
      } else {
        return prevRoles.filter((r) => r !== role);
      }
    });
  };

  const handleSave = async () => {
    if (!canEdit || !hasChanges) return;

    setIsUpdating(true);
    setError(null);

    try {
      const updateData: UserUpdateData = {
        roles,
      };

      await usersService.updateUser(user.id, updateData);

      addNotification({
        title: t('users.notifications.updateSuccess', 'User Updated'),
        description: t(
          'users.notifications.updateSuccessDesc',
          'User information has been updated successfully.',
        ),
        variant: 'success',
      });

      onSave();
    } catch (err: unknown) {
      console.error('Failed to update user:', err);

      let errorMessage = t('users.error.update', 'Failed to update user');
      const error = err as {
        response?: { data?: { message?: string; error?: string | { message?: string } } };
        message?: string;
      };
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage =
          typeof error.response.data.error === 'string'
            ? error.response.data.error
            : error.response.data.error.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      addNotification({
        title: t('users.notifications.updateError', 'Update Failed'),
        description: errorMessage,
        variant: 'danger',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Return focus to trigger element if available
    setTimeout(() => {
      modalTriggerRef.current?.focus();
    }, 100);
  };

  const handleViewUsageAnalytics = () => {
    handleClose();
    navigate(`/admin/usage?userIds=${user.id}`);
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title={
        canEdit
          ? t('users.modal.edit.title', 'Edit User')
          : t('users.modal.view.title', 'User Details')
      }
      isOpen={true}
      onClose={handleClose}
      onEscapePress={handleClose}
    >
      <ModalBody>
        {error && (
          <Alert
            variant="danger"
            title={t('common.error', 'Error')}
            isInline
            style={{ marginBottom: '1rem' }}
          >
            {error}
          </Alert>
        )}

        <Tabs
          activeKey={activeTabKey}
          onSelect={(_event, tabIndex) => setActiveTabKey(tabIndex)}
          aria-label={t('users.tabs.ariaLabel', 'User details tabs')}
        >
          <Tab
            eventKey="profile"
            title={<TabTitleText>{t('users.tabs.profile', 'Profile')}</TabTitleText>}
          >
            <div style={{ paddingTop: '1rem' }}>
              <UserProfileTab
                user={user}
                roles={roles}
                canEdit={canEdit}
                isUpdating={isUpdating}
                onRoleToggle={handleRoleToggle}
              />
            </div>
          </Tab>

          <Tab
            eventKey="budget"
            title={<TabTitleText>{t('users.tabs.budgetLimits', 'Budget & Limits')}</TabTitleText>}
          >
            <UserBudgetLimitsTab userId={user.id} canEdit={canEdit} />
          </Tab>

          <Tab
            eventKey="apiKeys"
            title={<TabTitleText>{t('users.tabs.apiKeys', 'API Keys')}</TabTitleText>}
          >
            <UserApiKeysTab userId={user.id} canEdit={canEdit} />
          </Tab>

          <Tab
            eventKey="subscriptions"
            title={<TabTitleText>{t('users.tabs.subscriptions', 'Subscriptions')}</TabTitleText>}
          >
            <UserSubscriptionsTab userId={user.id} />
          </Tab>
        </Tabs>

        {/* Action Buttons */}
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Flex>
            <FlexItem>
              <Button
                variant="link"
                icon={<ExternalLinkAltIcon />}
                iconPosition="right"
                onClick={handleViewUsageAnalytics}
              >
                {t('users.actions.viewUsage', 'View Usage Analytics')}
              </Button>
            </FlexItem>
          </Flex>

          <Flex spaceItems={{ default: 'spaceItemsSm' }}>
            {canEdit && activeTabKey === 'profile' && (
              <FlexItem>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  isDisabled={!hasChanges || isUpdating}
                  isLoading={isUpdating}
                  spinnerAriaValueText={t('ui.actions.saving', 'Saving...')}
                  ref={saveButtonRef}
                >
                  {isUpdating ? (
                    <>
                      <Spinner size="sm" aria-hidden="true" />
                      {t('ui.actions.saving', 'Saving...')}
                    </>
                  ) : (
                    t('ui.actions.save', 'Save')
                  )}
                </Button>
              </FlexItem>
            )}
            <FlexItem>
              <Button variant="link" onClick={handleClose} isDisabled={isUpdating}>
                {canEdit && activeTabKey === 'profile'
                  ? t('ui.actions.cancel', 'Cancel')
                  : t('ui.actions.close', 'Close')}
              </Button>
            </FlexItem>
          </Flex>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default UserEditModal;
