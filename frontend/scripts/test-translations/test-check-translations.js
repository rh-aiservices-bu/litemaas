#!/usr/bin/env node

// Test version of check-translations.js that uses our test locale directory
// This is a copy of the main script with LOCALES_DIR changed to use test files

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, 'test-locales'); // Changed to test directory
const SOURCE_LOCALE = 'en';

// Translation markers
const MISSING_MARKER = '🔴 MISSING TRANSLATION - PLEASE TRANSLATE: ';
const UNTRANSLATED_MARKER = '⚠️ UNTRANSLATED: ';

// Copy all the functions from the main script
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fixDuplicates: false,
    duplicateStrategy: 'first',
    reorder: false,
    missingStrategy: 'skip',
    locales: null,
    dryRun: false,
    includeMarked: false,
    cleanMarkers: false,
    verbose: false,
    noBackup: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--fix-duplicates') {
      options.fixDuplicates = true;
    } else if (arg.startsWith('--strategy=')) {
      options.duplicateStrategy = arg.split('=')[1];
    } else if (arg === '--reorder') {
      options.reorder = true;
    } else if (arg.startsWith('--missing-strategy=')) {
      options.missingStrategy = arg.split('=')[1];
    } else if (arg.startsWith('--locales=')) {
      options.locales = arg
        .split('=')[1]
        .split(',')
        .map((l) => l.trim());
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

// Copy all helper functions from main script...
function findDuplicatesInRawJSON(jsonText) {
  const lines = jsonText.split('\n');
  const duplicates = [];

  // Track keys at each nesting level
  const keysAtLevel = [{}]; // Array of objects, one for each nesting level
  let currentLevel = 0;

  lines.forEach((line, idx) => {
    // Track brace depth
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;

    // Update level before processing the line
    if (closeBraces > openBraces) {
      currentLevel -= closeBraces - openBraces;
      // Clean up keys at closed levels
      keysAtLevel.splice(currentLevel + 1);
    }

    // Check for key-value pairs
    const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
    if (keyMatch) {
      const key = keyMatch[1];
      const value = line.split(':').slice(1).join(':').trim();

      // Determine if this is an object key or leaf key
      const isObjectKey = value.trim().startsWith('{') || value.trim() === '{';
      const keyType = isObjectKey ? 'object' : 'leaf';

      // Ensure we have an object for this level
      if (!keysAtLevel[currentLevel]) {
        keysAtLevel[currentLevel] = {};
      }

      // Check if this key already exists at current level
      if (keysAtLevel[currentLevel][key]) {
        const existingType = keysAtLevel[currentLevel][key].type;

        duplicates.push({
          key: key,
          firstLine: keysAtLevel[currentLevel][key].line,
          firstValue: keysAtLevel[currentLevel][key].value,
          firstType: existingType,
          duplicateLine: idx + 1,
          duplicateValue: value,
          duplicateType: keyType,
          level: currentLevel,
          type: keyType,
        });
      } else {
        keysAtLevel[currentLevel][key] = {
          line: idx + 1,
          value: value,
          type: keyType,
        };
      }
    }

    // Update level after processing the line
    if (openBraces > closeBraces) {
      currentLevel += openBraces - closeBraces;
      // Initialize new level
      if (!keysAtLevel[currentLevel]) {
        keysAtLevel[currentLevel] = {};
      }
    }
  });

  return duplicates;
}

function getAllKeys(obj, prefix = '') {
  const keys = new Set();

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Recursively get keys from nested objects
      const nestedKeys = getAllKeys(obj[key], fullKey);
      nestedKeys.forEach((k) => keys.add(k));
    } else {
      // Add the leaf key
      keys.add(fullKey);
    }
  }

  return keys;
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function reorderKeys(target, source, sourceTranslation, missingStrategy, pathPrefix = '') {
  const result = {};

  // First pass: Add all keys from source in order
  for (const key in source) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (key in target) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        // Recursively reorder nested objects
        result[key] = reorderKeys(
          target[key],
          source[key],
          sourceTranslation,
          missingStrategy,
          currentPath,
        );
      } else {
        // Copy value from target
        result[key] = target[key];
      }
    } else {
      // Handle missing key based on strategy
      if (missingStrategy === 'skip') {
        continue; // Don't add
      } else if (missingStrategy === 'mark') {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          // For nested objects, recursively create structure with markers
          result[key] = reorderKeys(
            {},
            source[key],
            sourceTranslation,
            missingStrategy,
            currentPath,
          );
        } else {
          // For leaf values, add with marker
          result[key] = `${MISSING_MARKER}${source[key]}`;
        }
      } else if (missingStrategy === 'copy') {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          // For nested objects, deep copy the structure
          result[key] = JSON.parse(JSON.stringify(source[key]));
        } else {
          // For leaf values, add with untranslated marker
          result[key] = `${UNTRANSLATED_MARKER}${source[key]}`;
        }
      }
    }
  }

  // Second pass: Add extra keys not in source (at the end)
  for (const key in target) {
    if (!(key in source)) {
      result[key] = target[key];
    }
  }

  return result;
}

