#!/usr/bin/env node

// Modified version of check-translations.js that uses test directory
const path = require('path');
const originalScript = require('../check-translations.js');

// Override the LOCALES_DIR
const LOCALES_DIR = path.join(__dirname, 'test-locales');

// We can't easily override the LOCALES_DIR in the original script,
// so let's test manually by copying the locale files temporarily
const fs = require('fs');

// Test with dry run first
console.log('Running check-translations with test files...');

// Change to the parent directory so the script can find itself
process.chdir(path.join(__dirname, '..'));

// Set environment variable to override the locales directory
const originalArgv = process.argv;
process.argv = [
  'node',
  'check-translations.js',
  '--reorder',
  '--missing-strategy=mark',
  '--verbose',
];

// Override LOCALES_DIR by temporarily copying files
const mainLocalesDir = path.join(__dirname, '../src/i18n/locales');
const testLocalesDir = path.join(__dirname, 'test-locales');

// Backup original files
const enBackup = fs.readFileSync(path.join(mainLocalesDir, 'en/translation.json'), 'utf8');
const frBackup = fs.readFileSync(path.join(mainLocalesDir, 'fr/translation.json'), 'utf8');

try {
  // Copy test files
  fs.copyFileSync(
    path.join(testLocalesDir, 'en/translation.json'),
    path.join(mainLocalesDir, 'en/translation.json'),
  );
  fs.copyFileSync(
    path.join(testLocalesDir, 'fr/translation.json'),
    path.join(mainLocalesDir, 'fr/translation.json'),
  );

  // Run the script
  require('../check-translations.js');
} finally {
  // Restore original files
  fs.writeFileSync(path.join(mainLocalesDir, 'en/translation.json'), enBackup);
  fs.writeFileSync(path.join(mainLocalesDir, 'fr/translation.json'), frBackup);
  process.argv = originalArgv;
}
