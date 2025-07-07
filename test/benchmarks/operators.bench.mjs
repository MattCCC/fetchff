// To run this benchmark, use the following command:
// npx tsx test/benchmarks/operators.bench.mjs
import Benchmark from 'benchmark';
import { onComplete } from './utils.mjs';

const suite = new Benchmark.Suite();

const obj1 = undefined;
const obj2 = 1;

suite
  .add('|| operator', () => {
    return obj1 || obj2;
  })
  .add('?? operator', () => {
    return obj1 ?? obj2;
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', onComplete)
  .run();
