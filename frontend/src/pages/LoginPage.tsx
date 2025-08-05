import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  LoginPage as PFLoginPage,
  Stack,
  StackItem,
  Divider,
  Spinner,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon, UserIcon, GlobeIcon } from '@patternfly/react-icons';
import { LogoTitle } from '../assets';
import { useAuth } from '../contexts/AuthContext';
import { configService } from '../services/config.service';

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { login, loginAsAdmin } = useAuth();
  const [authMode, setAuthMode] = useState<'oauth' | 'mock' | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);

  const handleLogin = () => {
    login();
  };

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    setIsLanguageDropdownOpen(false);
  };

  const languageDropdownItems = (
    <DropdownList>
      <DropdownItem key="en" onClick={() => handleLanguageChange('en')}>
        🇺🇸 {t('ui.language.english')}
      </DropdownItem>
      <DropdownItem key="es" onClick={() => handleLanguageChange('es')}>
        🇪🇸 {t('ui.language.spanish')}
      </DropdownItem>
      <DropdownItem key="fr" onClick={() => handleLanguageChange('fr')}>
        🇫🇷 {t('ui.language.french')}
      </DropdownItem>
      <DropdownItem key="de" onClick={() => handleLanguageChange('de')}>
        🇩🇪 {t('ui.language.german')}
      </DropdownItem>
      <DropdownItem key="it" onClick={() => handleLanguageChange('it')}>
        🇮🇹 {t('ui.language.italian')}
      </DropdownItem>
      <DropdownItem key="ko" onClick={() => handleLanguageChange('ko')}>
        🇰🇷 {t('ui.language.korean')}
      </DropdownItem>
      <DropdownItem key="ja" onClick={() => handleLanguageChange('ja')}>
        🇯🇵 {t('ui.language.japanese')}
      </DropdownItem>
      <DropdownItem key="zh" onClick={() => handleLanguageChange('zh')}>
        🇨🇳 {t('ui.language.chinese')}
      </DropdownItem>
      <DropdownItem key="elv" onClick={() => handleLanguageChange('elv')}>
        🧝‍♂️ {t('ui.language.elvish')}
      </DropdownItem>
    </DropdownList>
  );

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await configService.getConfig();
        setAuthMode(config.authMode);
      } catch (err) {
        console.error('Failed to load configuration:', err);
        // Default to oauth mode on error
        setAuthMode('oauth');
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  return (
    <PFLoginPage
      brandImgSrc={LogoTitle}
      brandImgAlt={t('pages.login.brandAlt')}
      backgroundImgSrc="/bg.jpg"
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
          <div className="pf-v6-u-text-align-center pf-v6-u-mt-md">
            <Dropdown
              isOpen={isLanguageDropdownOpen}
              onSelect={() => setIsLanguageDropdownOpen(false)}
              onOpenChange={setIsLanguageDropdownOpen}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  aria-label={t('ui.language.selector')}
                  variant="plain"
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  icon={<GlobeIcon />}
                >
                  {t('ui.language.selector')}
                </MenuToggle>
              )}
            >
              {languageDropdownItems}
            </Dropdown>
          </div>
        </StackItem>

        {configLoading ? (
          <StackItem>
            <div className="pf-v6-u-text-align-center">
              <Spinner size="md" />
            </div>
          </StackItem>
        ) : authMode === 'mock' ? (
          <>
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
          </>
        ) : null}
      </Stack>
    </PFLoginPage>
  );
};

export default LoginPage;
