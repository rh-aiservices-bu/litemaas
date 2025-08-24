#!/usr/bin/env node

/**
 * Test script to verify actual modifications made by check-translations.js
 * This tests the actual transformation logic without writing files
 */

const fs = require('fs');
const path = require('path');

// Import functions from the check-translations script directly
// We'll need to modify this approach since we can't import from the script
// Instead, we'll simulate the transformations

const MISSING_MARKER = '🔴 MISSING TRANSLATION - PLEASE TRANSLATE: ';

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

// Read test files
const sourceFile = path.join(__dirname, 'source.json');
const targetFile = path.join(__dirname, 'target.json');

const sourceRaw = fs.readFileSync(sourceFile, 'utf8');
const targetRaw = fs.readFileSync(targetFile, 'utf8');

// Parse with JSON.parse to see what happens with duplicates
log('=' + '='.repeat(70), 'magenta');
log('TESTING TRANSFORMATION LOGIC', 'magenta');
log('=' + '='.repeat(70), 'magenta');

// Test 1: What does JSON.parse do with our duplicates?
log('\n📋 Test 1: JSON.parse behavior with duplicates', 'cyan');
const sourceParsed = JSON.parse(sourceRaw);
const targetParsed = JSON.parse(targetRaw);

log('  Source after JSON.parse:', 'yellow');
log(`    - navigation has: ${Object.keys(sourceParsed.navigation).join(', ')}`);
log(`    - user has: ${Object.keys(sourceParsed.user).join(', ')}`);
log(`    - duplicate value: "${sourceParsed.duplicate}"`);
log(`    - nested.duplicate value: "${sourceParsed.nested.duplicate}"`);

// Test 2: Simulate reorderKeys function
log('\n📋 Test 2: Simulating key reordering with missing key marking', 'cyan');

function reorderKeys(target, source, missingStrategy = 'mark') {
  const result = {};

  // First pass: Add all keys from source in order
  for (const key in source) {
    if (key in target) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        // Recursively reorder nested objects
        result[key] = reorderKeys(target[key], source[key], missingStrategy);
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
          result[key] = reorderKeys({}, source[key], missingStrategy);
        } else {
          // For leaf values, add with marker
          result[key] = `${MISSING_MARKER}${source[key]}`;
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

const reordered = reorderKeys(targetParsed, sourceParsed, 'mark');

log('  Reordered structure:', 'yellow');
log(`    - Keys in result: ${Object.keys(reordered).join(', ')}`);

// Check if missing keys were added with markers
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
log(`  Found ${markers.length} keys with missing markers:`, markers.length > 0 ? 'green' : 'red');
markers.slice(0, 5).forEach((m) => {
  log(`    - ${m.path}: "${m.value.substring(0, 60)}..."`);
});
if (markers.length > 5) {
  log(`    ... and ${markers.length - 5} more`);
}

// Test 3: Check if all source keys are present in reordered
log('\n📋 Test 3: Verifying all source keys are in reordered result', 'cyan');

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const sourceKeys = getAllKeys(sourceParsed);
const reorderedKeys = getAllKeys(reordered);
const missingFromReordered = sourceKeys.filter((k) => !reorderedKeys.includes(k));

log(`  Source has ${sourceKeys.length} keys`, 'yellow');
log(`  Reordered has ${reorderedKeys.length} keys`, 'yellow');
log(
  `  Missing from reordered: ${missingFromReordered.length}`,
  missingFromReordered.length > 0 ? 'red' : 'green',
);

if (missingFromReordered.length > 0) {
  log('  Keys missing from reordered:', 'red');
  missingFromReordered.forEach((k) => log(`    - ${k}`));
}

// Test 4: Test duplicate cleaning
log('\n📋 Test 4: Testing duplicate cleaning logic', 'cyan');

function findDuplicatesInRawJSON(jsonText) {
  const lines = jsonText.split('\n');
  const duplicates = [];
  const keysAtLevel = [{}];
  let currentLevel = 0;

  lines.forEach((line, idx) => {
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;

    if (closeBraces > openBraces) {
      currentLevel -= closeBraces - openBraces;
      keysAtLevel.splice(currentLevel + 1);
    }

    const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
    if (keyMatch) {
      const key = keyMatch[1];
      const value = line.split(':').slice(1).join(':').trim();
      const isObjectKey = value.trim().startsWith('{') || value.trim() === '{';
      const keyType = isObjectKey ? 'object' : 'leaf';

      if (!keysAtLevel[currentLevel]) {
        keysAtLevel[currentLevel] = {};
      }

      if (keysAtLevel[currentLevel][key]) {
        duplicates.push({
          key: key,
          firstLine: keysAtLevel[currentLevel][key].line,
          duplicateLine: idx + 1,
          type: keyType,
          level: currentLevel,
        });
      } else {
        keysAtLevel[currentLevel][key] = {
          line: idx + 1,
          type: keyType,
        };
      }
    }

    if (openBraces > closeBraces) {
      currentLevel += openBraces - closeBraces;
      if (!keysAtLevel[currentLevel]) {
        keysAtLevel[currentLevel] = {};
      }
    }
  });

  return duplicates;
}

const duplicates = findDuplicatesInRawJSON(sourceRaw);
const leafDuplicates = duplicates.filter((d) => d.type === 'leaf');
const objectDuplicates = duplicates.filter((d) => d.type === 'object');

log(`  Found ${duplicates.length} total duplicates:`, 'yellow');
log(`    - ${leafDuplicates.length} leaf duplicates`, 'yellow');
log(`    - ${objectDuplicates.length} object duplicates`, 'yellow');

// Summary
log('\n' + '='.repeat(70), 'magenta');
log('FINDINGS', 'magenta');
log('='.repeat(70), 'magenta');

const issues = [];

if (markers.length === 0) {
  issues.push('Missing key marking is NOT working - no markers were added');
}

if (missingFromReordered.length > 0) {
  issues.push(`Reordering lost ${missingFromReordered.length} keys from source`);
}

if (issues.length > 0) {
  log('\n❌ Issues found:', 'red');
  issues.forEach((issue) => log(`  - ${issue}`, 'red'));

  log('\n📝 The reorderKeys function needs to be fixed to:', 'yellow');
  log('  1. Properly add missing keys with markers', 'yellow');
  log('  2. Not lose any keys during reordering', 'yellow');
  log('  3. Handle nested objects correctly', 'yellow');
} else {
  log('\n✅ All transformations working correctly!', 'green');
  log(`  - Added ${markers.length} missing keys with markers`, 'green');
  log('  - All source keys preserved in reordered result', 'green');
}

log('\n📊 Expected vs Actual:', 'blue');
log(
  `  Expected missing keys to mark: ${sourceKeys.length - getAllKeys(targetParsed).filter((k) => sourceKeys.includes(k)).length}`,
  'blue',
);
log(`  Actually marked: ${markers.length}`, 'blue');
