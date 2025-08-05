import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Favicon } from './assets';
import './i18n'; // Initialize i18n
import './index.css';

// Create a high-contrast PNG favicon for better Chrome visibility
const createPngFavicon = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  // Clear background with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);

  // Draw simplified cloud shape
  ctx.fillStyle = '#29B6F6';
  ctx.beginPath();
  ctx.roundRect(6, 12, 20, 12, 6);
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

  return canvas.toDataURL('image/png');
};

// Set favicon dynamically with multiple formats for better browser support
const setFavicon = (svgHref: string) => {
  // Remove any existing favicon links
  const existingLinks = document.querySelectorAll("link[rel*='icon']");
  existingLinks.forEach((link) => link.remove());

  // Create and add PNG favicon for Chrome (better small size visibility)
  const pngFavicon = createPngFavicon();
  const pngLink = document.createElement('link');
  pngLink.rel = 'icon';
  pngLink.type = 'image/png';
  pngLink.href = pngFavicon;
  pngLink.setAttribute('sizes', '32x32');
  document.head.appendChild(pngLink);

  // Add SVG favicon as fallback for other browsers
  const svgLink = document.createElement('link');
  svgLink.rel = 'icon';
  svgLink.type = 'image/svg+xml';
  svgLink.href = svgHref;
  svgLink.setAttribute('sizes', 'any');
  document.head.appendChild(svgLink);
};

// Set the favicon
setFavicon(Favicon);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
