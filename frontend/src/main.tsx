import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Favicon } from './assets';
import { initializeAxeAccessibility } from './utils/accessibility-setup';
import './i18n'; // Initialize i18n
import './index.css';
import '@patternfly/chatbot/dist/css/main.css';

// Create a high-contrast PNG favicon for better Chrome visibility
const createPngFavicon = (): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // If no 2D context is available (e.g., limited test environment), skip PNG generation
    if (!ctx || typeof (ctx as any).fillRect !== 'function') {
      return '';
    }

    // Helper to draw a rounded rectangle with a fallback if roundRect is unavailable
    const drawRoundedRect = (
      context: CanvasRenderingContext2D | any,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      const r = Math.max(0, Math.min(radius, width / 2, height / 2));
      context.beginPath();
      if (typeof context.roundRect === 'function') {
        context.roundRect(x, y, width, height, r);
      } else {
        // Manual rounded rectangle path using arcTo
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.arcTo(x + width, y, x + width, y + r, r);
        context.lineTo(x + width, y + height - r);
        context.arcTo(x + width, y + height, x + width - r, y + height, r);
        context.lineTo(x + r, y + height);
        context.arcTo(x, y + height, x, y + height - r, r);
        context.lineTo(x, y + r);
        context.arcTo(x, y, x + r, y, r);
        context.closePath();
      }
    };

    // Clear background with white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 32, 32);

    // Draw simplified cloud shape
    ctx.fillStyle = '#29B6F6';
    drawRoundedRect(ctx, 6, 12, 20, 12, 6);
    ctx.fill();

    // Draw neural network nodes
    ctx.fillStyle = '#FF8A65';
    ctx.beginPath();
    ctx.arc(10, 16, 3, 0, 2 * Math.PI);
    ctx.arc(10, 20, 3, 0, 2 * Math.PI);
    ctx.arc(22, 18, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw connections
    ctx.strokeStyle = '#D84315';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(13, 16);
    ctx.lineTo(19, 18);
    ctx.moveTo(13, 20);
    ctx.lineTo(19, 18);
    ctx.stroke();

    try {
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  } catch {
    // Any unexpected error should not break app/tests; gracefully skip PNG generation
    return '';
  }
};

// Set favicon dynamically with multiple formats for better browser support
const setFavicon = (svgHref: string) => {
  try {
    // Remove any existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach((link) => link.remove());

    // Create and add PNG favicon for Chrome (better small size visibility)
    const pngFavicon = createPngFavicon();
    if (pngFavicon && pngFavicon.startsWith('data:image/png')) {
      const pngLink = document.createElement('link');
      pngLink.rel = 'icon';
      pngLink.type = 'image/png';
      pngLink.href = pngFavicon;
      pngLink.setAttribute('sizes', '32x32');
      document.head.appendChild(pngLink);
    }

    // Add SVG favicon as fallback for other browsers
    const svgLink = document.createElement('link');
    svgLink.rel = 'icon';
    svgLink.type = 'image/svg+xml';
    svgLink.href = svgHref;
    svgLink.setAttribute('sizes', 'any');
    document.head.appendChild(svgLink);
  } catch {
    // Ignore favicon errors in constrained environments (e.g., tests)
  }
};

// Set the favicon
setFavicon(Favicon);

// Initialize accessibility testing in development
if (process.env.NODE_ENV === 'development') {
  initializeAxeAccessibility(ReactDOM, React, 1000);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(ErrorBoundary, null, React.createElement(App, null)),
  ),
);
