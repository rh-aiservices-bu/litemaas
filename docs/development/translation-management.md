# Translation Management

This guide covers the LiteMaaS translation management system, including the enhanced translation checker script and best practices for maintaining internationalization (i18n) across all supported languages.

## Overview

LiteMaaS supports 9 languages with a comprehensive translation system:

- **English (en)** - Source language
- **Spanish (es)** - Español
- **French (fr)** - Français
- **German (de)** - Deutsch
- **Italian (it)** - Italiano
- **Japanese (ja)** - 日本語
- **Korean (ko)** - 한국어
- **Chinese (zh)** - 中文
- **Elvish (elv)** - Sindarin

## Translation Checker Script

The enhanced translation checker script (`frontend/scripts/check-translations.js`) provides comprehensive tools for managing translations, including duplicate detection, key cleanup, and structural alignment across all language files.

### Basic Usage

```bash
# Check for missing keys (basic functionality)
npm run check:translations

# Check for duplicate keys
npm run check:translations -- --check-duplicates

# Fix duplicates and reorder keys
npm run check:translations -- --fix-duplicates --reorder

# Target specific language
npm run check:translations -- --language=fr

# Show all available options
npm run check:translations -- --help
```

### Command-Line Options

| Option               | Description                                     | Default       |
| -------------------- | ----------------------------------------------- | ------------- |
| `--check-duplicates` | Check for duplicate keys in source language     | `false`       |
| `--fix-duplicates`   | Remove duplicate keys and merge objects         | `false`       |
| `--reorder`          | Reorder keys to match English structure         | `false`       |
| `--missing-strategy` | How to handle missing keys: `skip\|mark\|copy`  | `skip`        |
| `--language`         | Target specific language (e.g., `fr`, `de`)     | All languages |
| `--no-backup`        | Skip creating backup files (use git versioning) | `false`       |
| `--help`             | Show usage information                          | -             |

### Key Features

#### 1. Duplicate Key Detection

The script identifies true duplicate keys - those with the exact same full JSON path. For example:

```json
{
  "tools": {
    "bannerEnglishRequired": "Banner text is required",
    "editBanner": "Edit Banner",
    "bannerEnglishRequired": "Banner text is required" // ← This is a duplicate
  }
}
```

**Important**: Keys with the same name but different paths (e.g., `ui.title` vs `models.title`) are NOT duplicates.

#### 2. Duplicate Key Cleanup

When using `--fix-duplicates`, the script:

1. Creates timestamped backups by default (`translation.json.backup.YYYYMMDD_HHMMSS`)
2. **For object key duplicates**: Merges all properties from duplicate objects
3. **For leaf key duplicates**: Resolves duplicates based on strategy (first/last)
4. Preserves JSON structure and formatting
5. Reports the number of duplicates removed

**Backup Options**: Use `--no-backup` to skip backup creation when relying on git versioning.

#### 3. Key Reordering

The `--reorder` option aligns all translation files to match the English source structure:

- Maintains nested object hierarchy
- Preserves all existing translations
- Adds missing keys based on the chosen strategy
- Creates consistent ordering across all languages

#### 4. Missing Key Strategies

When reordering, the script can handle missing keys in three ways:

##### Skip Strategy (`--missing-strategy=skip`)

- Default behavior
- Missing keys are not added to target languages
- Useful for identifying what needs translation

##### Mark Strategy (`--missing-strategy=mark`)

- Adds missing keys with visible markers
- Format: `"key": "🔴 MISSING TRANSLATION - PLEASE TRANSLATE: [English text]"`
- Makes untranslated content easily identifiable
- Prevents hiding translation gaps

##### Copy Strategy (`--missing-strategy=copy`)

- Copies English text as placeholder
- Useful for development environments
- May hide actual translation needs

### Duplicate Handling Behavior

The script handles two types of duplicates differently:

#### 1. Duplicate Object Keys (Merged Correctly)

When the same key appears multiple times containing nested objects, they **are merged**:

```json
// Input:
{
  "tools": {
    "banner": "Banner text",
    "edit": "Edit"
  },
  "tools": {
    "delete": "Delete",
    "save": "Save"
  }
}

// Result (objects merged, all properties preserved):
{
  "tools": {
    "banner": "Banner text",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save"
  }
}
```

#### 2. Duplicate Leaf Keys (Resolved by Strategy)

When the same key appears multiple times with direct values:

```json
// Input:
{
  "tools": {
    "banner": "First text",
    "edit": "Edit",
    "banner": "Second text"  // Duplicate leaf key
  }
}

// Result with --strategy=first:
{
  "tools": {
    "banner": "First text",  // Kept first occurrence
    "edit": "Edit"
  }
}

// Result with --strategy=last (default JSON behavior):
{
  "tools": {
    "banner": "Second text",  // Kept last occurrence
    "edit": "Edit"
  }
}
```

### Duplicate Resolution Strategies

