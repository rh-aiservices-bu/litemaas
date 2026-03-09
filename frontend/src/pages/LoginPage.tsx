import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  AlertActionCloseButton,
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
import { Octobean } from '../assets';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { brandingService } from '../services/branding.service';
import { configService } from '../services/config.service';

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { login, loginAsAdmin } = useAuth();
  const { brandingSettings } = useBranding();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionExpired = searchParams.get('session') === 'expired';
  const authError = searchParams.get('error') === 'auth_failed';
  const [authMode, setAuthMode] = useState<'oauth' | 'mock' | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [showAuthError, setShowAuthError] = useState(false);

  // Compute branding overrides
  const brandImgSrc =
    brandingSettings?.loginLogoEnabled && brandingSettings?.hasLoginLogo
      ? brandingService.getImageUrl('login-logo')
      : Octobean;

  const loginPageTitle =
    brandingSettings?.loginTitleEnabled && brandingSettings?.loginTitle
      ? brandingSettings.loginTitle
      : t('pages.login.title');

  const loginPageSubtitle =
    brandingSettings?.loginSubtitleEnabled && brandingSettings?.loginSubtitle
      ? brandingSettings.loginSubtitle
      : t('pages.login.subtitle');

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
        setAuthMode(config.authMode ?? 'oauth');
      } catch (err) {
        console.error('Failed to load configuration:', err);
        setConfigError(true);
        // Default to oauth mode on error
        setAuthMode('oauth');
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (sessionExpired) {
      setSearchParams({}, { replace: true });
    }
  }, [sessionExpired, setSearchParams]);

  useEffect(() => {
    if (authError) {
      setShowAuthError(true);
      // Clear the error param from URL
      window.history.replaceState({}, '', '/login');
    }
  }, [authError]);

  return (
    <PFLoginPage
      brandImgSrc={brandImgSrc}
      brandImgAlt={t('pages.login.brandAlt')}
      backgroundImgSrc="/bg.jpg"
      loginTitle={loginPageTitle}
      loginSubtitle={loginPageSubtitle}
    >
      <Stack hasGutter>
        {sessionExpired && (
          <StackItem>
            <Alert variant="warning" title={t('pages.login.sessionExpired')} isInline />
          </StackItem>
        )}
        {showAuthError && (
          <StackItem>
            <Alert
              variant="danger"
              title={t('pages.login.authError')}
              isInline
              actionClose={
                <AlertActionCloseButton onClose={() => setShowAuthError(false)} />
              }
            />
          </StackItem>
        )}
        {configError && (
          <StackItem>
            <Alert variant="danger" title={t('pages.login.configError')} isInline />
          </StackItem>
        )}
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
