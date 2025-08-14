# Assets

This directory contains all static assets used in the application.

## Directory Structure

```
src/assets/
├── images/           # Image assets (SVG, PNG, JPG, etc.)
│   ├── logo-title.svg           # Main brand logo with title
│   ├── avatar-placeholder.svg   # Default user avatar
│   └── litemaas_favicon.svg     # Favicon (automatically set)
└── index.ts          # Asset exports
```

## Usage

Import assets using the centralized exports:

```typescript
import { LogoTitle, AvatarPlaceholder, Favicon } from '../assets';

// Use in JSX
<img src={LogoTitle} alt="Company Logo" />
<Avatar src={AvatarPlaceholder} alt="User Avatar" />

// Favicon is automatically set in main.tsx
// No need to manually import for favicon usage
```

## Adding New Assets

1. Place your asset files in the appropriate subdirectory
2. Add the export to `index.ts`:
   ```typescript
   export { default as NewAsset } from './images/new-asset.svg';
   ```
3. Import and use in your components

## Benefits

- **Tree Shaking**: Only imported assets are included in the bundle
- **Type Safety**: TypeScript support for asset imports
- **Optimization**: Vite automatically optimizes imported assets
- **Cache Busting**: Automatic filename hashing for production builds
- **Centralized Management**: All assets exported from one location
