import { render, screen } from '../test-utils';
import { vi } from 'vitest';

// Test what gets rendered when we create a simple component
describe('LoginPage Debug', () => {
  it('should debug what renders', () => {
    const TestComponent = () => <div>Test Component</div>;
    render(<TestComponent />);

    // This should show us what actually gets rendered
    screen.debug();

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  it('should test LoginPage imports', async () => {
    // Mock services first
    const mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({ authMode: 'oauth' }),
    };

    vi.doMock('../../services/config.service', () => ({
      configService: mockConfigService,
    }));

    const mockUseAuth = {
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginAsAdmin: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    vi.doMock('../../contexts/AuthContext', () => ({
      useAuth: () => mockUseAuth,
    }));

    // Now try to import and render LoginPage
    const { default: LoginPage } = await import('../../pages/LoginPage');

    console.log('LoginPage imported:', LoginPage);

    render(<LoginPage />);

    screen.debug();
  });
});
