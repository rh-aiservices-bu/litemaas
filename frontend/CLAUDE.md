# CLAUDE.md - LiteMaaS Frontend Context

> **Note for AI Assistants**: This is a frontend-specific context file for the LiteMaaS React application. For project overview, see root CLAUDE.md. For backend context, see backend/CLAUDE.md.

## 🎯 Frontend Overview

**@litemaas/frontend** - React 18 application with TypeScript, Vite, and PatternFly 6 component library.

## 📁 Frontend Structure

```
frontend/
├── src/
│   ├── assets/            # Static assets
│   │   ├── images/       # Images and logos
│   │   └── icons/        # Custom icons
│   ├── components/        # Reusable components
│   │   ├── charts/       # Chart components
│   │   ├── AlertToastGroup.tsx # Toast notifications
│   │   ├── ErrorBoundary.tsx # Error handling
│   │   ├── Layout.tsx    # Main app layout
│   │   ├── NotificationDrawer.tsx # Notification UI
│   │   └── ProtectedRoute.tsx # Auth route guard
│   ├── config/            # App configuration
│   │   └── navigation.ts # Navigation structure
│   ├── contexts/          # React Context providers
│   │   ├── AuthContext.tsx # Authentication state
│   │   └── NotificationContext.tsx # Notifications
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts    # Auth operations
│   │   ├── useApi.ts     # API calls wrapper
│   │   └── useNotifications.ts # Notification helpers
│   ├── i18n/              # Internationalization
│   │   ├── index.ts      # i18n configuration
│   │   └── locales/      # Translation files
│   │       ├── en/       # English
│   │       ├── es/       # Spanish
│   │       └── fr/       # French
│   ├── pages/             # Page components
│   │   ├── Home/         # Dashboard
│   │   ├── Models/       # Model catalog
│   │   ├── Subscriptions/ # Subscription management
│   │   ├── ApiKeys/      # API key management
│   │   ├── Usage/        # Usage analytics
│   │   └── Settings/     # User settings
│   ├── routes/            # Routing configuration
│   │   └── index.tsx     # Route definitions
│   ├── services/          # API service layer
│   │   ├── api.ts        # Axios instance & interceptors
│   │   ├── auth.service.ts # Authentication API
│   │   ├── models.service.ts # Models API
│   │   ├── subscriptions.service.ts # Subscriptions API
│   │   └── apiKeys.service.ts # API keys API
│   ├── types/             # TypeScript interfaces
│   │   ├── auth.ts       # Auth types
│   │   ├── models.ts     # Model types
│   │   └── api.ts        # API response types
│   ├── utils/             # Utility functions
│   │   ├── formatters.ts # Data formatting
│   │   ├── validators.ts # Form validation
│   │   └── constants.ts  # App constants
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static public assets
├── tests/               # Test files
└── dist/                # Build output
```

## 🎨 PatternFly 6 Critical Requirements

⚠️ **MANDATORY**: Follow the [PatternFly 6 Development Guide](../docs/development/pf6-guide/README.md) as the **AUTHORITATIVE SOURCE** for all UI development.

### Essential Rules
1. **Class Prefix**: ALL PatternFly classes MUST use `pf-v6-` prefix
2. **Design Tokens**: Use semantic tokens only, never hardcode colors
3. **Component Import**: Import from `@patternfly/react-core` v6 and other @patternfly libraries
4. **Theme Testing**: Test in both light and dark themes
5. **Table Patterns**: Follow guide's table implementation (current code may be outdated)

### Common Mistakes to Avoid
```typescript
// ❌ WRONG - Missing pf-v6- prefix
<div className="c-card">

// ✅ CORRECT
<div className="pf-v6-c-card">

// ❌ WRONG - Hardcoded color
style={{ color: '#0066CC' }}

// ✅ CORRECT - Use design token
style={{ color: 'var(--pf-v6-global--primary-color--100)' }}
```

## 🏗️ State Management

### React Context (Global State)
```typescript
// AuthContext - User authentication state
{
  user: User | null,
  isAuthenticated: boolean,
  login: (credentials) => Promise<void>,
  logout: () => void,
  checkAuth: () => Promise<void>
}

// NotificationContext - App notifications
{
  notifications: Notification[],
  addNotification: (notification) => void,
  removeNotification: (id) => void,
  clearAll: () => void
}
```

### React Query (Server State)
```typescript
// Caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      cacheTime: 10 * 60 * 1000,   // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false
    }
  }
});

// Usage pattern
const { data, isLoading, error } = useQuery(
  ['models'],
  () => modelsService.getAll(),
  { enabled: isAuthenticated }
);
```

## 🔌 API Service Layer

### Axios Configuration
```typescript
// Base setup with interceptors
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// JWT token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error handling interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);
```

### Service Pattern
```typescript
// Consistent service structure
export const modelService = {
  getAll: () => apiClient.get<Model[]>('/models'),
  getById: (id: string) => apiClient.get<Model>(`/models/${id}`),
  subscribe: (modelId: string, data: SubscriptionRequest) => 
    apiClient.post<Subscription>(`/models/${modelId}/subscribe`, data),
  unsubscribe: (modelId: string) => 
    apiClient.delete(`/models/${modelId}/unsubscribe`)
};
```

