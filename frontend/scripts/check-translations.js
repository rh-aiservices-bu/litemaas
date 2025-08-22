#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Enhanced Translation Checker Script
 *
 * Features:
 * - Detects and fixes duplicate keys
 * - Reorders keys to match English source structure
 * - Handles missing keys with configurable strategies
 * - Identifies marked translations that need work
 * - Creates backups before making changes
 * - Supports dry-run mode
 *
 * Usage:
 *   npm run check:translations                                    # Check only (current behavior)
 *   npm run check:translations -- --fix-duplicates              # Fix duplicate keys
 *   npm run check:translations -- --reorder                     # Reorder keys to match English
 *   npm run check:translations -- --missing-strategy=mark       # Add missing keys with markers
 *   npm run check:translations -- --locales=fr,es,de           # Target specific locales
 *   npm run check:translations -- --dry-run                     # Preview changes without applying
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const SOURCE_LOCALE = 'en';

// Translation markers
const MISSING_MARKER = '🔴 MISSING TRANSLATION - PLEASE TRANSLATE: ';
const UNTRANSLATED_MARKER = '⚠️ UNTRANSLATED: ';

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fixDuplicates: false,
    duplicateStrategy: 'first', // 'first' or 'last'
    reorder: false,
    missingStrategy: 'skip', // 'skip', 'mark', 'copy'
    locales: null, // null = all locales, or array of specific locales
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
    } else if (arg === '--include-marked') {
      options.includeMarked = true;
    } else if (arg === '--clean-markers') {
      options.cleanMarkers = true;
    } else if (arg === '--no-backup') {
      options.noBackup = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
🔍 Enhanced Translation Checker

USAGE:
  npm run check:translations [options]

OPTIONS:
  --fix-duplicates                    Fix duplicate keys in translation files
  --strategy=first|last              Duplicate resolution strategy (default: first)
  --reorder                          Reorder keys to match English structure
  --missing-strategy=skip|mark|copy   How to handle missing keys (default: skip)
                                     'mark': Add with translation markers
                                     'copy': Copy English text as placeholder
                                     Works independently or with --reorder
  --locales=fr,es,de                 Target specific locales (default: all)
  --dry-run                          Show what would be changed without applying
  --include-marked                   Include marked translations as missing
  --clean-markers                    Remove translation markers from completed translations
  --no-backup                        Skip creating backup files (relies on git versioning)
  --verbose, -v                      Show detailed information
  --help, -h                         Show this help

DUPLICATE HANDLING:
  📄 Leaf key duplicates: Resolved based on strategy (first/last)
  🏗️  Object key duplicates: Properties merged correctly (conflicts resolved by strategy)

EXAMPLES:
  # Check only (backward compatible)
  npm run check:translations

  # Fix all duplicates keeping first occurrence
  npm run check:translations -- --fix-duplicates --strategy=first

  # Add missing keys with markers (preserves existing key order)
  npm run check:translations -- --missing-strategy=mark --no-backup

  # Add missing keys with markers AND reorder to match English
  npm run check:translations -- --reorder --missing-strategy=mark --no-backup

  # Fix everything in French and Spanish only
  npm run check:translations -- --fix-duplicates --reorder --locales=fr,es

  # Preview changes without applying them
  npm run check:translations -- --fix-duplicates --reorder --dry-run
`);
}

/**
 * Find duplicate keys in raw JSON text
 * @param {string} jsonText - Raw JSON content
 * @returns {Array} Array of duplicate information
 */
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
          type: keyType, // Use the type of the duplicate occurrence for processing
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

/**
 * Clean duplicate keys from raw JSON text with proper object merging
 * @param {string} jsonText - Raw JSON content
 * @param {Array} duplicates - Array of duplicate information
 * @param {string} strategy - 'first' or 'last' (applies only to leaf keys)
 * @returns {string} Cleaned JSON text
 */
function cleanDuplicates(jsonText, duplicates, strategy) {
  if (duplicates.length === 0) return jsonText;

  try {
    // Parse with custom logic that handles merging
    const result = parseAndMergeDuplicates(jsonText, duplicates, strategy);
    return JSON.stringify(result, null, 2) + '\n';
  } catch (error) {
    console.error('Error cleaning duplicates:', error.message);
    return jsonText;
  }
}

/**
 * Parse JSON with custom duplicate handling that merges objects and applies strategy to leaf keys
 * @param {string} jsonText - Raw JSON content
 * @param {Array} duplicates - Array of duplicate information
 * @param {string} strategy - Strategy for leaf duplicates ('first' or 'last')
 * @returns {Object} Parsed and cleaned object
 */
function parseAndMergeDuplicates(jsonText, duplicates, strategy) {
  // For 'last' strategy (default JSON.parse behavior), just parse normally
  if (strategy === 'last') {
    return JSON.parse(jsonText);
  }

  // For 'first' strategy with leaf duplicates, we need special handling
  const leafDuplicates = duplicates.filter((dup) => dup.type === 'leaf');
  if (leafDuplicates.length > 0) {
    // Use line-based approach for leaf duplicates with 'first' strategy
    return JSON.parse(cleanDuplicatesFromParsedObject(jsonText, leafDuplicates));
  }

  // If no leaf duplicates, JSON.parse handles everything correctly
  return JSON.parse(jsonText);
}

/**
 * Clean duplicates by keeping first occurrence
 * @param {string} jsonText - Raw JSON content
 * @param {Array} duplicates - Array of duplicate information
 * @returns {string} Cleaned JSON text
 */
function cleanDuplicatesFromParsedObject(jsonText, duplicates) {
  const lines = jsonText.split('\n');
  const linesToRemove = new Set();

  // For 'first' strategy, remove the duplicate (later) lines
  duplicates.forEach((dup) => {
    linesToRemove.add(dup.duplicateLine - 1); // Convert to 0-based index
  });

  // Remove the lines and handle comma issues
  const cleanedLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (linesToRemove.has(i)) {
      // Skip this line, but check if we need to handle comma
      const prevLine = i > 0 ? lines[i - 1] : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

      // If the line we're removing ends with comma, and the next line doesn't start with comma or brace,
      // we might need to add a comma to the previous line
      if (
        lines[i].trim().endsWith(',') &&
        !nextLine.trim().startsWith('}') &&
        !nextLine.trim().startsWith(']')
      ) {
        // Ensure previous line has comma if it doesn't already
        if (
          prevLine.trim() &&
          !prevLine.trim().endsWith(',') &&
          !prevLine.trim().endsWith('{') &&
          !prevLine.trim().endsWith('[')
        ) {
          cleanedLines[cleanedLines.length - 1] = cleanedLines[cleanedLines.length - 1].replace(
            /\s*$/,
            ',',
          );
        }
      }
      continue;
    }

    cleanedLines.push(lines[i]);
  }

  // Validate the result by attempting to parse it
  const result = cleanedLines.join('\n');
  try {
    JSON.parse(result);
    return result;
  } catch (error) {
    // If validation fails, fall back to re-parsing the original and stringify
    console.warn('Cleaned JSON is invalid, falling back to re-stringify approach');
    const parsed = JSON.parse(jsonText);
    return JSON.stringify(parsed, null, 2) + '\n';
  }
}

/**
 * Recursively get all keys from a nested object
 * @param {Object} obj - The object to extract keys from
 * @param {string} prefix - Current key prefix for nested keys
 * @returns {Set} Set of all keys in dot notation
 */
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

/**
 * Get value by dot-notation path
 * @param {Object} obj - Object to search in
 * @param {string} path - Dot-notation path
 * @returns {*} Value at path or undefined
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Check if a translation value contains markers
 * @param {string} value - Translation value to check
 * @returns {boolean} True if value contains translation markers
 */
function hasTranslationMarker(value) {
  if (typeof value !== 'string') return false;
  return value.startsWith(MISSING_MARKER) || value.startsWith(UNTRANSLATED_MARKER);
}

/**
 * Find missing and marked keys
 * @param {Set} sourceKeys - Keys from source translation
 * @param {Object} targetTranslation - Target translation object
 * @param {boolean} includeMarked - Whether to include marked translations as missing
 * @returns {Object} Object with missing and marked arrays
 */
function findMissingKeys(sourceKeys, targetTranslation, includeMarked = false) {
  const missing = [];
  const marked = [];

  for (const key of sourceKeys) {
    const value = getValueByPath(targetTranslation, key);

    if (value === undefined) {
      missing.push({ key, status: 'missing' });
    } else if (typeof value === 'string' && hasTranslationMarker(value)) {
      marked.push({ key, status: 'marked', value });
      if (includeMarked) {
        missing.push({ key, status: 'marked' });
      }
    }
  }

  return { missing, marked };
}

/**
 * Reorder keys to match source structure and handle missing keys
 * @param {Object} target - Target translation object
 * @param {Object} source - Source translation object
 * @param {Object} sourceTranslation - Full source translation for reference
 * @param {string} missingStrategy - Strategy for handling missing keys
 * @param {string} pathPrefix - Current path prefix for nested objects
 * @returns {Object} Reordered object
 */
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

/**
 * Add missing keys to target translation without reordering existing keys
 * @param {Object} target - Target translation object
 * @param {Object} source - Source translation object
 * @param {string} missingStrategy - Strategy for handling missing keys
 * @param {string} pathPrefix - Current path prefix for nested objects
 * @returns {Object} Target object with missing keys added
 */
function addMissingKeys(target, source, missingStrategy, pathPrefix = '') {
  if (missingStrategy === 'skip') {
    return target;
  }

  const result = { ...target };

  // Go through all keys in source to find missing ones
  for (const key in source) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (!(key in result)) {
      // Key is missing, add it based on strategy
      if (missingStrategy === 'mark') {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          // For nested objects, recursively create structure with markers
          result[key] = addMissingKeys({}, source[key], missingStrategy, currentPath);
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
    } else if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      // Key exists and both are objects, recursively check nested keys
      result[key] = addMissingKeys(result[key], source[key], missingStrategy, currentPath);
    }
  }

  return result;
}

/**
 * Create a timestamped backup of a file
 * @param {string} filePath - Path to file to backup
 * @returns {string} Path to backup file
 */
function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupPath = `${filePath}.backup.${timestamp}`;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(backupPath, content, 'utf8');
    return backupPath;
  } catch (error) {
    console.error(`Failed to create backup: ${error.message}`);
    return null;
  }
}

/**
 * Format JSON with consistent indentation
 * @param {Object} obj - Object to format
 * @returns {string} Formatted JSON string
 */
function formatJSON(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

/**
 * Write translation file with proper error handling
 * @param {string} locale - Locale code
 * @param {Object} translation - Translation object to write
 * @param {boolean} dryRun - Whether this is a dry run
 * @param {boolean} noBackup - Whether to skip backup creation
 * @returns {boolean} True if successful
 */
function writeTranslationFile(locale, translation, dryRun = false, noBackup = false) {
  const filePath = path.join(LOCALES_DIR, locale, 'translation.json');

  if (dryRun) {
    console.log(`  [DRY RUN] Would write ${locale} translation${noBackup ? ' (no backup)' : ''}`);
    return true;
  }

  try {
    const content = formatJSON(translation);

    // Create backup before writing (unless disabled)
    let backupPath = null;
    if (!noBackup) {
      backupPath = createBackup(filePath);
      if (!backupPath) {
        console.error(`  ❌ Failed to create backup for ${locale}`);
        return false;
      }
    }

    // Write to temporary file first, then rename (atomic operation)
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);

    if (noBackup) {
      console.log(`  ✅ Updated ${locale} (no backup - using git versioning)`);
    } else {
      console.log(`  ✅ Updated ${locale} (backup: ${path.basename(backupPath)})`);
    }
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to write ${locale}: ${error.message}`);
    return false;
  }
}

