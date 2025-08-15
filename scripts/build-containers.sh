#!/bin/bash

# LiteMaaS Container Build Script
# Builds both backend and frontend container images using the version from root package.json

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PUSH_ONLY=false
BUILD_AND_PUSH=false
NO_CACHE=false
PLATFORM="linux/amd64"
LOCAL_ONLY=false
SKIP_VERSION_CHECK=false
REGISTRY="quay.io/rh-aiservices-bu"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to confirm version before building
confirm_version() {
    local version="$1"
    local backend_image="$2"
    local frontend_image="$3"
    
    echo
    print_warning "⚠️  VERSION CONFIRMATION REQUIRED"
    echo
    echo -e "  Current version: ${YELLOW}${version}${NC}"
    echo
    echo "  This will build/tag the following images:"
    echo -e "    📦 ${backend_image}:${YELLOW}${version}${NC}"
    echo -e "    📦 ${backend_image}:${YELLOW}latest${NC}"
    echo -e "    🌐 ${frontend_image}:${YELLOW}${version}${NC}"
    echo -e "    🌐 ${frontend_image}:${YELLOW}latest${NC}"
    echo
    echo -e "${YELLOW}⚠️  This may overwrite existing images with the same tags!${NC}"
    echo
    echo -e "Have you updated the version in package.json if needed? ${YELLOW}[y/N]${NC}"
    
    read -r response
    case "$response" in
        [yY]|[yY][eE][sS])
            print_success "Proceeding with build..."
            echo
            ;;
        *)
            print_error "Build cancelled. Please update package.json version if needed, then try again."
            echo
            print_status "To skip this check in automated builds, use: --skip-version-check"
            exit 1
            ;;
    esac
}

# Function to check if image exists locally
check_image_exists() {
    local image_name="$1"
    if $CONTAINER_CMD images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image_name}$"; then
        return 0
    else
        return 1
    fi
}

# Function to show usage
show_help() {
    cat << EOF
LiteMaaS Container Build Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --push              Push existing images to registry (no build)
    --build-and-push    Build images and then push to registry
    --no-cache          Build without using cache
    --platform PLATFORM Specify target platform (default: linux/amd64)
    --local             Build with local tags only (no registry prefix)
    --skip-version-check Skip version confirmation prompt (for CI/CD)
    -h, --help          Show this help message

EXAMPLES:
    $0                          # Build both images locally (with version check)
    $0 --build-and-push         # Build and push to registry
    $0 --push                   # Push existing images to registry
    $0 --skip-version-check     # Build without version confirmation (CI/CD)
    $0 --local --no-cache       # Build locally without cache
    $0 --platform linux/arm64   # Build for ARM64 platform

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH_ONLY=true
            shift
            ;;
        --build-and-push)
            BUILD_AND_PUSH=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --local)
            LOCAL_ONLY=true
            shift
            ;;
        --skip-version-check)
            SKIP_VERSION_CHECK=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate mutually exclusive options
if [[ "$PUSH_ONLY" == "true" && "$BUILD_AND_PUSH" == "true" ]]; then
    print_error "Cannot use both --push and --build-and-push options together"
    exit 1
fi

# Detect container runtime (docker or podman)
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    print_status "Using Docker as container runtime"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    print_status "Using Podman as container runtime"
else
    print_error "Neither Docker nor Podman found. Please install one of them."
    exit 1
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Extract version from root package.json
print_status "Reading version from package.json..."
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found in project root"
    exit 1
fi

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
if [[ -z "$VERSION" ]]; then
    print_error "Could not extract version from package.json"
    exit 1
fi

print_success "Project version: $VERSION"

# Validate Containerfiles exist
if [[ ! -f "backend/Containerfile" ]]; then
    print_error "backend/Containerfile not found"
    exit 1
fi

if [[ ! -f "frontend/Containerfile" ]]; then
    print_error "frontend/Containerfile not found"
    exit 1
fi

# Set up image names
if [[ "$LOCAL_ONLY" == "true" ]]; then
    BACKEND_IMAGE="litemaas-backend"
    FRONTEND_IMAGE="litemaas-frontend"
else
    BACKEND_IMAGE="$REGISTRY/litemaas-backend"
    FRONTEND_IMAGE="$REGISTRY/litemaas-frontend"
fi

# Version confirmation check (unless skipped or push-only)
if [[ "$SKIP_VERSION_CHECK" != "true" && "$PUSH_ONLY" != "true" ]]; then
    confirm_version "$VERSION" "$BACKEND_IMAGE" "$FRONTEND_IMAGE"
fi

