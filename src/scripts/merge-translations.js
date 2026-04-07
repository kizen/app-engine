#!/usr/bin/env node
/**
 * Merges this package's translation keys into the consumer app's
 * public/locales/en/translation.json. Run after extract-translations.
 * App strings win over package strings on key conflicts.
 *
 * Usage: merge-plugin-translations [output-path]
 *   output-path defaults to public/locales/en/translation.json
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

const outputPath = resolve(process.cwd(), process.argv[2] ?? 'public/locales/en/translation.json');

const require = createRequire(import.meta.url);
const ownLocale = require('../translation.json');

const appLocale = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf-8')) : {};

const merged = { ...ownLocale, ...appLocale };
const sorted = Object.fromEntries(Object.entries(merged).sort());

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + '\n');
console.log(
  `plugin-engine: merged ${Object.keys(ownLocale).length} translation key(s) into ${outputPath}`,
);
