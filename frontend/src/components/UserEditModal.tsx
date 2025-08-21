import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ModalVariant,
  ModalBody,
  Form,
  Switch,
  Button,
  Badge,
  Alert,
  Spinner,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { User, UserUpdateData } from '../types/users';
import { usersService } from '../services/users.service';
import { useNotifications } from '../contexts/NotificationContext';

interface UserEditModalProps {
  user: User;
  canEdit: boolean;
  onClose: () => void;
  onSave: () => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, canEdit, onClose, onSave }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  // Form state
  const [roles, setRoles] = useState<string[]>(user.roles || []);

  // UI state
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Focus management
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Track changes
  useEffect(() => {
    const rolesChanged = JSON.stringify(roles.sort()) !== JSON.stringify((user.roles || []).sort());
    setHasChanges(rolesChanged);
  }, [roles, user.roles]);

  // Reset form when user changes
  useEffect(() => {
    setRoles(user.roles || []);
    setError(null);
    setHasChanges(false);
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
    } catch (err: any) {
      console.error('Failed to update user:', err);

      let errorMessage = t('users.error.update', 'Failed to update user');
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage =
          typeof err.response.data.error === 'string'
            ? err.response.data.error
            : err.response.data.error.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('users.never', 'Never');
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Available roles for management
  const availableRoles = [
    { key: 'user', label: t('role.user', 'User') },
    { key: 'admin', label: t('role.admin', 'Administrator') },
    { key: 'admin-readonly', label: t('role.adminReadonly', 'Administrator (Read-only)') },
  ];

  return (
    <Modal
      variant={ModalVariant.medium}
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

        <Form>
          {/* User Information Section - Compact Grid Layout */}
          <Content component={ContentVariants.h3} style={{ marginBottom: '0.75rem' }}>
            {t('users.form.userInfo', 'User Information')}
          </Content>

          <Grid hasGutter md={6} lg={4} style={{ marginBottom: '1rem' }}>
            <GridItem>
              <strong style={{ fontSize: '0.875rem' }}>
                {t('users.form.username', 'Username')}:
              </strong>
              <div style={{ marginTop: '0.25rem' }}>{user.username}</div>
            </GridItem>
            <GridItem>
              <strong style={{ fontSize: '0.875rem' }}>{t('users.form.email', 'Email')}:</strong>
              <div style={{ marginTop: '0.25rem' }}>{user.email}</div>
            </GridItem>
            <GridItem>
              <strong style={{ fontSize: '0.875rem' }}>
                {t('users.form.fullName', 'Full Name')}:
              </strong>
              <div style={{ marginTop: '0.25rem' }}>
                {user.fullName || (
                  <span style={{ fontStyle: 'italic', color: 'var(--pf-v6-global--Color--200)' }}>
                    {t('common.notAvailable', 'N/A')}
                  </span>
                )}
              </div>
            </GridItem>
            <GridItem>
              <strong style={{ fontSize: '0.875rem' }}>
                {t('users.form.createdAt', 'Created At')}:
              </strong>
              <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                {formatDateTime(user.createdAt)}
              </div>
            </GridItem>
            <GridItem>
              <strong style={{ fontSize: '0.875rem' }}>
                {t('users.form.lastLogin', 'Last Login')}:
              </strong>
              <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                {formatDate(user.lastLoginAt)}
              </div>
            </GridItem>
          </Grid>

          {/* Roles Section - Compact */}
          <Content component={ContentVariants.h3} style={{ marginBottom: '0.75rem' }}>
            {t('users.form.roles', 'Roles')}
          </Content>

          {canEdit ? (
            <div style={{ marginBottom: '1rem' }}>
              <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                {availableRoles.map((role) => (
                  <FlexItem key={role.key}>
                    <Switch
                      id={`role-${role.key}`}
                      label={role.label}
                      isChecked={roles.includes(role.key)}
                      onChange={(_event, checked) => handleRoleToggle(role.key, checked)}
                      aria-label={t('users.form.toggleRole', 'Toggle {{role}} role', {
                        role: role.label,
                      })}
                      isDisabled={isUpdating}
                    />
                  </FlexItem>
                ))}
              </Flex>

              {/* Handle role conflicts */}
              {roles.includes('admin') && roles.includes('admin-readonly') && (
                <Alert
                  variant="warning"
                  title={t('users.warnings.roleConflict', 'Role Conflict')}
                  isInline
                  style={{ marginTop: '0.75rem' }}
                >
                  {t(
                    'users.warnings.roleConflictDesc',
                    'Admin and Admin-readonly roles conflict. Admin role will take precedence.',
                  )}
                </Alert>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <Flex direction={{ default: 'row' }} spaceItems={{ default: 'spaceItemsSm' }}>
                {roles.length > 0 ? (
                  roles.map((role) => {
                    const roleInfo = availableRoles.find((r) => r.key === role);
                    return (
                      <FlexItem key={role}>
                        <Badge isRead>{roleInfo?.label || role}</Badge>
                      </FlexItem>
                    );
                  })
                ) : (
                  <FlexItem>
                    <Badge>{t('users.form.noRoles', 'No roles assigned')}</Badge>
                  </FlexItem>
                )}
              </Flex>
            </div>
          )}

          {/* Status Section - Compact */}
          <Content component={ContentVariants.h3} style={{ marginBottom: '0.5rem' }}>
            {t('users.form.status', 'Status')}
          </Content>

          <div style={{ marginBottom: '1rem' }}>
            <Badge color={user.isActive ? 'green' : 'red'} style={{ marginBottom: '0.5rem' }}>
              {user.isActive ? (
                <>
                  <CheckCircleIcon /> {t('status.active', 'Active')}
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon /> {t('status.inactive', 'Inactive')}
                </>
              )}
            </Badge>
            <div>
              <Content
                component={ContentVariants.small}
                style={{ fontStyle: 'italic', color: 'var(--pf-v6-global--Color--200)' }}
              >
                {t('users.status.oauthManaged')}
              </Content>
            </div>
          </div>
        </Form>

        {/* Action Buttons */}
        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}
        >
          {canEdit && (
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
          )}
          <Button variant="link" onClick={handleClose} isDisabled={isUpdating}>
            {canEdit ? t('ui.actions.cancel', 'Cancel') : t('ui.actions.close', 'Close')}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default UserEditModal;
