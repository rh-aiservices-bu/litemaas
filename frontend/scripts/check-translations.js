#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Translation Checker Script
 * Compares all translation files with English (source of truth) and identifies missing keys
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const SOURCE_LOCALE = 'en';

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
 * Compare translation with source and find missing keys
 * @param {Set} sourceKeys - Set of keys from source translation
 * @param {Set} targetKeys - Set of keys from target translation
 * @returns {Array} Array of missing keys
 */
function findMissingKeys(sourceKeys, targetKeys) {
  const missing = [];

  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      missing.push(key);
    }
  }

  return missing.sort();
}

/**
 * Format missing keys for display
 * @param {Array} missingKeys - Array of missing keys
 * @returns {string} Formatted string
 */
function formatMissingKeys(missingKeys) {
  if (missingKeys.length === 0) {
    return '  ✅ No missing keys - translation is complete!';
  }

  return missingKeys.map((key) => `  ❌ ${key}`).join('\n');
}

/**
 * Main function to check all translations
 */
function checkTranslations() {
  console.log('🔍 Translation Checker\n');
  console.log('='.repeat(60));

  // Read source translation
  console.log(`\n📖 Reading source translation (${SOURCE_LOCALE})...`);
  const sourceTranslation = readTranslationFile(SOURCE_LOCALE);

  if (!sourceTranslation) {
    console.error('❌ Failed to read source translation. Exiting.');
    process.exit(1);
  }

  const sourceKeys = getAllKeys(sourceTranslation);
  console.log(`✅ Found ${sourceKeys.size} keys in source translation`);

  // Get all available locales
  const locales = getAvailableLocales();
  const targetLocales = locales.filter((locale) => locale !== SOURCE_LOCALE);

  console.log(`\n📂 Found ${targetLocales.length} translation files to check:`);
  console.log(`   ${targetLocales.join(', ')}`);

  console.log('\n' + '='.repeat(60));
  console.log('📊 TRANSLATION ANALYSIS RESULTS');
  console.log('='.repeat(60));

  let totalMissing = 0;
  const results = [];

  // Check each target locale
  for (const locale of targetLocales) {
    const targetTranslation = readTranslationFile(locale);

    if (!targetTranslation) {
      results.push({
        locale,
        status: 'error',
        message: 'Failed to read translation file',
      });
      continue;
    }

    const targetKeys = getAllKeys(targetTranslation);
    const missingKeys = findMissingKeys(sourceKeys, targetKeys);
    const extraKeys = findMissingKeys(targetKeys, sourceKeys);

    totalMissing += missingKeys.length;

    results.push({
      locale,
      status: 'success',
      totalKeys: targetKeys.size,
      missingKeys,
      extraKeys,
      completeness: (((sourceKeys.size - missingKeys.length) / sourceKeys.size) * 100).toFixed(1),
    });
  }

  // Display results
  for (const result of results) {
    console.log(`\n🌍 ${result.locale.toUpperCase()} Translation:`);
    console.log('-'.repeat(40));

    if (result.status === 'error') {
      console.log(`  ❌ ${result.message}`);
      continue;
    }

    console.log(`  📈 Completeness: ${result.completeness}%`);
    console.log(`  📝 Total keys: ${result.totalKeys}/${sourceKeys.size}`);

    if (result.missingKeys.length > 0) {
      console.log(`\n  Missing keys (${result.missingKeys.length}):`);
      console.log(formatMissingKeys(result.missingKeys));
    } else {
      console.log('\n  ✅ No missing keys - translation is complete!');
    }

    if (result.extraKeys.length > 0) {
      console.log(`\n  ⚠️  Extra keys not in source (${result.extraKeys.length}):`);
      console.log(result.extraKeys.map((key) => `     ${key}`).join('\n'));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  const completeTranslations = results.filter(
    (r) => r.status === 'success' && r.missingKeys.length === 0,
  );

  console.log(`\n✅ Complete translations: ${completeTranslations.length}/${targetLocales.length}`);

  if (completeTranslations.length > 0) {
    console.log(`   ${completeTranslations.map((r) => r.locale.toUpperCase()).join(', ')}`);
  }

  const incompleteTranslations = results.filter(
    (r) => r.status === 'success' && r.missingKeys.length > 0,
  );

  if (incompleteTranslations.length > 0) {
    console.log(`\n⚠️  Incomplete translations: ${incompleteTranslations.length}`);
    for (const result of incompleteTranslations) {
      console.log(
        `   ${result.locale.toUpperCase()}: ${result.missingKeys.length} missing keys (${result.completeness}% complete)`,
      );
    }
  }

  if (totalMissing > 0) {
    console.log(`\n❌ Total missing keys across all translations: ${totalMissing}`);
  } else {
    console.log('\n🎉 All translations are complete!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Translation check complete!\n');

  // Exit with error code if there are missing translations
  process.exit(totalMissing > 0 ? 1 : 0);
}

// Run the checker
checkTranslations();
