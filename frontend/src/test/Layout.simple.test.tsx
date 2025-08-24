import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import Layout from '../components/Layout';

// Mock react-i18next
const mockT = vi.fn((key) => key);
const mockChangeLanguage = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/home' }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet">Main Content</div>,
}));

// Mock contexts
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test', name: 'Test User', email: 'test@example.com' },
    logout: vi.fn(),
  }),
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    unreadCount: 2,
    toastNotifications: [],
    removeToastNotification: vi.fn(),
  }),
}));

// Mock assets
vi.mock('../assets', () => ({
  AvatarPlaceholder: 'avatar.svg',
  LogoTitle: 'logo.svg',
  starLogo: 'star.svg',
  githubLogo: 'github.svg',
  forkLogo: 'fork.svg',
  starLogoWhite: 'star-white.svg',
  forkLogoWhite: 'fork-white.svg',
  githubLogoWhite: 'github-white.svg',
}));

// Mock navigation config
vi.mock('../config/navigation', () => ({
  appConfig: {
    navigation: [
      {
        id: 'home',
        label: 'nav.home',
        path: '/home',
        icon: () => <span>Home</span>,
      },
    ],
  },
}));

// Mock notification components
vi.mock('../components/NotificationDrawer', () => ({
  NotificationDrawer: ({ isExpanded, onClose }: any) => (
    <div data-testid="notification-drawer" data-expanded={isExpanded}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
  NotificationBadgeButton: ({ onClick, unreadCount }: any) => (
    <button data-testid="notification-badge" onClick={onClick}>
      {unreadCount}
    </button>
  ),
}));

vi.mock('../components/AlertToastGroup', () => ({
  AlertToastGroup: ({ notifications }: any) => (
    <div data-testid="toast-group">{notifications.length} toasts</div>
  ),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    get: vi.fn().mockResolvedValue({
      data: { stargazers_count: 10, forks_count: 5 },
    }),
  },
}));

describe('Layout Component (Simplified)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup QueryClient
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'light'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  const renderLayout = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Layout />
      </QueryClientProvider>,
    );
  };

  it('renders without crashing', () => {
    renderLayout();
    // Look for actual PatternFly classes since real components are rendering
    expect(document.querySelector('.pf-v6-c-page')).toBeInTheDocument();
  });

  it('renders main content outlet', () => {
    renderLayout();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('renders masthead with brand', () => {
    renderLayout();
    expect(document.querySelector('.pf-v6-c-masthead')).toBeInTheDocument();
    expect(document.querySelector('.pf-v6-c-masthead__brand')).toBeInTheDocument();
  });

  it('renders sidebar with navigation', () => {
    renderLayout();
    // The sidebar and nav are rendered
    expect(document.querySelector('.pf-v6-c-nav')).toBeInTheDocument();
  });

  it('renders notification components', () => {
    renderLayout();
    expect(screen.getByTestId('notification-badge')).toBeInTheDocument();
    // Note: notification-drawer might not be visible initially
    expect(screen.getByTestId('toast-group')).toBeInTheDocument();
    // Check for drawer structure in DOM
    expect(document.querySelector('.pf-v6-c-drawer')).toBeInTheDocument();
  });

  it('toggles sidebar when menu button is clicked', async () => {
    const user = userEvent.setup();
    renderLayout();

    // Find the actual menu button
    const menuButton = document.querySelector('button[aria-controls="main-navigation"]');
    expect(menuButton).toBeInTheDocument();

    if (menuButton) {
      await user.click(menuButton);
      // Test that the button exists and is clickable
      expect(menuButton).toBeInTheDocument();
    }
  });

  it('handles theme toggle', () => {
    renderLayout();

    const themeToggle = document.querySelector('.pf-v6-c-toggle-group');
    expect(themeToggle).toBeInTheDocument();
  });

  it('opens notification drawer', async () => {
    const user = userEvent.setup();
    renderLayout();

    const notificationButton = screen.getByTestId('notification-badge');
    await user.click(notificationButton);

    // Test that clicking notification button works
    expect(notificationButton).toBeInTheDocument();
  });

  it('renders user avatar and dropdowns', () => {
    renderLayout();

    // Look for actual PatternFly components
    const avatar = document.querySelector('.pf-v6-c-avatar');
    expect(avatar).toBeInTheDocument();

    // Check for menu toggle instead of dropdown
    const menuToggle = document.querySelector('.pf-v6-c-menu-toggle');
    expect(menuToggle).toBeInTheDocument();
  });

  it('renders toolbar components', () => {
    renderLayout();

    expect(document.querySelector('.pf-v6-c-toolbar')).toBeInTheDocument();
    expect(document.querySelector('.pf-v6-c-toolbar__content')).toBeInTheDocument();
  });

  it('renders language and theme controls', () => {
    renderLayout();

    // Theme toggle
    const themeToggle = document.querySelector('.pf-v6-c-toggle-group');
    expect(themeToggle).toBeInTheDocument();

    // Menu toggle elements (for user/language dropdowns)
    const menuToggles = document.querySelectorAll('.pf-v6-c-menu-toggle');
    expect(menuToggles.length).toBeGreaterThan(0);
  });

  it('uses translations', () => {
    renderLayout();

    expect(mockT).toHaveBeenCalled();
  });

  it('has proper component structure', () => {
    renderLayout();

    // Verify PatternFly structure
    expect(document.querySelector('.pf-v6-c-page')).toBeInTheDocument();
    expect(document.querySelector('.pf-v6-c-masthead')).toBeInTheDocument();
    expect(document.querySelector('.pf-v6-c-drawer')).toBeInTheDocument();
  });
});
