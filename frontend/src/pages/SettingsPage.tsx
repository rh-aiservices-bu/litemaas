import React from 'react';
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
                  <FormGroup label={t('pages.settings.forms.displayName')} fieldId="display-name">
                    <TextInput
                      type="text"
                      id="display-name"
                      name="display-name"
                      placeholder={t('pages.settings.forms.displayNamePlaceholder')}
                    />
                  </FormGroup>
                  <FormGroup
                    label={t('pages.settings.forms.emailNotifications')}
                    fieldId="email-notifications"
                  >
                    <Switch
                      id="email-notifications"
                      label={t('pages.settings.forms.enabled')}
                      isChecked={true}
                      onChange={() => {}}
                    />
                  </FormGroup>
                  <FormGroup
                    label={t('pages.settings.forms.autoRefreshDashboard')}
                    fieldId="auto-refresh"
                  >
                    <Switch
                      id="auto-refresh"
                      label={t('pages.settings.forms.enabled')}
                      isChecked={false}
                      onChange={() => {}}
                    />
                  </FormGroup>
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
                    />
                  </FormGroup>
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
