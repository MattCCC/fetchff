// To run this benchmark, use the following command:
// npx tsx test/benchmarks/object-merge.bench.mjs
import Benchmark from 'benchmark';
import { onComplete } from './utils.mjs';

const obj1 = { a: 1, b: 2, c: 3 };
const obj2 = { d: 4, e: 5, f: 6 };
const obj3 = { g: 7, h: 8, i: 9 };

const suite = new Benchmark.Suite();

suite
  .add('Spread operator', () => {
    return { ...obj1, ...obj2, ...obj3 };
  })
  .add('Object.assign', () => {
    return Object.assign({}, obj1, obj2, obj3);
  })
  .add('Nested spread', () => {
    return { ...{ ...obj1, ...obj2 }, ...obj3 };
  })
  .add('Sequential spread', () => {
    const merged1 = { ...obj1, ...obj2 };
    return { ...merged1, ...obj3 };
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', onComplete)
  .run();
