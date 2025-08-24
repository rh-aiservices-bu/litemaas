#!/usr/bin/env node

/**
 * Test script to verify that --missing-strategy works independently of --reorder
 */

const fs = require('fs');
const path = require('path');

// Test directory setup
const testLocalesDir = path.join(__dirname, 'test-locales');
const sourceFile = path.join(testLocalesDir, 'en/translation.json');
const targetFile = path.join(testLocalesDir, 'fr/translation.json');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Import the functions we need from the main script
const MISSING_MARKER = '🔴 MISSING TRANSLATION - PLEASE TRANSLATE: ';

function getAllKeys(obj, prefix = '') {
  const keys = new Set();

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const nestedKeys = getAllKeys(obj[key], fullKey);
      nestedKeys.forEach((k) => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

function addMissingKeys(target, source, missingStrategy, pathPrefix = '') {
  if (missingStrategy === 'skip') {
    return target;
  }

  const result = { ...target };

  for (const key in source) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (!(key in result)) {
      if (missingStrategy === 'mark') {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = addMissingKeys({}, source[key], missingStrategy, currentPath);
        } else {
          result[key] = `${MISSING_MARKER}${source[key]}`;
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
      result[key] = addMissingKeys(result[key], source[key], missingStrategy, currentPath);
    }
  }

  return result;
}

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

// Test function
function testIndependentMissingKeys() {
  log('=' + '='.repeat(70), 'magenta');
  log('TESTING INDEPENDENT MISSING KEY MARKING', 'magenta');
  log('=' + '='.repeat(70), 'magenta');

  // Read test files
  const sourceTranslation = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const targetTranslation = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

  const sourceKeys = getAllKeys(sourceTranslation);
  const targetKeys = getAllKeys(targetTranslation);
  const missingKeys = [...sourceKeys].filter((key) => !targetKeys.has(key));

  log(`\n📊 Analysis:`, 'blue');
  log(`  - Source has ${sourceKeys.size} keys`);
  log(`  - Target has ${targetKeys.size} keys`);
  log(`  - Missing in target: ${missingKeys.length} keys`);

  // Test 1: addMissingKeys function (preserves order)
  log(`\n🧪 Test 1: addMissingKeys function (preserves order)`, 'cyan');
  const resultWithMissingOnly = addMissingKeys(targetTranslation, sourceTranslation, 'mark');

  const targetKeyOrder = Object.keys(targetTranslation);
  const resultKeyOrder = Object.keys(resultWithMissingOnly);

  // Check if the first few keys are in the same order
  const orderPreserved = targetKeyOrder.every(
    (key, index) => index < resultKeyOrder.length && resultKeyOrder[index] === key,
  );

  log(`  - Original key order preserved: ${orderPreserved ? '✅' : '❌'}`);
  log(`  - Keys in result: ${Object.keys(resultWithMissingOnly).length}`);

  const markers = checkForMarkers(resultWithMissingOnly);
  log(`  - Missing key markers added: ${markers.length}`);

  if (markers.length > 0) {
    log('  - Sample markers:', 'yellow');
    markers.slice(0, 3).forEach((m) => {
      log(`    • ${m.path}: "${m.value.substring(0, 50)}..."`);
    });
  }

  // Test 2: Write result and verify
  log(`\n🧪 Test 2: Verify all missing keys are marked`, 'cyan');
  const resultKeys = getAllKeys(resultWithMissingOnly);
  const stillMissingKeys = [...sourceKeys].filter((key) => !resultKeys.has(key));

  log(`  - Keys in result: ${resultKeys.size}`);
  log(`  - Still missing after addMissingKeys: ${stillMissingKeys.length}`);

  if (stillMissingKeys.length === 0) {
    log(`  ✅ All missing keys were added!`, 'green');
  } else {
    log(`  ❌ Some keys still missing: ${stillMissingKeys.join(', ')}`, 'red');
  }

  // Test 3: Verify markers count matches expected
  log(`\n🧪 Test 3: Verify marker count`, 'cyan');
  log(`  - Expected markers: ${missingKeys.length}`);
  log(`  - Actual markers: ${markers.length}`);

  if (markers.length === missingKeys.length) {
    log(`  ✅ Perfect match!`, 'green');
  } else {
    log(`  ⚠️  Mismatch in marker count`, 'yellow');
  }

  // Test 4: Save result for manual inspection
  const outputFile = path.join(__dirname, 'test-locales/fr/translation-with-missing-keys.json');
  fs.writeFileSync(outputFile, JSON.stringify(resultWithMissingOnly, null, 2) + '\n');
  log(`\n💾 Result saved to: ${path.basename(outputFile)}`, 'blue');

  // Summary
  log(`\n${'='.repeat(70)}`, 'magenta');
  log('SUMMARY', 'magenta');
  log(`${'='.repeat(70)}`, 'magenta');

  const allTestsPassed =
    orderPreserved && stillMissingKeys.length === 0 && markers.length === missingKeys.length;

  if (allTestsPassed) {
    log(`\n✅ ALL TESTS PASSED!`, 'green');
    log(`The addMissingKeys function works correctly and independently of reordering.`, 'green');
  } else {
    log(`\n❌ Some tests failed.`, 'red');
    log(`The function may need additional fixes.`, 'red');
  }

  return allTestsPassed;
}

// Run the test
const success = testIndependentMissingKeys();
process.exit(success ? 0 : 1);
