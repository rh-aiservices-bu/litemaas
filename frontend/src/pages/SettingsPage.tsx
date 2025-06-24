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
                  User Preferences
                </Title>
                <Divider style={{ margin: '1rem 0' }} />
                <Form>
                  <FormGroup label="Display Name" fieldId="display-name">
                    <TextInput
                      type="text"
                      id="display-name"
                      name="display-name"
                      placeholder="Enter your display name"
                    />
                  </FormGroup>
                  <FormGroup label="Email Notifications" fieldId="email-notifications">
                    <Switch
                      id="email-notifications"
                      label="Enabled"
                      isChecked={true}
                      onChange={() => {}}
                    />
                  </FormGroup>
                  <FormGroup label="Auto-refresh Dashboard" fieldId="auto-refresh">
                    <Switch
                      id="auto-refresh"
                      label="Enabled"
                      isChecked={false}
                      onChange={() => {}}
                    />
                  </FormGroup>
                  <Button variant="primary">Save Preferences</Button>
                </Form>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem span={12} lg={6}>
            <Card>
              <CardBody>
                <Title headingLevel="h2" size="lg">
                  API Configuration
                </Title>
                <Divider style={{ margin: '1rem 0' }} />
                <Form>
                  <FormGroup label="Default Model Provider" fieldId="model-provider">
                    <TextInput
                      type="text"
                      id="model-provider"
                      name="model-provider"
                      placeholder="OpenAI, Anthropic, etc."
                      readOnly
                      value="OpenShift AI"
                    />
                  </FormGroup>
                  <FormGroup label="Rate Limit (requests/minute)" fieldId="rate-limit">
                    <TextInput
                      type="number"
                      id="rate-limit"
                      name="rate-limit"
                      value="100"
                      readOnly
                    />
                  </FormGroup>
                  <FormGroup label="Timeout (seconds)" fieldId="timeout">
                    <TextInput type="number" id="timeout" name="timeout" value="30" />
                  </FormGroup>
                  <Button variant="primary">Update Configuration</Button>
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
