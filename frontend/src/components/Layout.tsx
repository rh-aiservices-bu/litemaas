import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  Button,
  Avatar,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Divider,
  Drawer,
  DrawerPanelContent,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerActions,
  DrawerCloseButton,
  ToggleGroup,
  ToggleGroupItem,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import { BarsIcon, MoonIcon, SunIcon, GlobeIcon } from '@patternfly/react-icons';
import {
  AvatarPlaceholder,
  LogoTitle,
  starLogo,
  githubLogo,
  forkLogo,
  starLogoWhite,
  forkLogoWhite,
  githubLogoWhite,
} from '../assets';
import { appConfig } from '../config/navigation';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { NotificationDrawer, NotificationBadgeButton } from './NotificationDrawer';
import { AlertToastGroup } from './AlertToastGroup';
import axios from 'axios';

const Layout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { unreadCount, toastNotifications, removeToastNotification } = useNotifications();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [repoStars, setRepoStars] = React.useState<number | null>(null);
  const [repoForks, setRepoForks] = React.useState<number | null>(null);
  const location = useLocation();

  // Fetch GitHub stars and forks
  React.useEffect(() => {
    axios
      .get('https://api.github.com/repos/rh-aiservices-bu/litemaas')
      .then((response) => {
        setRepoStars(response.data.stargazers_count);
        setRepoForks(response.data.forks_count);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch GitHub stars:', error);
      });
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = savedTheme === 'dark';
    setIsDarkTheme(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add('pf-v6-theme-dark');
    }
  }, []);

  const handleThemeToggle = (checked: boolean) => {
    setIsDarkTheme(checked);
    if (checked) {
      document.documentElement.classList.add('pf-v6-theme-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('pf-v6-theme-dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    setIsLanguageDropdownOpen(false);
  };

  const PageNav = (
    <Nav aria-label="Global navigation">
      <NavList>
        {appConfig.navigation.map((navItem) => {
          const Icon = navItem.icon;
          const isActive = location.pathname === navItem.path;

          return (
            <NavItem key={navItem.id} itemId={navItem.id} isActive={isActive}>
              <Link to={navItem.path || '#'}>
                {Icon && <Icon />}
                <span style={{ marginLeft: Icon ? '0.5rem' : '0' }}>{t(navItem.label)}</span>
              </Link>
            </NavItem>
          );
        })}
      </NavList>
    </Nav>
  );

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

  const userDropdownItems = (
    <DropdownList>
      <DropdownItem isDisabled key="user-info">
        <div style={{ padding: '0.5rem 0' }}>
          <div style={{ fontWeight: 'bold' }}>{user?.name || user?.username}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
            {user?.email}
          </div>
          {user?.roles?.includes('admin') && (
            <div style={{ fontSize: '0.75rem', color: 'var(--pf-t--global--text--color--brand)' }}>
              Administrator
            </div>
          )}
        </div>
      </DropdownItem>
      <Divider component="li" />
      <DropdownItem key="settings">
        <Link to="/settings" style={{ textDecoration: 'none', color: 'inherit' }}>
          Settings
        </Link>
      </DropdownItem>
      <DropdownItem key="logout" onClick={logout}>
        {t('ui.actions.logout')}
      </DropdownItem>
    </DropdownList>
  );

  const headerToolbar = (
    <Toolbar isFullHeight isStatic>
      <ToolbarContent>
        <ToolbarGroup align={{ default: 'alignEnd' }}>
          {/* Theme Toggle */}
          <ToolbarItem style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
            <ToggleGroup aria-label="Dark theme toggle group">
              <ToggleGroupItem
                aria-label="light theme toggle"
                icon={<SunIcon />}
                isSelected={!isDarkTheme}
                onClick={() => handleThemeToggle(false)}
              />
              <ToggleGroupItem
                aria-label="dark theme toggle"
                icon={<MoonIcon />}
                isSelected={isDarkTheme}
                onClick={() => handleThemeToggle(true)}
              />
            </ToggleGroup>
          </ToolbarItem>
          {/* Language Selector */}
          <ToolbarItem style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
            <Dropdown
              isOpen={isLanguageDropdownOpen}
              onSelect={() => setIsLanguageDropdownOpen(false)}
              onOpenChange={setIsLanguageDropdownOpen}
              popperProps={{ position: 'right' }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  aria-label={t('ui.language.selector')}
                  variant="plain"
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  style={{
                    height: '40px',
                    width: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GlobeIcon />
                </MenuToggle>
              )}
            >
              {languageDropdownItems}
            </Dropdown>
          </ToolbarItem>

          {/* Notifications */}
          <ToolbarItem style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
            <NotificationBadgeButton
              onClick={() => setIsNotificationDrawerOpen(!isNotificationDrawerOpen)}
              unreadCount={unreadCount}
            />
          </ToolbarItem>

          {/* User Menu */}
          <ToolbarItem style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
            <Dropdown
              isOpen={isUserDropdownOpen}
              onSelect={() => setIsUserDropdownOpen(false)}
              onOpenChange={setIsUserDropdownOpen}
              popperProps={{ position: 'right' }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  aria-label="User menu"
                  variant="plain"
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  style={{
                    height: '40px',
                    width: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0',
                  }}
                >
                  <Avatar src={AvatarPlaceholder} alt="User Avatar" size="sm" />
                </MenuToggle>
              )}
            >
              {userDropdownItems}
            </Dropdown>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const Header = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button
            variant="plain"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Global navigation"
            style={{
              height: '40px',
              width: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarsIcon />
          </Button>
          <img
            src={LogoTitle}
            alt={appConfig.appTitle}
            style={{
              height: '40px',
              maxWidth: '240px',
              objectFit: 'contain',
            }}
          />
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>{headerToolbar}</MastheadContent>
    </Masthead>
  );

  const Sidebar = (
    <PageSidebar open={isSidebarOpen}>
      <PageSidebarBody
        isFilled
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {PageNav}
        <div style={{ marginTop: 'auto', padding: '1rem', textAlign: 'center' }}>
          <Content component={ContentVariants.small}>
            App by{' '}
            <a href="http://red.ht/cai-team" target="_blank" rel="noreferrer">
              red.ht/cai-team
            </a>
            <br />
            <Flex direction={{ default: 'column' }} style={{ width: '100%', alignItems: 'center' }}>
              <FlexItem style={{ marginBottom: '0rem' }}>
                <Flex direction={{ default: 'row' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Content
                      component={ContentVariants.a}
                      href="https://github.com/rh-aiservices-bu/litemaas"
                      target="_blank"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <img
                        src={isDarkTheme ? githubLogoWhite : githubLogo}
                        alt="GitHub Logo"
                        style={{ height: '20px', marginRight: '0.5rem' }}
                      />
                      Source on GitHub
                    </Content>
                  </FlexItem>
                </Flex>
              </FlexItem>
              <FlexItem>
                <Flex direction={{ default: 'row' }}>
                  <FlexItem style={{ alignmentBaseline: 'middle' }}>
                    {repoStars !== null && (
                      <img
                        src={isDarkTheme ? starLogoWhite : starLogo}
                        alt="Star Logo"
                        style={{ height: '15px', marginRight: '0.5rem', verticalAlign: 'text-top' }}
                      />
                    )}
                    {repoStars !== null ? `${repoStars}` : ''}
                  </FlexItem>
                  <FlexItem>
                    {repoStars !== null && (
                      <img
                        src={isDarkTheme ? forkLogoWhite : forkLogo}
                        alt="Fork Logo"
                        style={{ height: '15px', marginRight: '0.5rem', verticalAlign: 'text-top' }}
                      />
                    )}
                    {repoForks !== null ? `${repoForks}` : ''}
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </Content>
        </div>
      </PageSidebarBody>
    </PageSidebar>
  );

  const mainContent = (
    <Page masthead={Header} sidebar={isSidebarOpen ? Sidebar : undefined}>
      <Outlet />
    </Page>
  );

  return (
    <>
      <AlertToastGroup notifications={toastNotifications} onRemove={removeToastNotification} />
      <Drawer
        isExpanded={isNotificationDrawerOpen}
        onExpand={() => setIsNotificationDrawerOpen(true)}
      >
        <DrawerContent
          panelContent={
            <DrawerPanelContent isResizable defaultSize="400px" minSize="300px">
              <DrawerHead>
                <DrawerActions>
                  <DrawerCloseButton onClick={() => setIsNotificationDrawerOpen(false)} />
                </DrawerActions>
              </DrawerHead>
              <NotificationDrawer
                isOpen={isNotificationDrawerOpen}
                onClose={() => setIsNotificationDrawerOpen(false)}
              />
            </DrawerPanelContent>
          }
        >
          <DrawerContentBody>{mainContent}</DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Layout;
