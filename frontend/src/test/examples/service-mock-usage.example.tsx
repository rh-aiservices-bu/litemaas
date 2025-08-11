/**
 * Example: How to Use the Service Mock Factory
 *
 * This file demonstrates the proper usage of the service mock factory
 * to create consistent, predictable mocks across tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '../test-utils';
import {
  createAuthServiceMock,
  createModelsServiceMock,
  createAllServiceMocks,
  setupServiceMocks,
} from '../mocks/service-mock-factory';

// Example 1: Using individual service mocks
describe('Individual Service Mock Example', () => {
  it('should use auth service mock with custom configuration', async () => {
    // Create a mock with specific overrides
    const authMock = createAuthServiceMock({
      isAuthenticated: false,
      user: null,
    });

    // Mock the service module
    vi.mock('../../services/auth.service', () => ({
      authService: authMock,
    }));

    // Now the mock can be used and asserted upon
    expect(authMock.isAuthenticated()).toBe(false);

    // Attempt to get current user should fail
    await expect(authMock.getCurrentUser()).rejects.toThrow('Not authenticated');

    // Check that methods were called
    expect(authMock.isAuthenticated).toHaveBeenCalled();
    expect(authMock.getCurrentUser).toHaveBeenCalled();
  });

  it('should use models service mock with filtering', async () => {
    const modelsMock = createModelsServiceMock({
      models: [
        {
          id: 'custom-model',
          name: 'Custom Model',
          provider: 'CustomProvider',
          description: 'A custom test model',
          category: 'Language Model',
          contextLength: 4096,
          pricing: { input: 0.001, output: 0.002 },
          features: ['Chat'],
          availability: 'available' as const,
          version: '1.0',
        },
      ],
    });

    // Test the filtering capability
    const result = await modelsMock.getModels(1, 10, 'custom');
    expect(result.models).toHaveLength(1);
    expect(result.models[0].name).toBe('Custom Model');

    // Verify mock was called with correct parameters
    expect(modelsMock.getModels).toHaveBeenCalledWith(1, 10, 'custom', undefined, undefined);
  });
});

// Example 2: Using the complete mock setup
describe('Complete Service Mock Setup Example', () => {
  let mocks: ReturnType<typeof createAllServiceMocks>;

  beforeEach(() => {
    // Create all mocks with specific configurations
    mocks = createAllServiceMocks({
      auth: {
        isAuthenticated: true,
        user: {
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
          roles: ['admin'],
        },
      },
      config: {
        mockAuthEnabled: true,
        environment: 'development',
      },
    });

    // Set up all the vi.mock calls
    vi.mock('../../services/auth.service', () => ({
      authService: mocks.authService,
    }));

    vi.mock('../../services/models.service', () => ({
      modelsService: mocks.modelsService,
    }));

    vi.mock('../../services/config.service', () => ({
      configService: mocks.configService,
    }));
  });

  it('should have all services properly mocked', async () => {
    // Auth service
    expect(mocks.authService.isAuthenticated()).toBe(true);
    const user = await mocks.authService.getCurrentUser();
    expect(user.roles).toContain('admin');

    // Config service
    expect(mocks.configService.isMockAuthEnabled()).toBe(true);
    expect(mocks.configService.getEnvironment()).toBe('development');

    // Models service
    const models = await mocks.modelsService.getModels();
    expect(models.models).toBeDefined();
    expect(models.pagination).toBeDefined();
  });
});

// Example 3: Using setupServiceMocks for quick setup
describe('Quick Setup Example', () => {
  it('should quickly set up all mocks with defaults', () => {
    const mocks = setupServiceMocks();

    // All services are now mocked with default values
    expect(mocks.authService.isAuthenticated()).toBe(true);
    expect(mocks.configService.isAuthEnabled()).toBe(true);
  });

  it('should quickly set up mocks with overrides', () => {
    const mocks = setupServiceMocks({
      auth: { isAuthenticated: false },
      config: { authEnabled: false },
    });

    expect(mocks.authService.isAuthenticated()).toBe(false);
    expect(mocks.configService.isAuthEnabled()).toBe(false);
  });
});

// Example 4: Testing components with mocked services
describe('Component with Service Dependencies', () => {
  const ExampleComponent = () => {
    // This would normally use the actual services
    // But in tests, they're replaced with mocks
    return <div>Example Component</div>;
  };

  it('should render component with mocked services', async () => {
    // Render component
    render(<ExampleComponent />);

    // Component renders successfully with mocked services
    expect(screen.getByText('Example Component')).toBeInTheDocument();

    // Can still assert on service calls if needed
    // For example, if the component calls getCurrentUser on mount:
    // await waitFor(() => {
    //   expect(mocks.authService.getCurrentUser).toHaveBeenCalled();
    // });
  });
});

// Example 5: Resetting and updating mocks between tests
describe('Mock Reset Example', () => {
  let authMock: ReturnType<typeof createAuthServiceMock>;

  beforeEach(() => {
    authMock = createAuthServiceMock();
    vi.mock('../../services/auth.service', () => ({
      authService: authMock,
    }));
  });

  it('first test - user is authenticated', () => {
    expect(authMock.isAuthenticated()).toBe(true);
  });

  it('second test - can change mock behavior', () => {
    // Change the mock implementation for this test
    authMock.isAuthenticated.mockReturnValue(false);
    expect(authMock.isAuthenticated()).toBe(false);
  });

  it('third test - can spy on calls', async () => {
    await authMock.getCurrentUser();
    expect(authMock.getCurrentUser).toHaveBeenCalledTimes(1);

    await authMock.getCurrentUser();
    expect(authMock.getCurrentUser).toHaveBeenCalledTimes(2);
  });
});
