// To run this benchmark, use the following command:
// npx tsx test/benchmarks/fetchf.bench.mjs
import Benchmark from 'benchmark';
import { fetchf } from '../../dist/browser/index.mjs';
import { onComplete } from './utils.mjs';

// Mock fetch for consistent benchmark results
const post = {
  userId: 1,
  id: 1,
  title: 'Sample Post',
  body: 'This is a test post content',
};

global.fetch = () =>
  Promise.resolve({
    status: 200,
    ok: true,
    body: post,
    json: () => Promise.resolve(post),
  });

const suite = new Benchmark.Suite();

// Test scenarios
const simpleRequest = () => fetchf('https://api.example.com/posts/1');

const requestWithConfig = () =>
  fetchf('https://api.example.com/posts/1', {
    strategy: 'softFail',
    timeout: 5000,
  });

const requestWithCache = () =>
  fetchf('https://api.example.com/posts/1', {
    cacheTime: 300,
    strategy: 'softFail',
  });

const requestWithStringCache = () =>
  fetchf('https://api.example.com/posts/1', {
    cacheKey: 'post-1',
    cacheTime: 300,
    strategy: 'softFail',
  });

suite
  .add('Simple fetchf request', () => {
    return simpleRequest();
  })
  .add('fetchf with config options', () => {
    return requestWithConfig();
  })
  .add('fetchf with caching enabled', () => {
    return requestWithCache();
  })
  .add('fetchf with string cache key', () => {
    return requestWithStringCache();
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', onComplete)
  .run({ async: true });
