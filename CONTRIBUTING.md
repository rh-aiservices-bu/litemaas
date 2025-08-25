# Contributing to LiteMaaS

Thank you for your interest in contributing to LiteMaaS! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style and Conventions](#code-style-and-conventions)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR-USERNAME/litemaas.git
   cd litemaas
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/original-org/litemaas.git
   ```

4. **Set up development environment**:
   Follow the [Development Setup Guide](docs/development/setup.md)

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a new branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clear, self-documenting code
- Add tests for new functionality
- Update documentation as needed
- Follow our code style guidelines

### 3. Commit Your Changes

We follow conventional commits format:

```bash
git commit -m "feat: add new subscription API endpoint"
git commit -m "fix: resolve authentication timeout issue"
git commit -m "docs: update API documentation"
```

Commit types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 4. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

## Code Style and Conventions

### TypeScript/JavaScript

- We use ESLint and Prettier for code formatting
- Run `npm run lint` before committing
- Run `npm run format` to auto-fix formatting issues

### Key Conventions

- **File naming**: Use kebab-case for files (e.g., `user-service.ts`)
- **Variable naming**: Use camelCase for variables and functions
- **Class naming**: Use PascalCase for classes and interfaces
- **Constants**: Use UPPER_SNAKE_CASE for constants
- **Async/Await**: Prefer async/await over promises
- **Error handling**: Always handle errors appropriately

### Backend Specific

- Follow Fastify plugin patterns
- Use TypeBox for schema validation
- Implement proper error responses
- Add OpenAPI documentation for new endpoints

### Frontend Specific

- Follow React hooks best practices
- Use PatternFly 6 components (see [UI Guidelines](docs/development/pf6-guide/))
- Implement proper loading and error states
- Ensure accessibility compliance

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run in watch mode during development
cd backend && npm run test:watch
```

### Writing Tests

- Write unit tests for all business logic
- Write integration tests for API endpoints
- Aim for >80% code coverage
- Test error cases and edge conditions

## Container Development

### Building Container Images

LiteMaaS uses a centralized container build system with automatic versioning:

> **📦 Registry Configuration**: Before pushing images, configure your registry by editing the `REGISTRY` variable in `scripts/build-containers.sh`:
>
> ```bash
> # Edit line ~20 in scripts/build-containers.sh:
> REGISTRY="quay.io/rh-aiservices-bu"  # Default (for maintainers)
>
> # Contributors should use their own registry:
> REGISTRY="ghcr.io/your-username"              # GitHub Container Registry
> REGISTRY="docker.io/your-username"            # Docker Hub
> REGISTRY="your-company.com/your-username"     # Private registry
> ```

```bash
# Build both backend and frontend images
npm run build:containers

# Build and push to your configured registry
npm run build:containers:push

# Push existing images only (after building)
npm run push:containers
```

### Versioning Strategy

- **Single source of truth**: Only the root `package.json` version matters
- **Workspace packages**: Backend and frontend use `"version": "workspace"`
- **Image tagging**: Automatically tagged with version + `latest`

### Build Script Features

```bash
# Build for different platforms
./scripts/build-containers.sh --platform linux/arm64

# Build without cache
./scripts/build-containers.sh --no-cache

# Local builds only (no registry prefix)
./scripts/build-containers.sh --local
```

### For Contributors

**Important**: Contributors should:

1. **Configure your own registry** - Don't push to the default `quay.io/rh-aiservices-bu`
2. **Use local builds** for testing - `./scripts/build-containers.sh --local`
3. **Test thoroughly** before creating PRs

### Project Structure

```
scripts/
├── build-containers.sh    # Automated container build script
└── check-backend.js      # Backend health check script
```

**Key Points:**

- All scripts are in the `scripts/` directory for organization
- The build script auto-detects Docker/Podman
- Images use optimized multi-stage builds
- **Always configure your own registry** before pushing images

### Test Structure

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Test implementation
    });

    it('should throw error for duplicate email', async () => {
      // Test implementation
    });
  });
});
```

## Submitting Changes

### 1. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 2. Create a Pull Request

- Go to the original repository on GitHub
- Click "New Pull Request"
- Select your fork and branch
- Fill out the PR template

### PR Guidelines

- **Title**: Clear, concise description
- **Description**: Explain what, why, and how
- **Testing**: Describe how you tested changes
- **Screenshots**: Include for UI changes
- **Related Issues**: Link any related issues

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### 3. Code Review Process

- All PRs require at least one review
- Address reviewer feedback promptly
- Keep discussions focused and professional
- Update your PR based on feedback

## Reporting Issues

### Before Creating an Issue

- Search existing issues to avoid duplicates
- Check the documentation
- Try to reproduce the issue

### Creating an Issue

Use our issue templates:

- **Bug Report**: For reporting bugs
- **Feature Request**: For suggesting new features
- **Documentation**: For documentation improvements

### Issue Guidelines

- **Title**: Clear, specific summary
- **Description**: Detailed information
- **Steps to Reproduce**: For bugs
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Version, OS, browser, etc.

## Development Tips

### Debugging

- Backend: Use `LOG_LEVEL=debug` for verbose logging
- Frontend: Use React Developer Tools
- API: Use Swagger UI at <http://localhost:8081/docs>

### Performance

- Profile before optimizing
- Use appropriate data structures
- Implement pagination for large datasets
- Cache expensive operations

### Security

- Never commit secrets or credentials
- Validate all user input
- Use parameterized queries
- Follow OWASP guidelines

## Getting Help

- **Slack**: Join our internal Red Hat Slack channel, #litemaas
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check our [comprehensive docs](docs/)
- **Examples**: Look at existing code for patterns

## Recognition

Contributors are recognized in:

- GitHub contributors page
- Release notes
- Project documentation

Thank you for contributing to LiteMaaS! 🎉
