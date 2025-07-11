// To run this benchmark, use the following command:
// npx tsx test/benchmarks/cache-key.bench.mjs
import Benchmark from 'benchmark';
import { generateCacheKey } from '../../dist/node/index.js';
import { onComplete } from './utils.mjs';

const suite = new Benchmark.Suite();

// Test data
const simpleConfig = {
  url: '/api/users',
  method: 'GET',
};

const complexConfig = {
  url: '/api/users',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token',
  },
  body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
};

suite
  .add('Simple GET cache key', () => {
    generateCacheKey(simpleConfig);
  })
  .add('Complex POST cache key', () => {
    generateCacheKey(complexConfig);
  })
  .add('Custom cache key', () => {
    generateCacheKey({ ...simpleConfig, cacheKey: 'custom-key' });
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', onComplete)
  .run({ async: true });