## 🌐 Routing Structure

```typescript
// Main routes configuration
const routes = [
  { path: '/', element: <Navigate to="/home" /> },
  { path: '/home', element: <HomePage /> },
  { path: '/models', element: <ModelsPage /> },
  { path: '/models/:id', element: <ModelDetailPage /> },
  { path: '/subscriptions', element: <SubscriptionsPage /> },
  { path: '/api-keys', element: <ApiKeysPage /> },
  { path: '/usage', element: <UsagePage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallback /> }
];

// Protected route wrapper
<ProtectedRoute>
  <Route element={<Component />} />
</ProtectedRoute>
```

## 🌍 Internationalization (i18n)

### Configuration
```typescript
i18n.use(initReactI18next).init({
  resources: { en, es, fr },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage']
  }
});
```

### Usage Pattern
```typescript
import { useTranslation } from 'react-i18next';

function Component() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('models.title')}</h1>
      <p>{t('models.description', { count: modelCount })}</p>
    </div>
  );
}
```

## 🎯 Component Patterns

### Page Component Structure
```typescript
export const ModelPage: React.FC = () => {
  // Hooks
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // React Query
  const { data: models, isLoading, error } = useQuery(
    ['models'],
    modelService.getAll
  );
  
  // Local state
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  
  // Handlers
  const handleSubscribe = async (model: Model) => {
    // Implementation
  };
  
  // Loading state
  if (isLoading) return <Spinner />;
  
  // Error state
  if (error) return <ErrorAlert error={error} />;
  
  // Main render
  return (
    <PageSection variant="light">
      {/* Component content */}
    </PageSection>
  );
};
```

### Form Handling Pattern
```typescript
const FormComponent: React.FC = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState<ValidationErrors>({});
  
  const validate = (): boolean => {
    const newErrors = validateForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      await apiService.submit(formData);
      showSuccessToast('Success!');
    } catch (error) {
      showErrorToast('Failed to submit');
    }
  };
  
  return (
    <Form onSubmit={handleSubmit}>
      {/* Form fields */}
    </Form>
  );
};
```

## 🚀 Development Commands

```bash
# Development server with HMR
npm run dev             # Starts on http://localhost:5173

# Building
npm run build          # Production build
npm run preview        # Preview production build

# Testing
npm run test           # Run all tests
npm run test:unit      # Unit tests only
npm run test:e2e       # Playwright E2E tests
npm run test:e2e:ui    # Playwright UI mode
npm run test:coverage  # Coverage report

# Code quality
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix issues

# Cleanup
npm run clean          # Remove build artifacts
```

## 🎨 Styling Guidelines

### CSS Organization
```css
/* Component-specific styles */
.app-custom-component {
  /* Use PatternFly design tokens */
  padding: var(--pf-v6-global--spacer--md);
  color: var(--pf-v6-global--Color--100);
  
  /* Responsive utilities */
  @media (min-width: 768px) {
    padding: var(--pf-v6-global--spacer--lg);
  }
}

/* Dark theme overrides */
[data-theme="dark"] .app-custom-component {
  background: var(--pf-v6-global--BackgroundColor--dark-200);
}
```

## 📊 Performance Targets
- Initial load: <3s
- Time to interactive: <5s
- Lighthouse score: >90
- Bundle size: <500KB gzipped
- React renders: Optimized with memo/useMemo/useCallback

## 🔧 Key Implementation Notes

### Authentication Flow
1. User clicks "Login" → Redirect to OAuth provider
2. OAuth callback → Receive auth code
3. Exchange code for JWT token
4. Store token in localStorage
5. Set auth context → App ready

### Error Boundary Strategy
```typescript
// Global error boundary
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>

// Component-level boundary
<ComponentErrorBoundary>
  <RiskyComponent />
</ComponentErrorBoundary>
```

### Data Fetching Patterns
- **List views**: Use React Query with pagination
- **Detail views**: Prefetch on hover, cache for navigation
- **Forms**: Optimistic updates with rollback on error
- **Real-time**: Consider WebSocket for live updates

## 🔗 Environment Variables

Key frontend configuration:
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_AUTH_URL=http://localhost:3000/api/auth

# Feature Flags
VITE_ENABLE_MOCK_AUTH=false
VITE_ENABLE_ANALYTICS=true

# i18n
VITE_DEFAULT_LOCALE=en
VITE_SUPPORTED_LOCALES=en,es,fr
```

## 📚 Related Documentation
- Root [`CLAUDE.md`](../CLAUDE.md) - Project overview
- Backend [`CLAUDE.md`](../backend/CLAUDE.md) - Backend context
- [`docs/development/pf6-guide/`](../docs/development/pf6-guide/) - **PatternFly 6 Guide (AUTHORITATIVE)**
- [`docs/development/`](../docs/development/) - Development setup
- [`docs/architecture/`](../docs/architecture/) - System design