# Handle push-only mode
if [[ "$PUSH_ONLY" == "true" ]]; then
    if [[ "$LOCAL_ONLY" == "true" ]]; then
        print_error "Cannot push with --local flag. Use --build-and-push for local builds."
        exit 1
    fi
    
    print_status "Push-only mode: Checking if images exist locally..."
    
    # Check if images exist
    missing_images=()
    if ! check_image_exists "${BACKEND_IMAGE}:${VERSION}"; then
        missing_images+=("${BACKEND_IMAGE}:${VERSION}")
    fi
    if ! check_image_exists "${BACKEND_IMAGE}:latest"; then
        missing_images+=("${BACKEND_IMAGE}:latest")
    fi
    if ! check_image_exists "${FRONTEND_IMAGE}:${VERSION}"; then
        missing_images+=("${FRONTEND_IMAGE}:${VERSION}")
    fi
    if ! check_image_exists "${FRONTEND_IMAGE}:latest"; then
        missing_images+=("${FRONTEND_IMAGE}:latest")
    fi
    
    if [[ ${#missing_images[@]} -gt 0 ]]; then
        print_error "Missing images for push:"
        for img in "${missing_images[@]}"; do
            echo "  - $img"
        done
        print_error "Build images first or use --build-and-push option"
        exit 1
    fi
    
    print_success "All images found locally"
fi

# Build images (unless push-only mode)
if [[ "$PUSH_ONLY" != "true" ]]; then
    # Build arguments
    BUILD_ARGS=()
    if [[ "$NO_CACHE" == "true" ]]; then
        BUILD_ARGS+=(--no-cache)
    fi
    BUILD_ARGS+=(--platform "$PLATFORM")

    print_status "Starting container builds..."
    echo "  Backend image:  ${BACKEND_IMAGE}:${VERSION}"
    echo "  Frontend image: ${FRONTEND_IMAGE}:${VERSION}"
    echo "  Platform:       $PLATFORM"
    echo "  Build and push: $BUILD_AND_PUSH"
    echo

    # Build backend image
    print_status "Building backend container..."
    if $CONTAINER_CMD build "${BUILD_ARGS[@]}" \
        -f backend/Containerfile \
        -t "${BACKEND_IMAGE}:${VERSION}" \
        -t "${BACKEND_IMAGE}:latest" \
        .; then
        print_success "Backend container built successfully"
    else
        print_error "Failed to build backend container"
        exit 1
    fi

    # Build frontend image
    print_status "Building frontend container..."
    if $CONTAINER_CMD build "${BUILD_ARGS[@]}" \
        -f frontend/Containerfile \
        -t "${FRONTEND_IMAGE}:${VERSION}" \
        -t "${FRONTEND_IMAGE}:latest" \
        .; then
        print_success "Frontend container built successfully"
    else
        print_error "Failed to build frontend container"
        exit 1
    fi
fi

# Push images if requested
if [[ ("$PUSH_ONLY" == "true" || "$BUILD_AND_PUSH" == "true") && "$LOCAL_ONLY" == "false" ]]; then
    print_status "Pushing images to registry..."
    
    # Push backend
    print_status "Pushing backend image..."
    if $CONTAINER_CMD push "${BACKEND_IMAGE}:${VERSION}" && \
       $CONTAINER_CMD push "${BACKEND_IMAGE}:latest"; then
        print_success "Backend image pushed successfully"
    else
        print_error "Failed to push backend image"
        exit 1
    fi
    
    # Push frontend
    print_status "Pushing frontend image..."
    if $CONTAINER_CMD push "${FRONTEND_IMAGE}:${VERSION}" && \
       $CONTAINER_CMD push "${FRONTEND_IMAGE}:latest"; then
        print_success "Frontend image pushed successfully"
    else
        print_error "Failed to push frontend image"
        exit 1
    fi
    
    print_success "All images pushed successfully!"
elif [[ ("$PUSH_ONLY" == "true" || "$BUILD_AND_PUSH" == "true") && "$LOCAL_ONLY" == "true" ]]; then
    print_warning "Cannot push with --local flag. Images built locally only."
fi

# Final status message
if [[ "$PUSH_ONLY" == "true" ]]; then
    print_success "Push process completed!"
elif [[ "$BUILD_AND_PUSH" == "true" ]]; then
    print_success "Build and push process completed!"
else
    print_success "Container build process completed!"
fi

echo
if [[ "$PUSH_ONLY" != "true" ]]; then
    print_status "Built images:"
    echo "  📦 ${BACKEND_IMAGE}:${VERSION}"
    echo "  📦 ${BACKEND_IMAGE}:latest"
    echo "  🌐 ${FRONTEND_IMAGE}:${VERSION}"
    echo "  🌐 ${FRONTEND_IMAGE}:latest"
fi

if [[ "$PUSH_ONLY" == "false" && "$BUILD_AND_PUSH" == "false" && "$LOCAL_ONLY" == "false" ]]; then
    echo
    print_status "To push images to registry, run:"
    echo "  $0 --push"
fi