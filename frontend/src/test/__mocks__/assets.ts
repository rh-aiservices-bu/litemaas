/**
 * Asset Mocks
 *
 * Provides valid mock data for various asset types to prevent
 * undefined values during tests and ensure proper rendering.
 */

// Valid base64 encoded 1x1 transparent PNG
export const mockPngDataUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Valid base64 encoded 1x1 transparent GIF
export const mockGifDataUri =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Valid base64 encoded JPEG (1x1 black pixel)
export const mockJpegDataUri =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

// Valid SVG data URI with proper structure
export const mockSvgDataUri =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+';

// Valid SVG React component mock
export const mockSvgComponent = () => ({
  $$typeof: Symbol.for('react.element'),
  type: 'svg',
  props: {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    children: null,
  },
  key: null,
  ref: null,
});

// Mock for CSS modules - returns a proxy that returns the class name
export const createCssModuleMock = () => {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return prop;
        }
        return undefined;
      },
    },
  );
};

// Mock for font files
export const mockFontUrl = '/mock-font.woff2';

// Mock for other binary assets
export const mockBinaryUrl = '/mock-file.bin';

/**
 * Create a mock for imported images with common properties
 */
export const createImageMock = (type: 'png' | 'jpg' | 'jpeg' | 'gif' | 'svg' = 'png') => {
  const dataUris = {
    png: mockPngDataUri,
    jpg: mockJpegDataUri,
    jpeg: mockJpegDataUri,
    gif: mockGifDataUri,
    svg: mockSvgDataUri,
  };

  return {
    default: dataUris[type],
    src: dataUris[type],
    width: 1,
    height: 1,
    toString: () => dataUris[type],
  };
};

/**
 * Mock for dynamic imports of assets
 */
export const mockDynamicImport = (path: string) => {
  const extension = path.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return Promise.resolve(createImageMock(extension as any));
    case 'svg':
      return Promise.resolve({
        default: mockSvgComponent,
        ReactComponent: mockSvgComponent,
      });
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return Promise.resolve({ default: createCssModuleMock() });
    case 'json':
      return Promise.resolve({ default: {} });
    default:
      return Promise.resolve({ default: mockBinaryUrl });
  }
};

// Export default for asset imports - returns the appropriate mock based on import context
const defaultMock = mockPngDataUri;

export default defaultMock;

// Named exports for specific asset types
export const png = createImageMock('png');
export const jpg = createImageMock('jpg');
export const jpeg = createImageMock('jpeg');
export const gif = createImageMock('gif');
export const svg = {
  default: mockSvgDataUri,
  ReactComponent: mockSvgComponent,
};
export const css = createCssModuleMock();
export const scss = createCssModuleMock();
export const sass = createCssModuleMock();
export const less = createCssModuleMock();
export const woff = mockFontUrl;
export const woff2 = mockFontUrl;
export const ttf = mockFontUrl;
export const eot = mockFontUrl;
export const otf = mockFontUrl;
export const pdf = mockBinaryUrl;
export const zip = mockBinaryUrl;
