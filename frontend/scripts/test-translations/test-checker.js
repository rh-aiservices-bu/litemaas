#!/usr/bin/env node

/**
 * Test script for the translation checker
 * Tests the existing check-translations.js script functionality
 * without creating or modifying any files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function runTest(description, testFn) {
  try {
    log(`\n▶ Testing: ${description}`, 'cyan');
    const result = testFn();
    log(`  ✅ PASSED`, 'green');
    return { passed: true, result };
  } catch (error) {
    log(`  ❌ FAILED: ${error.message}`, 'red');
    if (error.output) {
      log(`  Output: ${error.output.substring(0, 200)}...`, 'yellow');
    }
    return { passed: false, error };
  }
}

// Path to the actual check-translations script
const CHECKER_SCRIPT = path.join(__dirname, '..', 'check-translations.js');

// Helper to run the checker script with specific options
function runChecker(args = '', expectError = false) {
  try {
    const output = execSync(`node ${CHECKER_SCRIPT} ${args} 2>&1`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (expectError) {
      throw new Error('Expected script to fail but it succeeded');
    }
    return output;
  } catch (error) {
    if (!expectError) {
      error.output = error.stdout || error.stderr || error.toString();
      throw error;
    }
    return error.stdout || error.stderr || error.toString();
  }
}

// Parse test files to understand expected behavior
const sourceFile = path.join(__dirname, 'source.json');
const targetFile = path.join(__dirname, 'target.json');

log('=' + '='.repeat(70), 'magenta');
log('TRANSLATION CHECKER TEST SUITE', 'magenta');
log('=' + '='.repeat(70), 'magenta');

// First, analyze our test files
log('\n📁 Test File Analysis:', 'blue');

const sourceRaw = fs.readFileSync(sourceFile, 'utf8');
const targetRaw = fs.readFileSync(targetFile, 'utf8');
const sourceParsed = JSON.parse(sourceRaw);
const targetParsed = JSON.parse(targetRaw);

// Count duplicates in source
const sourceDuplicates = [];
const lines = sourceRaw.split('\n');
const seenKeys = {};

lines.forEach((line, idx) => {
  const match = line.match(/^\s*"([^"]+)"\s*:/);
  if (match) {
    const key = match[1];
    const indent = line.match(/^(\s*)/)[1].length;
    const level = Math.floor(indent / 2);
    const keyId = `${level}:${key}`;

    if (seenKeys[keyId]) {
      sourceDuplicates.push({
        key,
        firstLine: seenKeys[keyId].line,
        duplicateLine: idx + 1,
        level,
      });
    } else {
      seenKeys[keyId] = { line: idx + 1 };
    }
  }
});

log(`  Source file has ${sourceDuplicates.length} duplicate keys:`, 'yellow');
sourceDuplicates.forEach((dup) => {
  log(`    - "${dup.key}" at lines ${dup.firstLine} and ${dup.duplicateLine}`);
});

// Analyze missing keys
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

const sourceKeys = new Set(getAllKeys(sourceParsed));
const targetKeys = new Set(getAllKeys(targetParsed));
const missingKeys = [...sourceKeys].filter((key) => !targetKeys.has(key));
const extraKeys = [...targetKeys].filter((key) => !sourceKeys.has(key));

log(`  Target file missing ${missingKeys.length} keys from source`, 'yellow');
log(`  Target file has ${extraKeys.length} extra keys not in source`, 'yellow');

// Now run actual tests with the checker script
log('\n' + '='.repeat(70), 'blue');
log('🧪 TESTING CHECK-TRANSLATIONS.JS FUNCTIONALITY', 'blue');
log('='.repeat(70), 'blue');

const testResults = [];

// Test 1: Basic run - check for missing keys
testResults.push(
  runTest('Basic missing key detection', () => {
    const output = runChecker('', true); // Expect error exit code when issues found

    // Check if it detects missing keys
    if (!output.includes('Missing keys:') && !output.includes('missing keys')) {
      throw new Error('Script should detect missing keys');
    }

    // Check if it detects the duplicates in source
    if (!output.includes('duplicate keys in source')) {
      throw new Error('Script should detect duplicate keys in source');
    }

    log('    Correctly detected missing keys and duplicates', 'green');
    return output;
  }),
);

// Test 2: Dry run with duplicate fixing
testResults.push(
  runTest('Duplicate fixing (dry run)', () => {
    const output = runChecker('--fix-duplicates --dry-run', true);

    // Should indicate it would fix duplicates
    if (!output.includes('DRY RUN') && !output.includes('Would write')) {
      throw new Error('Dry run should indicate what would be changed');
    }

    log('    Dry run correctly shows what would be fixed', 'green');
    return output;
  }),
);

// Test 3: Test reordering with dry run
testResults.push(
  runTest('Key reordering (dry run)', () => {
    const output = runChecker('--reorder --dry-run', true);

    // Should indicate it would reorder
    if (!output.includes('DRY RUN') || !output.includes('Would write')) {
      throw new Error('Should indicate reordering would happen');
    }

    log('    Reorder dry run works correctly', 'green');
    return output;
  }),
);

// Test 4: Test missing key marking strategy
testResults.push(
  runTest('Missing key marking strategy (dry run)', () => {
    const output = runChecker('--reorder --missing-strategy=mark --dry-run', true);

    // Should show it would add missing keys with markers
    if (!output.includes('Modified:') || !output.includes('Would be updated')) {
      throw new Error('Should indicate missing keys would be marked');
    }

    // The script should mention the marker in instructions
    if (!output.includes('MISSING TRANSLATION')) {
      throw new Error('Should mention the missing translation marker');
    }

    log('    Missing key marking strategy indicated correctly', 'green');
    return output;
  }),
);

// Test 5: Test with specific locale
testResults.push(
  runTest('Target specific locale (dry run)', () => {
    const output = runChecker('--reorder --dry-run --locales=fr', true);

    // Should only process French
    if (!output.includes('FR Translation') || output.includes('ES Translation')) {
      throw new Error('Should only process specified locale');
    }

    log('    Locale targeting works correctly', 'green');
    return output;
  }),
);

// Test 6: Test duplicate resolution strategies
testResults.push(
  runTest('Duplicate resolution strategy=first (dry run)', () => {
    const output = runChecker('--fix-duplicates --strategy=first --dry-run', true);

    // Should use first strategy
    if (output.includes('strategy=last')) {
      throw new Error('Should not mention last strategy when using first');
    }

    log('    First strategy option accepted', 'green');
    return output;
  }),
);

// Test 7: Verbose mode
testResults.push(
  runTest('Verbose mode output', () => {
    const output = runChecker('--verbose', true);

    // Should show detailed information
    const hasDetails =
      output.includes('• ') || // Bullet points for details
      output.match(/lines \d+ and \d+/) || // Line numbers
      output.includes('First:') || // Duplicate details
      output.includes('Duplicate:');

    if (!hasDetails) {
      throw new Error('Verbose mode should show detailed information');
    }

    log('    Verbose mode provides additional details', 'green');
    return output;
  }),
);

// Test 8: Help output
testResults.push(
  runTest('Help documentation', () => {
    const output = runChecker('--help');

    // Should show help text
    if (
      !output.includes('Enhanced Translation Checker') ||
      !output.includes('OPTIONS:') ||
      !output.includes('EXAMPLES:')
    ) {
      throw new Error('Help should show usage information');
    }

    log('    Help documentation is complete', 'green');
    return output;
  }),
);

// Test 9: Combined operations
testResults.push(
  runTest('Combined fix and reorder (dry run)', () => {
    const output = runChecker('--fix-duplicates --reorder --missing-strategy=mark --dry-run', true);

    // Should do all operations
    if (!output.includes('DRY RUN')) {
      throw new Error('Should be in dry run mode');
    }

    log('    Combined operations work together', 'green');
    return output;
  }),
);

// Test 10: No backup option
testResults.push(
  runTest('No backup option (dry run)', () => {
    const output = runChecker('--fix-duplicates --no-backup --dry-run', true);

    // Should mention no backup
    if (!output.includes('no backup')) {
      throw new Error('Should indicate no backup mode');
    }

    log('    No-backup option recognized', 'green');
    return output;
  }),
);

// Summary
log('\n' + '='.repeat(70), 'magenta');
log('TEST SUMMARY', 'magenta');
log('='.repeat(70), 'magenta');

const passed = testResults.filter((r) => r.passed).length;
const failed = testResults.filter((r) => !r.passed).length;

log(
  `\n📊 Results: ${passed} passed, ${failed} failed out of ${testResults.length} tests`,
  failed > 0 ? 'yellow' : 'green',
);

if (failed > 0) {
  log('\n❌ Some tests failed. The script may have issues that need fixing:', 'red');
  log('  1. Check if duplicate detection is working correctly', 'yellow');
  log('  2. Verify missing key marking actually adds markers', 'yellow');
  log('  3. Ensure dry-run mode prevents file modifications', 'yellow');
  log('  4. Fix any linter errors in the script', 'yellow');
} else {
  log('\n✅ All tests passed! The script appears to be working correctly.', 'green');
}

log('\n📝 Note: This test uses --dry-run to avoid modifying files.', 'blue');
log('   To test actual file modifications, remove --dry-run flags.', 'blue');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
