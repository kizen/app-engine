import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const DIST = 'dist';
const WORKER_DIR = join(DIST, 'workers');

// Symbols that should never appear in a Web Worker bundle.
const FORBIDDEN_SYMBOLS = [
  'localStorage',
  'sessionStorage',
  'json-stable-stringify',
  'getStableHash',
  'getProcessedAssistantConfig',
  'react/jsx',
  'react-dom',
];

// Total size across all chunks reachable from workers/*.js. Only bump deliberately
// when the worker needs more code, but realistically we should try to stay under'
// this size
const WORKER_CHUNK_SIZE_BUDGET = 80_000;

const findChunkImports = (content) =>
  [
    ...content.matchAll(/from\s+['"][.\/]+(chunk-[^'"]+\.js)['"]/g),
    ...content.matchAll(/import\s+['"][.\/]+(chunk-[^'"]+\.js)['"]/g),
  ].map((m) => m[1]);

const collectChunksReachableFromWorkers = () => {
  const reachable = new Set();
  const queue = [];

  for (const f of readdirSync(WORKER_DIR).filter((f) => f.endsWith('.js'))) {
    for (const chunk of findChunkImports(readFileSync(join(WORKER_DIR, f), 'utf8'))) {
      if (!reachable.has(chunk)) {
        reachable.add(chunk);
        queue.push(chunk);
      }
    }
  }

  while (queue.length) {
    const chunk = queue.shift();

    for (const next of findChunkImports(readFileSync(join(DIST, chunk), 'utf8'))) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  return reachable;
};

const chunks = collectChunksReachableFromWorkers();
const violations = [];
let totalSize = 0;

for (const chunk of chunks) {
  const path = join(DIST, chunk);
  totalSize += statSync(path).size;
  const content = readFileSync(path, 'utf8');

  for (const symbol of FORBIDDEN_SYMBOLS) {
    if (content.includes(symbol)) violations.push({ chunk, symbol });
  }
}

const errors = [];

if (violations.length) {
  errors.push('Forbidden symbols found in worker-reachable chunks:');

  for (const { chunk, symbol } of violations) {
    errors.push(`  ${chunk}: contains "${symbol}"`);
  }
}

if (totalSize > WORKER_CHUNK_SIZE_BUDGET) {
  errors.push(`Worker chunk total size ${totalSize}B exceeds budget ${WORKER_CHUNK_SIZE_BUDGET}B`);
}

if (errors.length) {
  console.error('check-worker-bundles failed:');

  for (const e of errors) {
    console.error(e);
  }

  console.error('');

  console.error(
    'If this is intentional, update FORBIDDEN_SYMBOLS or WORKER_CHUNK_SIZE_BUDGET in scripts/check-worker-bundles.js.',
  );

  process.exit(1);
}

console.log(
  `check-worker-bundles: ${chunks.size} chunks reachable, ${totalSize}B total (budget ${WORKER_CHUNK_SIZE_BUDGET}B) — OK`,
);
