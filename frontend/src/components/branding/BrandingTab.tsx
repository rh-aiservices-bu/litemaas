import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Switch,
  TextInput,
  TextArea,
  Button,
  FileUpload,
  FormGroup,
  Form,
  ActionGroup,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { TrashIcon } from '@patternfly/react-icons';
import { useBranding } from '../../contexts/BrandingContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  brandingService,
  type UpdateBrandingSettingsRequest,
} from '../../services/branding.service';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

interface BrandingTabProps {
  canManage: boolean;
}

const BrandingTab: React.FC<BrandingTabProps> = ({ canManage }) => {
  const { t } = useTranslation();
  const { brandingSettings, refetch } = useBranding();
  const { addNotification } = useNotifications();

  const [isSaving, setIsSaving] = useState(false);

  // Local form state
  const [loginLogoEnabled, setLoginLogoEnabled] = useState(false);
  const [loginTitleEnabled, setLoginTitleEnabled] = useState(false);
  const [loginTitle, setLoginTitle] = useState('');
  const [loginSubtitleEnabled, setLoginSubtitleEnabled] = useState(false);
  const [loginSubtitle, setLoginSubtitle] = useState('');
  const [headerBrandEnabled, setHeaderBrandEnabled] = useState(false);

  // Initialize from context
  useEffect(() => {
    if (brandingSettings) {
      setLoginLogoEnabled(brandingSettings.loginLogoEnabled);
      setLoginTitleEnabled(brandingSettings.loginTitleEnabled);
      setLoginTitle(brandingSettings.loginTitle || '');
      setLoginSubtitleEnabled(brandingSettings.loginSubtitleEnabled);
      setLoginSubtitle(brandingSettings.loginSubtitle || '');
      setHeaderBrandEnabled(brandingSettings.headerBrandEnabled);
    }
  }, [brandingSettings]);

  const handleFileRead = useCallback(
    (file: File): Promise<{ base64: string; mimeType: string }> => {
      return new Promise((resolve, reject) => {
        if (file.size > MAX_FILE_SIZE) {
          reject(new Error(t('pages.tools.branding.fileTooLarge')));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 data from data URL: "data:image/png;base64,..."
          const commaIndex = result.indexOf(',');
          const base64 = result.substring(commaIndex + 1);
          resolve({ base64, mimeType: file.type });
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },
    [t],
  );

  const handleImageUpload = useCallback(
    async (type: string, file: File) => {
      try {
        const { base64, mimeType } = await handleFileRead(file);
        await brandingService.uploadImage(type, base64, mimeType);
        refetch();
        addNotification({
          variant: 'success',
          title: t('pages.tools.branding.uploadSuccess'),
        });
      } catch (error) {
        addNotification({
          variant: 'danger',
          title: t('pages.tools.branding.uploadError'),
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [handleFileRead, refetch, addNotification, t],
  );

  const handleImageDelete = useCallback(
    async (type: string) => {
      try {
        await brandingService.deleteImage(type);
        refetch();
        addNotification({
          variant: 'success',
          title: t('pages.tools.branding.deleteSuccess'),
        });
      } catch (error) {
        addNotification({
          variant: 'danger',
          title: t('pages.tools.branding.deleteError'),
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [refetch, addNotification, t],
  );

  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const data: UpdateBrandingSettingsRequest = {
        loginLogoEnabled,
        loginTitleEnabled,
        loginTitle: loginTitle || null,
        loginSubtitleEnabled,
        loginSubtitle: loginSubtitle || null,
        headerBrandEnabled,
      };
      await brandingService.updateSettings(data);
      refetch();
      addNotification({
        variant: 'success',
        title: t('pages.tools.branding.saveSuccess'),
      });
    } catch (error) {
      addNotification({
        variant: 'danger',
        title: t('pages.tools.branding.saveError'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    loginLogoEnabled,
    loginTitleEnabled,
    loginTitle,
    loginSubtitleEnabled,
    loginSubtitle,
    headerBrandEnabled,
    refetch,
    addNotification,
    t,
  ]);

  const renderImageSection = (
    type: string,
    label: string,
    hasImage: boolean,
  ) => {
    const imageUrl = brandingService.getImageUrl(type);

    return (
      <FormGroup label={label} fieldId={`branding-image-${type}`}>
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
          {hasImage && (
            <FlexItem>
              <Split hasGutter>
                <SplitItem>
                  <img
                    src={`${imageUrl}?t=${brandingSettings?.updatedAt || ''}`}
                    alt={label}
                    style={{
                      maxHeight: '60px',
                      maxWidth: '200px',
                      objectFit: 'contain',
                      border: '1px solid var(--pf-t--global--border--color--default)',
                      borderRadius: 'var(--pf-t--global--border--radius--small)',
                      padding: '4px',
                    }}
                  />
                </SplitItem>
                <SplitItem>
                  <Button
                    variant="plain"
                    aria-label={t('pages.tools.branding.removeImage')}
                    onClick={() => handleImageDelete(type)}
                    isDisabled={!canManage}
                    icon={<TrashIcon />}
                  />
                </SplitItem>
              </Split>
            </FlexItem>
          )}
          <FlexItem>
            <FileUpload
              id={`branding-upload-${type}`}
              type="dataURL"
              browseButtonText={t('pages.tools.branding.uploadImage')}
              isDisabled={!canManage}
              onFileInputChange={(_event, file) => {
                if (file) {
                  handleImageUpload(type, file);
                }
              }}
              dropzoneProps={{
                accept: {
                  'image/*': ['.jpg', '.jpeg', '.png', '.svg', '.gif', '.webp'],
                },
                maxSize: MAX_FILE_SIZE,
                onDropRejected: () => {
                  addNotification({
                    variant: 'danger',
                    title: t('pages.tools.branding.invalidFormat'),
                    description: t('pages.tools.branding.maxSize'),
                  });
                },
              }}
              hideDefaultPreview
            />
          </FlexItem>
        </Flex>
      </FormGroup>
    );
  };

  return (
    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
      <FlexItem>
        <p>{t('pages.tools.branding.description')}</p>
      </FlexItem>

      {/* Login Logo */}
      <FlexItem>
        <Card isCompact>
          <CardTitle>{t('pages.tools.branding.loginLogo')}</CardTitle>
          <CardBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <p style={{ marginBottom: '8px' }}>
                  {t('pages.tools.branding.loginLogoDescription')}
                </p>
              </FlexItem>
              <FlexItem>
                <Switch
                  id="login-logo-enabled"
                  label={loginLogoEnabled ? t('pages.tools.branding.useCustom') : t('pages.tools.branding.useDefault')}
                  isChecked={loginLogoEnabled}
                  onChange={(_event, checked) => setLoginLogoEnabled(checked)}
                  isDisabled={!canManage}
                />
              </FlexItem>
              <FlexItem>
                {renderImageSection(
                  'login-logo',
                  t('pages.tools.branding.loginLogo'),
                  brandingSettings?.hasLoginLogo ?? false,
                )}
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </FlexItem>

      {/* Login Title */}
      <FlexItem>
        <Card isCompact>
          <CardTitle>{t('pages.tools.branding.loginTitle')}</CardTitle>
          <CardBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <p style={{ marginBottom: '8px' }}>
                  {t('pages.tools.branding.loginTitleDescription')}
                </p>
              </FlexItem>
              <FlexItem>
                <Switch
                  id="login-title-enabled"
                  label={loginTitleEnabled ? t('pages.tools.branding.useCustom') : t('pages.tools.branding.useDefault')}
                  isChecked={loginTitleEnabled}
                  onChange={(_event, checked) => setLoginTitleEnabled(checked)}
                  isDisabled={!canManage}
                />
              </FlexItem>
              <FlexItem>
                <FormGroup label={t('pages.tools.branding.loginTitle')} fieldId="login-title">
                  <TextInput
                    id="login-title"
                    value={loginTitle}
                    onChange={(_event, value) => setLoginTitle(value)}
                    isDisabled={!canManage}
                    placeholder={t('pages.login.title')}
                  />
                </FormGroup>
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </FlexItem>

      {/* Login Subtitle */}
      <FlexItem>
        <Card isCompact>
          <CardTitle>{t('pages.tools.branding.loginSubtitle')}</CardTitle>
          <CardBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <p style={{ marginBottom: '8px' }}>
                  {t('pages.tools.branding.loginSubtitleDescription')}
                </p>
              </FlexItem>
              <FlexItem>
                <Switch
                  id="login-subtitle-enabled"
                  label={loginSubtitleEnabled ? t('pages.tools.branding.useCustom') : t('pages.tools.branding.useDefault')}
                  isChecked={loginSubtitleEnabled}
                  onChange={(_event, checked) => setLoginSubtitleEnabled(checked)}
                  isDisabled={!canManage}
                />
              </FlexItem>
              <FlexItem>
                <FormGroup
                  label={t('pages.tools.branding.loginSubtitle')}
                  fieldId="login-subtitle"
                >
                  <TextArea
                    id="login-subtitle"
                    value={loginSubtitle}
                    onChange={(_event, value) => setLoginSubtitle(value)}
                    isDisabled={!canManage}
                    placeholder={t('pages.login.subtitle')}
                    rows={3}
                  />
                </FormGroup>
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </FlexItem>

      {/* Header Brand */}
      <FlexItem>
        <Card isCompact>
          <CardTitle>{t('pages.tools.branding.headerBrand')}</CardTitle>
          <CardBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <p style={{ marginBottom: '8px' }}>
                  {t('pages.tools.branding.headerBrandDescription')}
                </p>
              </FlexItem>
              <FlexItem>
                <Switch
                  id="header-brand-enabled"
                  label={headerBrandEnabled ? t('pages.tools.branding.useCustom') : t('pages.tools.branding.useDefault')}
                  isChecked={headerBrandEnabled}
                  onChange={(_event, checked) => setHeaderBrandEnabled(checked)}
                  isDisabled={!canManage}
                />
              </FlexItem>
              <FlexItem>
                {renderImageSection(
                  'header-brand-light',
                  t('pages.tools.branding.headerBrandLight'),
                  brandingSettings?.hasHeaderBrandLight ?? false,
                )}
              </FlexItem>
              <FlexItem>
                {renderImageSection(
                  'header-brand-dark',
                  t('pages.tools.branding.headerBrandDark'),
                  brandingSettings?.hasHeaderBrandDark ?? false,
                )}
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </FlexItem>

      {/* Save Button */}
      <FlexItem>
        <Form>
          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              isDisabled={!canManage || isSaving}
              isLoading={isSaving}
            >
              {isSaving ? t('pages.tools.branding.saving') : t('pages.tools.branding.save')}
            </Button>
          </ActionGroup>
        </Form>
      </FlexItem>
    </Flex>
  );
};

export default BrandingTab;