function readTranslationFile(locale) {
  const filePath = path.join(LOCALES_DIR, locale, 'translation.json');

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${locale} translation file:`, error.message);
    return null;
  }
}

function getAvailableLocales() {
  try {
    const locales = fs.readdirSync(LOCALES_DIR).filter((file) => {
      const fullPath = path.join(LOCALES_DIR, file);
      return fs.statSync(fullPath).isDirectory();
    });
    return locales;
  } catch (error) {
    console.error('Error reading locales directory:', error.message);
    return [];
  }
}

// Main function to test the reordering
function testReordering() {
  console.log('🧪 Testing Translation Key Reordering with Missing Key Marking\n');

  // Read source and target
  const sourceTranslation = readTranslationFile('en');
  const targetTranslation = readTranslationFile('fr');

  if (!sourceTranslation || !targetTranslation) {
    console.error('❌ Failed to read test files');
    return;
  }

  const sourceKeys = getAllKeys(sourceTranslation);
  const targetKeys = getAllKeys(targetTranslation);

  console.log(`📊 Source has ${sourceKeys.size} keys`);
  console.log(`📊 Target has ${targetKeys.size} keys`);

  const missingKeys = [...sourceKeys].filter((key) => !targetKeys.has(key));
  console.log(`📊 Missing in target: ${missingKeys.length} keys\n`);

  console.log(
    'Missing keys:',
    missingKeys.slice(0, 5).join(', '),
    missingKeys.length > 5 ? '...' : '',
  );

  // Test reordering with missing key marking
  console.log('\n🔄 Testing reorderKeys function with mark strategy...');
  const reordered = reorderKeys(targetTranslation, sourceTranslation, sourceTranslation, 'mark');

  // Check for markers
  function checkForMarkers(obj, path = '') {
    const markers = [];
    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key;
      if (typeof obj[key] === 'string' && obj[key].startsWith(MISSING_MARKER)) {
        markers.push({ path: fullPath, value: obj[key] });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        markers.push(...checkForMarkers(obj[key], fullPath));
      }
    }
    return markers;
  }

  const markers = checkForMarkers(reordered);
  const reorderedKeys = getAllKeys(reordered);

  console.log(`✅ Reordered result has ${reorderedKeys.size} keys`);
  console.log(`✅ Found ${markers.length} missing key markers`);

  if (markers.length > 0) {
    console.log('\nSample markers:');
    markers.slice(0, 3).forEach((m) => {
      console.log(`  - ${m.path}: "${m.value.substring(0, 60)}..."`);
    });
  }

  // Test writing
  const outputContent = JSON.stringify(reordered, null, 2) + '\n';
  const outputFile = path.join(LOCALES_DIR, 'fr', 'translation-reordered.json');

  fs.writeFileSync(outputFile, outputContent, 'utf8');
  console.log(`\n💾 Wrote reordered result to ${outputFile}`);
  console.log('🎉 Test completed successfully!');

  // Verify missing keys are properly marked
  if (markers.length === missingKeys.length) {
    console.log(`\n✅ PERFECT: All ${missingKeys.length} missing keys were marked correctly!`);
  } else {
    console.log(`\n⚠️  MISMATCH: Expected ${missingKeys.length} markers, found ${markers.length}`);
  }
}

// Run the test
testReordering();
