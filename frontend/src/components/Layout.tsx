import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { BannerProvider } from '../contexts/BannerContext';
import { NotificationDrawer, NotificationBadgeButton } from './NotificationDrawer';
import { AlertToastGroup } from './AlertToastGroup';
import { BannerAnnouncement } from './BannerAnnouncement';
import axios from 'axios';

const Layout: React.FC = () => {
  const { t, i18n } = useTranslation();

  // Helper function to get the most powerful role
  const getMostPowerfulRole = (roles: string[]): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('admin-readonly')) return 'adminReadonly';
    if (roles.includes('user')) return 'user';
    return 'user'; // default fallback
  };
  const { unreadCount, toastNotifications, removeToastNotification } = useNotifications();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [repoStars, setRepoStars] = React.useState<number | null>(null);
  const [repoForks, setRepoForks] = React.useState<number | null>(null);
  const [languageDropdownFocusedIndex, setLanguageDropdownFocusedIndex] = useState(-1);
  const [userDropdownFocusedIndex, setUserDropdownFocusedIndex] = useState(-1);
  const location = useLocation();

  // Refs for dropdown management
  const languageDropdownRef = useRef<HTMLUListElement>(null);
  const userDropdownRef = useRef<HTMLUListElement>(null);
  const languageToggleRef = useRef<HTMLButtonElement>(null);
  const userToggleRef = useRef<HTMLButtonElement>(null);

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
    setLanguageDropdownFocusedIndex(-1);
    // Return focus to toggle button
    setTimeout(() => languageToggleRef.current?.focus(), 0);
  };

  // Language dropdown keyboard navigation
  const languageDropdownItems = [
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

  const userDropdownActions = [
    {
      key: 'logout',
      label: t('ui.actions.logout'),
      action: () => {
        setIsUserDropdownOpen(false);
        setUserDropdownFocusedIndex(-1);
        logout();
      },
    },
  ];

  const handleLanguageDropdownKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;
      const itemCount = languageDropdownItems.length;

      switch (key) {
        case 'ArrowDown':
          event.preventDefault();
          setLanguageDropdownFocusedIndex((prevIndex) => {
            const newIndex = prevIndex < itemCount - 1 ? prevIndex + 1 : 0;
            return newIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setLanguageDropdownFocusedIndex((prevIndex) => {
            const newIndex = prevIndex > 0 ? prevIndex - 1 : itemCount - 1;
            return newIndex;
          });
          break;
        case 'Home':
          event.preventDefault();
          setLanguageDropdownFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setLanguageDropdownFocusedIndex(itemCount - 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (languageDropdownFocusedIndex >= 0) {
            const selectedItem = languageDropdownItems[languageDropdownFocusedIndex];
            handleLanguageChange(selectedItem.key);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsLanguageDropdownOpen(false);
          setLanguageDropdownFocusedIndex(-1);
          setTimeout(() => languageToggleRef.current?.focus(), 0);
          break;
      }
    },
    [languageDropdownFocusedIndex, languageDropdownItems, handleLanguageChange],
  );

  const handleUserDropdownKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;
      const itemCount = userDropdownActions.length;

      switch (key) {
        case 'ArrowDown':
          event.preventDefault();
          setUserDropdownFocusedIndex((prevIndex) => {
            const newIndex = prevIndex < itemCount - 1 ? prevIndex + 1 : 0;
            return newIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setUserDropdownFocusedIndex((prevIndex) => {
            const newIndex = prevIndex > 0 ? prevIndex - 1 : itemCount - 1;
            return newIndex;
          });
          break;
        case 'Home':
          event.preventDefault();
          setUserDropdownFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setUserDropdownFocusedIndex(itemCount - 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (userDropdownFocusedIndex >= 0) {
            const selectedAction = userDropdownActions[userDropdownFocusedIndex];
            setIsUserDropdownOpen(false);
            setUserDropdownFocusedIndex(-1);
            selectedAction.action();
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsUserDropdownOpen(false);
          setUserDropdownFocusedIndex(-1);
          setTimeout(() => userToggleRef.current?.focus(), 0);
          break;
      }
    },
    [userDropdownFocusedIndex, userDropdownActions, logout],
  );

  // Effect to manage focus when dropdowns open
  useEffect(() => {
    if (isLanguageDropdownOpen) {
      setLanguageDropdownFocusedIndex(0);
    } else {
      setLanguageDropdownFocusedIndex(-1);
    }
  }, [isLanguageDropdownOpen]);

  useEffect(() => {
    if (isUserDropdownOpen) {
      setUserDropdownFocusedIndex(0);
    } else {
      setUserDropdownFocusedIndex(-1);
    }
  }, [isUserDropdownOpen]);

  const PageNav = (
    <Nav aria-label="Global navigation" id="main-navigation">
      <NavList>
        {appConfig.navigation
          .filter((navItem) => {
            // Show item if no required roles or if user has at least one of the required roles
            if (!navItem.requiredRoles) return true;
            return navItem.requiredRoles.some((role) => user?.roles?.includes(role));
          })
          .map((navItem) => {
            // Handle separator items (render as Divider)
            if (navItem.isGroup) {
              return (
                <div key={navItem.id}>
                  <Divider component="li" />
                  <Content key="role-display" component={ContentVariants.h4}>
                    {user?.roles ? t('role.' + getMostPowerfulRole(user.roles)) : ''}
                  </Content>
                </div>
              );
            }

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

  const languageDropdownItemsJSX = (
    <DropdownList ref={languageDropdownRef} onKeyDown={handleLanguageDropdownKeyDown}>
      {languageDropdownItems.map((item, index) => (
        <DropdownItem
          key={item.key}
          onClick={() => handleLanguageChange(item.key)}
          isFocused={index === languageDropdownFocusedIndex}
          tabIndex={index === languageDropdownFocusedIndex ? 0 : -1}
          role="menuitem"
        >
          {item.flag} {item.label}
        </DropdownItem>
      ))}
    </DropdownList>
  );

  const userDropdownItemsJSX = (
    <DropdownList ref={userDropdownRef} onKeyDown={handleUserDropdownKeyDown}>
      <DropdownItem isDisabled key="user-info" role="presentation">
        <div style={{ padding: '0.5rem 0' }}>
          <div style={{ fontWeight: 'bold' }}>{user?.name || user?.username}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
            {user?.email}
          </div>
          {user?.roles?.includes('admin') && (
            <div style={{ fontSize: '0.75rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
              {t('role.admin')}
            </div>
          )}
          {user?.roles?.includes('admin-readonly') && !user?.roles?.includes('admin') && (
            <div style={{ fontSize: '0.75rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
              {t('role.adminReadonly')}
            </div>
          )}
        </div>
      </DropdownItem>
      <Divider component="li" />
      {userDropdownActions.map((item, index) => (
        <DropdownItem
          key={item.key}
          onClick={item.action}
          isFocused={index === userDropdownFocusedIndex}
          tabIndex={index === userDropdownFocusedIndex ? 0 : -1}
          role="menuitem"
        >
          {item.label}
        </DropdownItem>
      ))}
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
              onOpenChange={(isOpen: boolean) => {
                setIsLanguageDropdownOpen(isOpen);
                if (!isOpen) {
                  setLanguageDropdownFocusedIndex(-1);
                }
              }}
              popperProps={{ position: 'right' }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={(node) => {
                    if (toggleRef && typeof toggleRef !== 'function') {
                      (toggleRef as React.MutableRefObject<any>).current = node;
                    }
                    if (languageToggleRef.current !== node) {
                      (languageToggleRef as React.MutableRefObject<any>).current = node;
                    }
                  }}
                  aria-label={t('ui.language.selector')}
                  aria-expanded={isLanguageDropdownOpen}
                  aria-haspopup="menu"
                  variant="plain"
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsLanguageDropdownOpen(true);
                    }
                  }}
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
              {languageDropdownItemsJSX}
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
              onOpenChange={(isOpen: boolean) => {
                setIsUserDropdownOpen(isOpen);
                if (!isOpen) {
                  setUserDropdownFocusedIndex(-1);
                }
              }}
              popperProps={{ position: 'right' }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={(node) => {
                    if (toggleRef && typeof toggleRef !== 'function') {
                      (toggleRef as React.MutableRefObject<any>).current = node;
                    }
                    if (userToggleRef.current !== node) {
                      (userToggleRef as React.MutableRefObject<any>).current = node;
                    }
                  }}
                  aria-label="User menu"
                  aria-expanded={isUserDropdownOpen}
                  aria-haspopup="menu"
                  variant="plain"
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsUserDropdownOpen(true);
                    }
                  }}
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
              {userDropdownItemsJSX}
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
            aria-label={isSidebarOpen ? t('ui.actions.closeSidebar') : t('ui.actions.openSidebar')}
            aria-expanded={isSidebarOpen}
            aria-controls="main-navigation"
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
        <nav role="navigation" aria-label="Main navigation">
          {PageNav}
        </nav>
        <aside
          role="complementary"
          style={{ marginTop: 'auto', padding: '1rem', textAlign: 'center' }}
        >
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
                      <>
                        <img
                          src={isDarkTheme ? starLogoWhite : starLogo}
                          alt=""
                          style={{
                            height: '15px',
                            marginRight: '0.5rem',
                            verticalAlign: 'text-top',
                          }}
                          aria-hidden="true"
                        />
                        <span className="pf-v6-screen-reader">Stars: </span>
                      </>
                    )}
                    {repoStars !== null ? `${repoStars}` : ''}
                  </FlexItem>
                  <FlexItem>
                    {repoForks !== null && (
                      <>
                        <img
                          src={isDarkTheme ? forkLogoWhite : forkLogo}
                          alt=""
                          style={{
                            height: '15px',
                            marginRight: '0.5rem',
                            verticalAlign: 'text-top',
                          }}
                          aria-hidden="true"
                        />
                        <span className="pf-v6-screen-reader">Forks: </span>
                      </>
                    )}
                    {repoForks !== null ? `${repoForks}` : ''}
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </Content>
        </aside>
      </PageSidebarBody>
    </PageSidebar>
  );

  const mainContent = (
    <Page masthead={Header} sidebar={isSidebarOpen ? Sidebar : undefined}>
      <main id="main-content" role="main">
        <Outlet />
      </main>
    </Page>
  );

  return (
    <BannerProvider>
      {/* Skip Navigation Links */}
      <div>
        <a href="#main-content" className="skip-link">
          {t('ui.accessibility.skipToMain', 'Skip to main content')}
        </a>
        <a href="#main-navigation" className="skip-link">
          {t('ui.accessibility.skipToNavigation', 'Skip to navigation')}
        </a>
      </div>

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
          <DrawerContentBody>
            <BannerAnnouncement />
            {mainContent}
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </BannerProvider>
  );
};

export default Layout;
