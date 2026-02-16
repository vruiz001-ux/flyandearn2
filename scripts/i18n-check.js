#!/usr/bin/env node

/**
 * FlyAndEarn - i18n CI Check Script
 *
 * Validates translation files for:
 * 1. Missing keys across supported locales
 * 2. Mismatched interpolation placeholders
 * 3. Empty translations
 * 4. Invalid characters
 *
 * Usage:
 *   node scripts/i18n-check.js
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Validation errors found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPPORTED_LANGUAGES = ['en', 'fr', 'pl', 'de'];
const REQUIRED_LANGUAGES = ['en', 'pl']; // Must have translations for these
const TRANSLATIONS_PATH = path.join(__dirname, '../src/i18n/translations.js');

let errors = [];
let warnings = [];

/**
 * Extract all {{variable}} placeholders from a string
 */
function extractPlaceholders(str) {
  const matches = str.match(/\{\{(\w+)\}\}/g) || [];
  return matches.sort();
}

/**
 * Load translations from the translations.js file
 */
async function loadTranslations() {
  try {
    const module = await import(TRANSLATIONS_PATH);
    return module.TRANSLATIONS;
  } catch (e) {
    console.error('Failed to load translations:', e.message);
    process.exit(1);
  }
}

/**
 * Check for missing translations
 */
function checkMissingTranslations(translations) {
  console.log('\n📋 Checking for missing translations...\n');

  const keys = Object.keys(translations);
  let missingCount = 0;

  for (const key of keys) {
    const entry = translations[key];

    // Check required languages
    for (const lang of REQUIRED_LANGUAGES) {
      if (!entry[lang]) {
        errors.push(`Missing required translation: ${key} [${lang}]`);
        missingCount++;
      }
    }

    // Check optional languages (warnings only)
    for (const lang of SUPPORTED_LANGUAGES) {
      if (!REQUIRED_LANGUAGES.includes(lang) && !entry[lang]) {
        warnings.push(`Missing optional translation: ${key} [${lang}]`);
      }
    }
  }

  console.log(`  Found ${missingCount} missing required translations`);
}

/**
 * Check for placeholder mismatches
 */
function checkPlaceholderMismatches(translations) {
  console.log('\n🔧 Checking placeholder consistency...\n');

  const keys = Object.keys(translations);
  let mismatchCount = 0;

  for (const key of keys) {
    const entry = translations[key];

    // Use English as the reference
    if (!entry.en) continue;

    const enPlaceholders = extractPlaceholders(entry.en);

    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang === 'en' || !entry[lang]) continue;

      const langPlaceholders = extractPlaceholders(entry[lang]);

      // Compare placeholders
      if (JSON.stringify(enPlaceholders) !== JSON.stringify(langPlaceholders)) {
        errors.push(
          `Placeholder mismatch: ${key} [${lang}]\n` +
          `  EN: ${enPlaceholders.join(', ') || '(none)'}\n` +
          `  ${lang.toUpperCase()}: ${langPlaceholders.join(', ') || '(none)'}`
        );
        mismatchCount++;
      }
    }
  }

  console.log(`  Found ${mismatchCount} placeholder mismatches`);
}

/**
 * Check for empty translations
 */
function checkEmptyTranslations(translations) {
  console.log('\n🔍 Checking for empty translations...\n');

  const keys = Object.keys(translations);
  let emptyCount = 0;

  for (const key of keys) {
    const entry = translations[key];

    for (const lang of SUPPORTED_LANGUAGES) {
      if (entry[lang] !== undefined && entry[lang].trim() === '') {
        errors.push(`Empty translation: ${key} [${lang}]`);
        emptyCount++;
      }
    }
  }

  console.log(`  Found ${emptyCount} empty translations`);
}

/**
 * Check for suspicious patterns
 */
function checkSuspiciousPatterns(translations) {
  console.log('\n⚠️  Checking for suspicious patterns...\n');

  const keys = Object.keys(translations);
  let suspiciousCount = 0;

  // Patterns to check
  const suspiciousPatterns = [
    { pattern: /TODO/i, message: 'Contains TODO' },
    { pattern: /FIXME/i, message: 'Contains FIXME' },
    { pattern: /XXX/i, message: 'Contains XXX' },
    { pattern: /\[\[.*\]\]/, message: 'Contains [[brackets]]' },
    { pattern: /Lorem ipsum/i, message: 'Contains Lorem ipsum placeholder' },
  ];

  for (const key of keys) {
    const entry = translations[key];

    for (const lang of SUPPORTED_LANGUAGES) {
      if (!entry[lang]) continue;

      for (const { pattern, message } of suspiciousPatterns) {
        if (pattern.test(entry[lang])) {
          warnings.push(`Suspicious: ${key} [${lang}] - ${message}`);
          suspiciousCount++;
        }
      }
    }
  }

  console.log(`  Found ${suspiciousCount} suspicious patterns`);
}

/**
 * Check glossary consistency
 */
async function checkGlossaryConsistency() {
  console.log('\n📚 Checking glossary consistency...\n');

  try {
    const glossaryPath = path.join(__dirname, '../src/i18n/glossary.js');
    const module = await import(glossaryPath);
    const glossary = module.GLOSSARY;

    let missingCount = 0;

    for (const [term, entry] of Object.entries(glossary)) {
      for (const lang of REQUIRED_LANGUAGES) {
        // Check if at least one variant exists for required languages
        const hasTranslation = Object.keys(entry.translations).some(
          locale => locale.startsWith(lang)
        );

        if (!hasTranslation) {
          errors.push(`Glossary missing: ${term} [${lang}]`);
          missingCount++;
        }
      }
    }

    console.log(`  Found ${missingCount} missing glossary terms`);
  } catch (e) {
    warnings.push(`Could not check glossary: ${e.message}`);
  }
}

/**
 * Generate report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 I18N VALIDATION REPORT');
  console.log('='.repeat(60));

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All checks passed!\n');
    return 0;
  }

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):\n`);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}\n`));
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}\n`));
  }

  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log(`\n❌ Build failed with ${errors.length} error(s)\n`);
    return 1;
  }

  console.log(`\n✅ Build passed with ${warnings.length} warning(s)\n`);
  return 0;
}

/**
 * Main
 */
async function main() {
  console.log('\n🌍 FlyAndEarn i18n Validation');
  console.log('='.repeat(60));

  const translations = await loadTranslations();
  const keyCount = Object.keys(translations).length;

  console.log(`\nLoaded ${keyCount} translation keys`);
  console.log(`Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
  console.log(`Required languages: ${REQUIRED_LANGUAGES.join(', ')}`);

  // Run checks
  checkMissingTranslations(translations);
  checkPlaceholderMismatches(translations);
  checkEmptyTranslations(translations);
  checkSuspiciousPatterns(translations);
  await checkGlossaryConsistency();

  // Generate report and exit
  const exitCode = generateReport();
  process.exit(exitCode);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
