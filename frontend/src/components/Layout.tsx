import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
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
  Switch,
} from '@patternfly/react-core';
import {
  CubesIcon,
  KeyIcon,
  ChartLineIcon,
  HomeIcon,
  CatalogIcon,
  BarsIcon,
} from '@patternfly/react-icons';
import { AvatarPlaceholder } from '../assets';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const location = useLocation();

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

  const PageNav = (
    <Nav aria-label="Global navigation">
      <NavList>
        <NavItem itemId="home" isActive={location.pathname === '/home'}>
          <Link to="/home" className="pf-v6-c-nav__link">
            <span className="pf-v6-c-nav__link-text">
              <HomeIcon /> Home
            </span>
          </Link>
        </NavItem>
        <NavItem itemId="models" isActive={location.pathname === '/models'}>
          <Link to="/models" className="pf-v6-c-nav__link">
            <span className="pf-v6-c-nav__link-text">
              <CatalogIcon /> Models
            </span>
          </Link>
        </NavItem>
        <NavItem itemId="subscriptions" isActive={location.pathname === '/subscriptions'}>
          <Link to="/subscriptions" className="pf-v6-c-nav__link">
            <span className="pf-v6-c-nav__link-text">
              <CubesIcon /> Subscriptions
            </span>
          </Link>
        </NavItem>
        <NavItem itemId="api-keys" isActive={location.pathname === '/api-keys'}>
          <Link to="/api-keys" className="pf-v6-c-nav__link">
            <span className="pf-v6-c-nav__link-text">
              <KeyIcon /> API Keys
            </span>
          </Link>
        </NavItem>
        <NavItem itemId="usage" isActive={location.pathname === '/usage'}>
          <Link to="/usage" className="pf-v6-c-nav__link">
            <span className="pf-v6-c-nav__link-text">
              <ChartLineIcon /> Usage
            </span>
          </Link>
        </NavItem>
      </NavList>
    </Nav>
  );

  const headerToolbar = (
    <Toolbar isFullHeight isStatic>
      <ToolbarContent>
        <ToolbarGroup align={{ default: 'alignEnd' }}>
          <ToolbarItem>
            <Switch
              id="theme-toggle"
              aria-label="Dark theme"
              isChecked={isDarkTheme}
              onChange={(_event, checked) => handleThemeToggle(checked)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Avatar src={AvatarPlaceholder} alt="User Avatar" />
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="plain">Logout</Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const Header = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <Button
            variant="plain"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Global navigation"
          >
            <BarsIcon />
          </Button>
          LiteMaaS
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>{headerToolbar}</MastheadContent>
    </Masthead>
  );

  const Sidebar = (
    <PageSidebar open={isSidebarOpen}>
      <PageSidebarBody>{PageNav}</PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={Header} sidebar={Sidebar}>
      <Outlet />
    </Page>
  );
};

export default Layout;
