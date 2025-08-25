import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ModalVariant,
  ModalBody,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  FormHelperText,
  Button,
  Tabs,
  Tab,
  TabTitleText,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Checkbox,
  Tooltip,
} from '@patternfly/react-core';
import type { Banner, CreateBannerRequest } from '../../types/banners';
import { QuestionCircleIcon } from '@patternfly/react-icons';

interface BannerEditModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  banner?: Banner;
  onClose: () => void;
  onSave: (data: CreateBannerRequest) => Promise<void>;
  isLoading?: boolean;
  canEdit?: boolean;
}

const BannerEditModal: React.FC<BannerEditModalProps> = ({
  isOpen,
  mode,
  banner,
  onClose,
  onSave,
  isLoading = false,
  canEdit = true,
}) => {
  const { t } = useTranslation();

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    content: Record<string, string>;
    variant: 'info' | 'warning' | 'danger' | 'success' | 'default';
    isDismissible: boolean;
    markdownEnabled: boolean;
  }>({
    name: '',
    content: {},
    variant: 'info',
    isDismissible: false,
    markdownEnabled: false,
  });

  // UI state
  const [activeLanguageTab, setActiveLanguageTab] = useState('en');
  const [isVariantSelectOpen, setIsVariantSelectOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Supported languages
  const supportedLanguages = [
    { key: 'en', label: t('ui.language.english'), flag: '🇺🇸' },
    { key: 'es', label: t('ui.language.spanish'), flag: '🇪🇸' },
    { key: 'fr', label: t('ui.language.french'), flag: '🇫🇷' },
    { key: 'de', label: t('ui.language.german'), flag: '🇩🇪' },
    { key: 'it', label: t('ui.language.italian'), flag: '🇮🇹' },
    { key: 'ko', label: t('ui.language.korean'), flag: '🇰🇷' },
    { key: 'ja', label: t('ui.language.japanese'), flag: '🇯🇵' },
    { key: 'zh', label: t('ui.language.chinese'), flag: '🇨🇳' },
    { key: 'elv', label: t('ui.language.elvish'), flag: '🧝‍♂️' },
  ];

  // Initialize form data when modal opens or banner changes
  useEffect(() => {
    if (mode === 'create') {
      setFormData({
        name: '',
        content: {},
        variant: 'info',
        isDismissible: false,
        markdownEnabled: false,
      });
    } else if (banner) {
      setFormData({
        name: banner.name,
        content: banner.content,
        variant: banner.variant,
        isDismissible: banner.isDismissible,
        markdownEnabled: banner.markdownEnabled,
      });
    }
    setErrors({});
  }, [mode, banner, isOpen]);

  // Form handlers
  const handleFormChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleContentChange = (language: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        [language]: value,
      },
    }));

    // Clear error when user starts typing
    if (errors.content) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.content;
        return newErrors;
      });
    }
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('pages.tools.bannerNameRequired');
    }

    if (!formData.content.en?.trim()) {
      newErrors.content = t('pages.tools.bannerEnglishRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSave({
        name: formData.name.trim(),
        content: formData.content,
        variant: formData.variant,
        isDismissible: formData.isDismissible,
        markdownEnabled: formData.markdownEnabled,
        isActive: false, // Visibility is handled at the table level
      });
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title={
        !canEdit && mode === 'edit'
          ? t('pages.tools.viewBanner')
          : mode === 'create'
            ? t('pages.tools.createNewBanner')
            : t('pages.tools.editBanner')
      }
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalBody>
        <Form id="banner-form" onSubmit={handleSubmit}>
          {/* Banner Name */}
          <FormGroup label={t('pages.tools.bannerName')} fieldId="banner-name" isRequired>
            <TextInput
              id="banner-name"
              type="text"
              value={formData.name}
              onChange={(_event, value) => handleFormChange('name', value)}
              placeholder={t('pages.tools.bannerNamePlaceholder')}
              isRequired
              validated={errors.name ? 'error' : 'default'}
              isDisabled={!canEdit}
            />
            {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
          </FormGroup>

          {/* Banner Content with Language Tabs */}
          <FormGroup label={t('pages.tools.bannerContent')} fieldId="banner-content" isRequired>
            <Tabs
              activeKey={activeLanguageTab}
              onSelect={(_event, tabIndex) => setActiveLanguageTab(tabIndex as string)}
            >
              {supportedLanguages.map((lang) => (
                <Tab
                  key={lang.key}
                  eventKey={lang.key}
                  title={
                    <TabTitleText>
                      {lang.flag} {lang.label}
                    </TabTitleText>
                  }
                >
                  <div style={{ paddingTop: '1rem' }}>
                    <TextArea
                      id={`banner-content-${lang.key}`}
                      value={formData.content[lang.key] || ''}
                      onChange={(_event, value) => handleContentChange(lang.key, value)}
                      rows={4}
                      placeholder={t('pages.tools.bannerContentPlaceholder')}
                      isRequired={lang.key === 'en'}
                      validated={errors.content && lang.key === 'en' ? 'error' : 'default'}
                      isDisabled={!canEdit}
                    />
                    {lang.key === 'en' && (
                      <FormHelperText>{t('pages.tools.bannerEnglishRequired')}</FormHelperText>
                    )}
                  </div>
                </Tab>
              ))}
            </Tabs>
            {errors.content && <FormHelperText>{errors.content}</FormHelperText>}
          </FormGroup>

          {/* Banner Variant */}
          <FormGroup label={t('pages.tools.bannerStyle')} fieldId="banner-variant">
            <Select
              id="banner-variant"
              selected={formData.variant}
              isOpen={isVariantSelectOpen}
              onSelect={(_event, value) => {
                handleFormChange('variant', value as string);
                setIsVariantSelectOpen(false);
              }}
              onOpenChange={setIsVariantSelectOpen}
              aria-label={t('pages.tools.bannerStyleAriaLabel')}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsVariantSelectOpen(!isVariantSelectOpen)}
                  isExpanded={isVariantSelectOpen}
                  isDisabled={!canEdit}
                  aria-label={t('pages.tools.bannerStyleAriaLabel')}
                >
                  {formData.variant === 'info' && t('pages.tools.variantInfo')}
                  {formData.variant === 'warning' && t('pages.tools.variantWarning')}
                  {formData.variant === 'danger' && t('pages.tools.variantDanger')}
                  {formData.variant === 'success' && t('pages.tools.variantSuccess')}
                  {formData.variant === 'default' && t('pages.tools.variantDefault')}
                </MenuToggle>
              )}
            >
              <SelectList>
                <SelectOption value="info">{t('pages.tools.variantInfo')}</SelectOption>
                <SelectOption value="warning">{t('pages.tools.variantWarning')}</SelectOption>
                <SelectOption value="danger">{t('pages.tools.variantDanger')}</SelectOption>
                <SelectOption value="success">{t('pages.tools.variantSuccess')}</SelectOption>
                <SelectOption value="default">{t('pages.tools.variantDefault')}</SelectOption>
              </SelectList>
            </Select>
            <FormHelperText>{t('pages.tools.bannerStyleHelper')}</FormHelperText>
          </FormGroup>

          {/* Dismissible Option */}
          <FormGroup>
            <Checkbox
              id="banner-dismissible"
              label={t('pages.tools.allowDismiss')}
              isChecked={formData.isDismissible}
              onChange={(_event, checked) => handleFormChange('isDismissible', checked)}
              isDisabled={!canEdit}
            />
            <FormHelperText>
              {t('pages.tools.allowDismissHelper')}&nbsp;
              <Tooltip content={t('pages.tools.dismissalResetNote')}>
                <QuestionCircleIcon />
              </Tooltip>
            </FormHelperText>
          </FormGroup>

          {/* Markdown Option */}
          <FormGroup>
            <Checkbox
              id="banner-markdown"
              label={t('pages.tools.enableMarkdown')}
              isChecked={formData.markdownEnabled}
              onChange={(_event, checked) => handleFormChange('markdownEnabled', checked)}
              isDisabled={!canEdit}
            />
            <FormHelperText>{t('pages.tools.enableMarkdownHelper')}</FormHelperText>
          </FormGroup>
        </Form>

        {/* Modal Actions */}
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
          }}
        >
          {canEdit && (
            <Button
              key="save"
              variant="primary"
              type="submit"
              form="banner-form"
              isLoading={isLoading}
              isDisabled={isLoading}
            >
              {mode === 'create' ? t('pages.tools.createBanner') : t('pages.tools.saveBanner')}
            </Button>
          )}
          <Button key="cancel" variant="link" onClick={onClose} isDisabled={isLoading}>
            {canEdit ? t('common.cancel') : t('common.close')}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default BannerEditModal;