- `--strategy=first`: For leaf duplicates, keeps the first occurrence
- `--strategy=last` (default): For leaf duplicates, keeps the last occurrence

**Note**: Object merging always happens. The strategy only affects duplicate leaf keys within the merged objects.

### Best Practices

#### For Developers

1. **Check for duplicates regularly**:

   ```bash
   npm run check:translations -- --check-duplicates
   ```

2. **Fix duplicates before major releases**:

   ```bash
   npm run check:translations -- --fix-duplicates --reorder --missing-strategy=mark --no-backup
   ```

3. **Maintain consistent structure**:
   - Always use the `--reorder` option when fixing issues
   - Keep English as the authoritative source structure

4. **Use meaningful translation keys**:

   ```json
   // Good
   "models": {
     "subscription": {
       "create": "Create Subscription",
       "cancel": "Cancel Subscription"
     }
   }

   // Avoid
   "msg1": "Create Subscription",
   "msg2": "Cancel Subscription"
   ```

#### For Translators

1. **Look for translation markers**:
   - Search for `🔴 MISSING TRANSLATION - PLEASE TRANSLATE:`
   - These indicate content that needs translation

2. **Preserve key structure**:
   - Don't modify JSON keys, only translate values
   - Maintain proper JSON syntax

3. **Test translations**:
   - Use the application to verify translations appear correctly
   - Check for text truncation or layout issues

#### For AI Assistants

1. **Always check for duplicates first**:

   ```bash
   npm run check:translations -- --check-duplicates
   ```

2. **Fix duplicates before making changes**:

   ```bash
   npm run check:translations -- --fix-duplicates
   ```

3. **Use the mark strategy for new features**:

   ```bash
   npm run check:translations -- --reorder --missing-strategy=mark --no-backup
   ```

4. **Reference the script capabilities**:
   - Script location: `frontend/scripts/check-translations.js`
   - Full feature documentation in this file
   - Always create backups before major changes

### File Structure

```
frontend/
├── scripts/
│   └── check-translations.js          # Enhanced translation checker
├── src/
│   └── i18n/
│       ├── index.ts                   # i18n configuration
│       └── locales/                   # Translation files
│           ├── en/translation.json    # Source language (English)
│           ├── es/translation.json    # Spanish
│           ├── fr/translation.json    # French
│           ├── de/translation.json    # German
│           ├── it/translation.json    # Italian
│           ├── ja/translation.json    # Japanese
│           ├── ko/translation.json    # Korean
│           ├── zh/translation.json    # Chinese
│           └── elv/translation.json   # Elvish
└── package.json                       # Contains check:translations script
```

### Backup System

The script automatically creates backups before making modifications:

- **Format**: `translation.json.backup.YYYYMMDD_HHMMSS`
- **Location**: Same directory as the original file
- **Content**: Exact copy before modifications
- **Cleanup**: Manual cleanup recommended (backups are not auto-deleted)

### Common Issues and Solutions

#### Issue: "Duplicate keys found"

**Solution**: Run with `--fix-duplicates` to clean them up

```bash
npm run check:translations -- --fix-duplicates
```

#### Issue: "JSON syntax error after cleanup"

**Solution**: Restore from backup and report the issue. The script should handle this automatically, but if it fails:

```bash
# Restore from backup
cp translation.json.backup.YYYYMMDD_HHMMSS translation.json
```

#### Issue: "Keys in wrong order"

**Solution**: Use the `--reorder` option to align with English structure

```bash
npm run check:translations -- --reorder
```

#### Issue: "Missing translations not visible"

**Solution**: Use the mark strategy to make them visible

```bash
npm run check:translations -- --reorder --missing-strategy=mark
```

### Integration with Development Workflow

1. **Pre-commit**: Check for duplicates and missing keys
2. **Feature development**: Add English keys first, then use mark strategy
3. **Release preparation**: Ensure all markers are translated
4. **Post-merge**: Verify no structural inconsistencies

### Example Workflows

#### New Feature Development

```bash
# 1. Add English translations for new feature
# 2. Mark missing translations in other languages
npm run check:translations -- --reorder --missing-strategy=mark

# 3. Translators work on marked items
# 4. Before release, verify no markers remain
grep -r "🔴 MISSING TRANSLATION" src/i18n/locales/
```

#### Maintenance and Cleanup

```bash
# 1. Check for duplicates
npm run check:translations -- --check-duplicates

# 2. Fix all issues at once
npm run check:translations -- --fix-duplicates --reorder --missing-strategy=mark

# 3. Review changes
git diff src/i18n/locales/
```

#### Targeting Specific Languages

```bash
# Fix only French translations
npm run check:translations -- --language=fr --reorder --missing-strategy=mark

# Check only German for duplicates
npm run check:translations -- --language=de --check-duplicates
```

---

For technical implementation details, see the script source at `frontend/scripts/check-translations.js`.
