# Benchmarks

This directory contains performance benchmarks for the fetchff library using [Benchmark.js](https://benchmarkjs.com/).

## Running Benchmarks

Run individual benchmarks:

```bash
node test/benchmarks/operators.bench.mjs
node test/benchmarks/object-merge.bench.mjs
node test/benchmarks/fetchf.bench.mjs
```

## Benchmark Files

### `operators.bench.mjs`

Compares performance of different JavaScript operators:

- `||` (OR operator) vs `??` (nullish coalescing)
- Used to optimize default value assignments in the library

### `object-merge.bench.mjs`

Tests different strategies for merging JavaScript objects:

- **Spread operator**: `{ ...obj1, ...obj2, ...obj3 }`
- **Object.assign**: `Object.assign({}, obj1, obj2, obj3)`
- **Nested spread**: `{ ...{ ...obj1, ...obj2 }, ...obj3 }`
- **Sequential spread**: Step-by-step merging

Critical for config merging performance in `buildConfig()` and interceptor handling.

### `fetchf.bench.mjs`

Benchmarks core fetchf functionality:

- **Simple request**: Basic `fetchf()` call
- **With config options**: Error handling and timeout configuration
- **With caching**: Performance impact of caching features

Tests real-world usage patterns to identify performance bottlenecks.

### `swr.bench.jsx`

Compares React SWR performance:

- `useSWR` vs `useFetcher`
- Component mount/unmount cycles

### `utils.mjs`

Shared utilities for benchmark formatting:

- Colorized output with ops/sec formatting
- Performance comparison with percentage differences
- Clean, readable benchmark results

## Understanding Results

Benchmark output shows:

- **Operations per second** (higher is better)
- **Relative mean error** (±percentage)
- **Sample count** for statistical significance
- **Performance differences** between approaches

Example output:

```
Simple fetchf request: 1,234,567 ops/sec ±1.23% (89 runs sampled)
fetchf with config options: 987,654 ops/sec ±2.45% (85 runs sampled)

Fastest is Simple fetchf request
fetchf with config options is 20.00% slower than Simple fetchf request
```

## Adding New Benchmarks

1. Create a new `.bench.mjs` file
2. Import Benchmark.js and utils
3. Use the standard pattern:

```javascript
import Benchmark from 'benchmark';
import { onComplete } from './utils.mjs';

const suite = new Benchmark.Suite();

suite
  .add('Test name', () => {
    // Your test code here
  })
  .on('cycle', (event) => console.log(String(event.target)))
  .on('complete', onComplete)
  .run();
```
