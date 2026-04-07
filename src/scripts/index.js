#!/usr/bin/env node

const command = process.argv[2];

if (command === 'merge-translations') {
  process.argv.splice(2, 1);
  await import('./merge-translations.js');
} else {
  console.error('Usage: @kizenapps/engine <command>');
  console.error('Commands:');
  console.error('  merge-translations [output-path]');
  process.exit(1);
}