/**
 * Read and parse a JSON translation file
 * @param {string} locale - The locale code
 * @returns {Object|null} Parsed JSON object or null if error
 */
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

/**
 * Read raw JSON content from translation file
 * @param {string} locale - The locale code
 * @returns {string|null} Raw JSON content or null if error
 */
function readRawTranslationFile(locale) {
  const filePath = path.join(LOCALES_DIR, locale, 'translation.json');

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading raw ${locale} translation file:`, error.message);
    return null;
  }
}

/**
 * Get all available locales by reading directory structure
 * @returns {Array} Array of locale codes
 */
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

/**
 * Main function to check and fix translations
 * @param {Object} options - Parsed command line options
 */
function runTranslationChecker(options) {
  console.log('🔍 Enhanced Translation Checker\n');
  console.log('='.repeat(70));

  // Read source translation
  console.log(`\n📖 Reading source translation (${SOURCE_LOCALE})...`);
  const sourceTranslation = readTranslationFile(SOURCE_LOCALE);
  const sourceRaw = readRawTranslationFile(SOURCE_LOCALE);

  if (!sourceTranslation || !sourceRaw) {
    console.error('❌ Failed to read source translation. Exiting.');
    process.exit(1);
  }

  const sourceKeys = getAllKeys(sourceTranslation);
  console.log(`✅ Found ${sourceKeys.size} keys in source translation`);

  // Check for duplicates in source
  const sourceDuplicates = findDuplicatesInRawJSON(sourceRaw);
  if (sourceDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${sourceDuplicates.length} duplicate keys in source translation:`);

    // Group by type for better reporting
    const leafDuplicates = sourceDuplicates.filter((d) => d.type === 'leaf');
    const objectDuplicates = sourceDuplicates.filter((d) => d.type === 'object');

    if (leafDuplicates.length > 0) {
      console.log(`  📄 Leaf key duplicates (${leafDuplicates.length}):`);
      leafDuplicates.forEach((dup) => {
        console.log(`    • "${dup.key}" at lines ${dup.firstLine} and ${dup.duplicateLine}`);
        if (options.verbose) {
          console.log(`      First: ${dup.firstValue.substring(0, 50)}...`);
          console.log(`      Duplicate: ${dup.duplicateValue.substring(0, 50)}...`);
        }
      });
    }

    if (objectDuplicates.length > 0) {
      console.log(
        `  🏗️  Object key duplicates (${objectDuplicates.length}) - properties will be merged:`,
      );
      objectDuplicates.forEach((dup) => {
        console.log(`    • "${dup.key}" at lines ${dup.firstLine} and ${dup.duplicateLine}`);
        if (options.verbose) {
          console.log(`      First: ${dup.firstValue.substring(0, 50)}...`);
          console.log(`      Duplicate: ${dup.duplicateValue.substring(0, 50)}...`);
        }
      });
    }
  }

  // Get target locales
  const allLocales = getAvailableLocales();
  const targetLocales = options.locales
    ? options.locales.filter((locale) => allLocales.includes(locale))
    : allLocales.filter((locale) => locale !== SOURCE_LOCALE);

  if (options.locales && options.locales.length !== targetLocales.length) {
    const missing = options.locales.filter((locale) => !allLocales.includes(locale));
    console.log(`⚠️  Some specified locales not found: ${missing.join(', ')}`);
  }

  console.log(`\n📂 Processing ${targetLocales.length} translation files:`);
  console.log(`   ${targetLocales.join(', ')}`);

  // Process source duplicates first if requested
  let processedSource = false;
  if (options.fixDuplicates && sourceDuplicates.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('🔧 FIXING SOURCE DUPLICATES');
    console.log(`${'='.repeat(70)}`);

    const cleanedSource = cleanDuplicates(sourceRaw, sourceDuplicates, options.duplicateStrategy);

    if (
      writeTranslationFile(
        SOURCE_LOCALE,
        JSON.parse(cleanedSource),
        options.dryRun,
        options.noBackup,
      )
    ) {
      processedSource = true;
      console.log(`✅ Fixed ${sourceDuplicates.length} duplicate keys in ${SOURCE_LOCALE}`);

      // Re-read the cleaned source if not in dry run mode
      if (!options.dryRun) {
        Object.assign(sourceTranslation, JSON.parse(cleanedSource));
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 TRANSLATION ANALYSIS RESULTS');
  console.log(`${'='.repeat(70)}`);

  let totalMissing = 0;
  let totalMarked = 0;
  let filesChanged = 0;
  const results = [];

  // Process each target locale
  for (const locale of targetLocales) {
    const targetTranslation = readTranslationFile(locale);
    const targetRaw = readRawTranslationFile(locale);

    if (!targetTranslation || !targetRaw) {
      results.push({
        locale,
        status: 'error',
        message: 'Failed to read translation file',
      });
      continue;
    }

    // Find duplicates in target
    const targetDuplicates = findDuplicatesInRawJSON(targetRaw);

    // Find missing and marked keys
    const { missing, marked } = findMissingKeys(
      sourceKeys,
      targetTranslation,
      options.includeMarked,
    );
    const targetKeys = getAllKeys(targetTranslation);
    const extraKeys = [];

    // Find extra keys
    for (const key of targetKeys) {
      if (!sourceKeys.has(key)) {
        extraKeys.push(key);
      }
    }

    totalMissing += missing.length;
    totalMarked += marked.length;

    let modified = false;
    let workingTranslation = { ...targetTranslation };
    let workingRaw = targetRaw;

    // Fix duplicates if requested
    if (options.fixDuplicates && targetDuplicates.length > 0) {
      workingRaw = cleanDuplicates(workingRaw, targetDuplicates, options.duplicateStrategy);
      workingTranslation = JSON.parse(workingRaw);
      modified = true;
    }

    // Add missing keys if requested (independent of reordering)
    if (!options.reorder && options.missingStrategy !== 'skip') {
      workingTranslation = addMissingKeys(
        workingTranslation,
        sourceTranslation,
        options.missingStrategy,
      );
      modified = true;
    }

    // Reorder keys if requested
    if (options.reorder) {
      workingTranslation = reorderKeys(
        workingTranslation,
        sourceTranslation,
        sourceTranslation,
        options.missingStrategy,
      );
      modified = true;
    }

    // Write changes if any were made
    if (modified) {
      if (writeTranslationFile(locale, workingTranslation, options.dryRun, options.noBackup)) {
        filesChanged++;
      }
    }

    // Recalculate statistics after modifications
    const finalKeys = getAllKeys(workingTranslation);
    const finalMissing = findMissingKeys(sourceKeys, workingTranslation, options.includeMarked);

    results.push({
      locale,
      status: 'success',
      totalKeys: finalKeys.size,
      missingKeys: finalMissing.missing,
      markedKeys: finalMissing.marked,
      extraKeys,
      duplicates: targetDuplicates,
      modified,
      completeness: (
        ((sourceKeys.size - finalMissing.missing.length) / sourceKeys.size) *
        100
      ).toFixed(1),
    });
  }

  // Display results
  for (const result of results) {
    console.log(`\n🌍 ${result.locale.toUpperCase()} Translation:`);
    console.log('-'.repeat(50));

    if (result.status === 'error') {
      console.log(`  ❌ ${result.message}`);
      continue;
    }

    console.log(`  📈 Completeness: ${result.completeness}%`);
    console.log(`  📝 Total keys: ${result.totalKeys}/${sourceKeys.size}`);

    // Show duplicates
    if (result.duplicates.length > 0) {
      console.log(`  🔴 Duplicate keys: ${result.duplicates.length}`);
      if (options.verbose) {
        result.duplicates.forEach((dup) => {
          console.log(`     • "${dup.key}" at lines ${dup.firstLine}, ${dup.duplicateLine}`);
        });
      }
    }

    // Show missing keys
    if (result.missingKeys.length > 0) {
      console.log(`  ❌ Missing keys: ${result.missingKeys.length}`);
      if (options.verbose) {
        result.missingKeys.slice(0, 5).forEach((key) => {
          console.log(`     • ${key.key}`);
        });
        if (result.missingKeys.length > 5) {
          console.log(`     • ... and ${result.missingKeys.length - 5} more`);
        }
      }
    }

    // Show marked keys
    if (result.markedKeys.length > 0) {
      console.log(`  ⚠️  Marked for translation: ${result.markedKeys.length}`);
      if (options.verbose) {
        result.markedKeys.slice(0, 3).forEach((key) => {
          console.log(`     • ${key.key}: ${key.value.substring(0, 60)}...`);
        });
        if (result.markedKeys.length > 3) {
          console.log(`     • ... and ${result.markedKeys.length - 3} more`);
        }
      }
    }

    // Show extra keys
    if (result.extraKeys.length > 0) {
      console.log(`  ➕ Extra keys: ${result.extraKeys.length}`);
      if (options.verbose) {
        result.extraKeys.slice(0, 3).forEach((key) => {
          console.log(`     • ${key}`);
        });
        if (result.extraKeys.length > 3) {
          console.log(`     • ... and ${result.extraKeys.length - 3} more`);
        }
      }
    }

    if (result.modified) {
      console.log(`  ✏️  Modified: ${options.dryRun ? 'Would be updated' : 'Updated'}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(70)}`);

  const completeTranslations = results.filter(
    (r) => r.status === 'success' && r.missingKeys.length === 0 && r.markedKeys.length === 0,
  );

  console.log(`\n✅ Complete translations: ${completeTranslations.length}/${targetLocales.length}`);
  if (completeTranslations.length > 0) {
    console.log(`   ${completeTranslations.map((r) => r.locale.toUpperCase()).join(', ')}`);
  }

  if (totalMissing > 0) {
    console.log(`\n❌ Total missing keys: ${totalMissing}`);
  }

  if (totalMarked > 0) {
    console.log(`\n⚠️  Total marked keys: ${totalMarked}`);
  }

  if (processedSource || filesChanged > 0) {
    console.log(
      `\n🔧 Files ${options.dryRun ? 'that would be' : ''} modified: ${(processedSource ? 1 : 0) + filesChanged}`,
    );
  }

  // Next steps
  if (
    totalMarked > 0 ||
    (options.missingStrategy === 'mark' && (options.reorder || options.fixDuplicates))
  ) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('⚠️  NEXT STEPS');
    console.log(`${'='.repeat(70)}`);
    console.log('\n  1. Search for translation markers in files:');
    console.log(`     grep -r "${MISSING_MARKER}" src/i18n/locales/`);
    console.log(`     grep -r "${UNTRANSLATED_MARKER}" src/i18n/locales/`);
    console.log('\n  2. Translate the marked strings');
    console.log('\n  3. Run the checker again to verify completeness');
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✨ Translation check complete!\n');

  // Exit codes
  const hasIssues = totalMissing > 0 || totalMarked > 0 || sourceDuplicates.length > 0;
  process.exit(hasIssues ? 1 : 0);
}

// Main execution
const options = parseArgs();
runTranslationChecker(options);
