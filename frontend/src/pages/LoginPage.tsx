import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  LoginPage as PFLoginPage,
  Stack,
  StackItem,
  Divider,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon, UserIcon } from '@patternfly/react-icons';
import { LogoTitle } from '../assets';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, loginAsAdmin } = useAuth();

  const handleLogin = () => {
    login();
  };

  return (
    <PFLoginPage
      brandImgSrc={LogoTitle}
      brandImgAlt={t('pages.login.brandAlt')}
      backgroundImgSrc="/bg.jpg"
      textContent={t('pages.login.signInText')}
      loginTitle={t('pages.login.title')}
      loginSubtitle={t('pages.login.subtitle')}
    >
      <Stack hasGutter>
        <StackItem>
          <Button
            variant="primary"
            onClick={handleLogin}
            isBlock
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
          >
            {t('pages.login.loginWithOpenShift')}
          </Button>
        </StackItem>

        <StackItem>
          <div className="pf-v6-u-text-align-center pf-v6-u-my-md">
            <Divider />
            <div className="pf-v6-u-mt-sm">
              <small className="pf-v6-u-color-400">{t('pages.login.developmentMode')}</small>
            </div>
          </div>
        </StackItem>

        <StackItem>
          <Button
            variant="secondary"
            onClick={loginAsAdmin}
            isBlock
            icon={<UserIcon />}
            iconPosition="start"
          >
            {t('pages.login.loginAsAdmin')}
          </Button>
          <div className="pf-v6-u-text-align-center pf-v6-u-mt-sm">
            <small className="pf-v6-u-color-400">{t('pages.login.bypassAuthentication')}</small>
          </div>
        </StackItem>
      </Stack>
    </PFLoginPage>
  );
};

export default LoginPage;
