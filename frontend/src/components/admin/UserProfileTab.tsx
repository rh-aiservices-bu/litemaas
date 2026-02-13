import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Form,
  Switch,
  Badge,
  Label,
  Alert,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationTriangleIcon, UserIcon } from '@patternfly/react-icons';
import { User } from '../../types/users';

interface UserProfileTabProps {
  user: User;
  roles: string[];
  canEdit: boolean;
  isUpdating: boolean;
  onRoleToggle: (role: string, checked: boolean) => void;
}

const UserProfileTab: React.FC<UserProfileTabProps> = ({
  user,
  roles,
  canEdit,
  isUpdating,
  onRoleToggle,
}) => {
  const { t } = useTranslation();

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
    <Form>
      {/* User Header */}
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        spaceItems={{ default: 'spaceItemsMd' }}
        style={{ marginBottom: '0.5rem' }}
      >
        <FlexItem>
          <UserIcon style={{ fontSize: '1.5rem' }} />
        </FlexItem>
        <FlexItem>
          <Title headingLevel="h3" size="lg">
            {user.username}
          </Title>
        </FlexItem>
        <FlexItem>
          <Tooltip content={t('users.status.oauthManaged')}>
            <Label color={user.isActive ? 'green' : 'grey'}>
              {user.isActive ? (
                <>
                  <CheckCircleIcon /> {t('status.active', 'Active')}
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon /> {t('status.inactive', 'Inactive')}
                </>
              )}
            </Label>
          </Tooltip>
        </FlexItem>
      </Flex>

      {/* Status Alerts */}
      {!user.isActive && (
        <Alert
          variant="warning"
          title={t('users.alerts.inactive.title')}
          isInline
          style={{ marginBottom: '1rem' }}
        >
          {t('users.alerts.inactive.description')}
        </Alert>
      )}

      {user.roles.includes('admin') && (
        <Alert
          variant="info"
          title={t('users.alerts.admin.title')}
          isInline
          style={{ marginBottom: '1rem' }}
        >
          {t('users.alerts.admin.description')}
        </Alert>
      )}

      <DescriptionList
        isCompact
        isHorizontal
        columnModifier={{ default: '2Col' }}
        horizontalTermWidthModifier={{ default: '14ch' }}
        style={{ marginBottom: '0.5rem' }}
      >
        <DescriptionListGroup>
          <DescriptionListTerm>{t('users.form.username', 'Username')}</DescriptionListTerm>
          <DescriptionListDescription>
            <strong>{user.username}</strong>
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>{t('users.form.email', 'Email')}</DescriptionListTerm>
          <DescriptionListDescription>{user.email}</DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>{t('users.form.fullName', 'Full Name')}</DescriptionListTerm>
          <DescriptionListDescription>
            {user.fullName || (
              <span
                style={{
                  fontStyle: 'italic',
                  color: 'var(--pf-t--global--text--color--subtle)',
                }}
              >
                {t('common.notAvailable', 'N/A')}
              </span>
            )}
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>{t('users.form.lastLogin', 'Last Login')}</DescriptionListTerm>
          <DescriptionListDescription>{formatDate(user.lastLoginAt)}</DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>{t('users.form.createdAt', 'Created At')}</DescriptionListTerm>
          <DescriptionListDescription>{formatDateTime(user.createdAt)}</DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>

      {/* Roles Section */}
      <Content component={ContentVariants.h3} style={{ marginBottom: '0.25rem' }}>
        {t('users.form.roles', 'Roles')}
      </Content>

      {canEdit ? (
        <div style={{ marginBottom: '0.5rem' }}>
          <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
            {availableRoles.map((role) => (
              <FlexItem key={role.key}>
                <Switch
                  id={`role-${role.key}`}
                  label={role.label}
                  isChecked={roles.includes(role.key)}
                  onChange={(_event, checked) => onRoleToggle(role.key, checked)}
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
        <div style={{ marginBottom: '0.5rem' }}>
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
    </Form>
  );
};

export default UserProfileTab;
