# PatternFly 6 Frontend Development Guide

> **Important**: This guide is the authoritative source for PatternFly 6 frontend development practices. It focuses exclusively on React component development with PatternFly 6.

Essential rules and guidelines for developing React applications with PatternFly 6 components and design system.

## Quick Navigation

### 🚀 Frontend Setup

- [**Setup Guide**](./setup/README.md) - Frontend development prerequisites
- [**Quick Start**](./setup/quick-start.md) - Start developing with PatternFly 6 and Vite
- [**Development Environment**](./setup/development-environment.md) - Frontend tools and configuration

### 📚 Development Guidelines

- [**PatternFly Guidelines**](./guidelines/README.md) - Core development principles with quality checklist
- [**Component Architecture**](./guidelines/component-architecture.md) - Component structure and patterns
- [**Styling Standards**](./guidelines/styling-standards.md) - Design tokens and CSS requirements
- [**Migration Codemods**](./guidelines/migration-codemods.md) - Automated migration tools for v6

### 🧩 Component Rules

- [**Layout Rules**](./components/layout/README.md) - Page structure requirements
- [**Table Component Rules**](./components/data-display/table.md) - Table usage and best practices
- [**Data View Component Rules**](./components/data-display/README.md) - Data view usage and best practices

### 📊 Specialized Rules

- [**Charts Rules**](./charts/README.md) - PatternFly Charts requirements
- [**Chatbot Rules**](./chatbot/README.md) - PatternFly Chatbot requirements

### 🧪 Testing Patterns

- [**Modal Testing**](./testing-patterns/modals.md) - Complete guide for testing PatternFly 6 Modal components in JSDOM
- [**Dropdown & Pagination Testing**](./testing-patterns/dropdowns-pagination.md) - Comprehensive guide for testing PatternFly 6 dropdowns and pagination in JSDOM
- [**Context-Dependent Components**](./testing-patterns/context-dependent-components.md) - Testing components that require parent context (Alert, Modal, etc.)

### 🔧 Troubleshooting

- [**Common Issues**](./troubleshooting/common-issues.md) - Frontend, PatternFly 6, and Vite issues

### 📖 Resources

- [**External Links**](./resources/external-links.md) - Official documentation links

## Core Development Principles

1. **PatternFly 6 Only** - Use `pf-v6-` prefixed classes exclusively
2. **Design Token System** - Use semantic tokens, never hardcode values
3. **Component-First** - Always use PatternFly components before custom solutions
4. **Accessibility Required** - WCAG 2.1 AA compliance is mandatory
5. **Consult documentation** - Reference [PatternFly.org](https://www.patternfly.org/) for examples
6. **Follow accessibility** - Implement proper ARIA labels and keyboard navigation
7. **Use utility classes** - Prefer PatternFly utilities over custom CSS
8. **Handle states** - Always implement loading, error, and empty states
9. **Theme Support** - Test in both light and dark themes
10. **Responsive Design** - Use rem units for breakpoints (px ÷ 16)
11. **TypeScript** - Maintain type safety in all components
12. **Performance** - Implement code splitting and optimize bundle size

## What's Covered

This guide provides comprehensive PatternFly 6 frontend development guidance:

- ✅ **Component Development** - PatternFly 6 React component patterns
- ✅ **Design Token System** - Complete token documentation and usage
- ✅ **Styling Standards** - CSS guidelines and utility classes
- ✅ **Migration Support** - Codemods and breaking changes from v5 to v6
- ✅ **Quality Checklists** - Development and code review checklists
- ✅ **Troubleshooting** - Common frontend issues and solutions

## Scope and Authority

### What This Guide Covers

- ✅ PatternFly 6 React components and patterns
- ✅ Frontend styling and design tokens
- ✅ Accessibility requirements
- ✅ Component architecture
- ✅ Frontend build and development with Vite

### What This Guide Does NOT Cover

- ❌ Backend development
- ❌ Deployment and CI/CD
- ❌ Database or API design
- ❌ Container orchestration
- ❌ Full-stack architecture

### Authority

This guide is the authoritative source for PatternFly 6 frontend patterns. When current implementation conflicts with this guide, follow the guide.

## External Resources

- [PatternFly.org](https://www.patternfly.org/) - Official PatternFly documentation
- [PatternFly React GitHub](https://github.com/patternfly/patternfly-react) - Source code and examples
- [Vite Documentation](https://vitejs.dev/) - Build tool documentation

## Related Project Documentation

For non-frontend concerns, see the main project documentation:

- **Backend Development**: `docs/development/`
- **API Documentation**: `docs/api/`
- **Deployment**: `docs/deployment/`
- **Architecture**: `docs/architecture/`
