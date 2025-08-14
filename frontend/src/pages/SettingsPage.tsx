import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  Grid,
  GridItem,
  Form,
  FormGroup,
  TextInput,
  Switch,
  Button,
  Divider,
} from '@patternfly/react-core';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.settings.title')}
        </Title>
      </PageSection>
      <PageSection>
        <Grid hasGutter>
          <GridItem span={12} lg={6}>
            <Card>
              <CardBody>
                <Title headingLevel="h2" size="lg">
                  {t('pages.settings.userPreferences')}
                </Title>
                <Divider style={{ margin: '1rem 0' }} />
                <Form>
                  <FormGroup
                    label={t('pages.settings.forms.displayName')}
                    isRequired
                    fieldId="display-name"
                  >
                    <TextInput
                      type="text"
                      id="display-name"
                      name="display-name"
                      value={displayName}
                      onChange={(_event, value) => {
                        setDisplayName(value);
                        if (formErrors.displayName && value.trim()) {
                          const newErrors = { ...formErrors };
                          delete newErrors.displayName;
                          setFormErrors(newErrors);
                        }
                      }}
                      placeholder={t('pages.settings.forms.displayNamePlaceholder')}
                      aria-required="true"
                      aria-invalid={formErrors.displayName ? 'true' : 'false'}
                      aria-describedby="display-name-description"
                      validated={formErrors.displayName ? 'error' : 'default'}
                    />
                  </FormGroup>
                  <div
                    id="display-name-description"
                    className={
                      formErrors.displayName
                        ? 'pf-v6-c-form__helper-text pf-m-error'
                        : 'pf-v6-c-form__helper-text'
                    }
                  >
                    {formErrors.displayName || t('pages.settings.forms.displayNameHelperText')}
                  </div>
                  <FormGroup
                    label={t('pages.settings.forms.emailNotifications')}
                    fieldId="email-notifications"
                  >
                    <Switch
                      id="email-notifications"
                      label={
                        emailNotifications
                          ? t('pages.settings.forms.enabled')
                          : t('pages.settings.forms.disabled')
                      }
                      isChecked={emailNotifications}
                      onChange={(_event, checked) => setEmailNotifications(checked)}
                      aria-describedby="email-notifications-helper"
                      aria-label={t('pages.settings.forms.emailNotificationsAriaLabel')}
                    />
                  </FormGroup>
                  <div id="email-notifications-helper" className="pf-v6-c-form__helper-text">
                    {t('pages.settings.forms.emailNotificationsHelperText')}
                  </div>
                  <FormGroup
                    label={t('pages.settings.forms.autoRefreshDashboard')}
                    fieldId="auto-refresh"
                  >
                    <Switch
                      id="auto-refresh"
                      label={
                        autoRefresh
                          ? t('pages.settings.forms.enabled')
                          : t('pages.settings.forms.disabled')
                      }
                      isChecked={autoRefresh}
                      onChange={(_event, checked) => setAutoRefresh(checked)}
                      aria-describedby="auto-refresh-helper"
                      aria-label={t('pages.settings.forms.autoRefreshAriaLabel')}
                    />
                  </FormGroup>
                  <div id="auto-refresh-helper" className="pf-v6-c-form__helper-text">
                    {t('pages.settings.forms.autoRefreshHelperText')}
                  </div>
                  <Button variant="primary">{t('pages.settings.buttons.savePreferences')}</Button>
                </Form>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem span={12} lg={6}>
            <Card>
              <CardBody>
                <Title headingLevel="h2" size="lg">
                  {t('pages.settings.apiConfiguration')}
                </Title>
                <Divider style={{ margin: '1rem 0' }} />
                <Form>
                  <FormGroup
                    label={t('pages.settings.forms.defaultModelProvider')}
                    fieldId="model-provider"
                  >
                    <TextInput
                      type="text"
                      id="model-provider"
                      name="model-provider"
                      placeholder={t('pages.settings.forms.providerPlaceholder')}
                      readOnly
                      value={t('pages.settings.forms.openShiftAI')}
                    />
                  </FormGroup>
                  <FormGroup label={t('pages.settings.forms.rateLimitLabel')} fieldId="rate-limit">
                    <TextInput
                      type="number"
                      id="rate-limit"
                      name="rate-limit"
                      value="100"
                      readOnly
                      aria-readonly="true"
                      aria-describedby="rate-limit-helper"
                    />
                  </FormGroup>
                  <div id="rate-limit-helper" className="pf-v6-c-form__helper-text">
                    {t('pages.settings.forms.rateLimitHelperText')}
                  </div>
                  <FormGroup label={t('pages.settings.forms.timeoutLabel')} fieldId="timeout">
                    <TextInput type="number" id="timeout" name="timeout" value="30" />
                  </FormGroup>
                  <Button variant="primary">
                    {t('pages.settings.buttons.updateConfiguration')}
                  </Button>
                </Form>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
};

export default SettingsPage;
