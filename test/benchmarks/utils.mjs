import chalk from 'chalk';

function onComplete() {
  // @ts-expect-error this is a Benchmark.js context
  const results = this.map((bench) => ({
    name: bench.name,
    hz: bench.hz,
    rme: bench.stats.rme,
    samples: bench.stats.sample.length,
  }));

  // @ts-expect-error this is a Benchmark.js context
  results.sort((a, b) => b.hz - a.hz);

  console.log(chalk.bold('\nBenchmark results:'));
  // @ts-expect-error this is a Benchmark.js context
  results.forEach((r) => {
    const name = chalk.yellow(r.name);
    const ops = chalk.green(
      `${r.hz.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ops/sec`,
    );
    const error = chalk.red(`±${r.rme.toFixed(2)}%`);
    const samples = chalk.blue(`(${r.samples} runs sampled)`);

    console.log(`${name}: ${ops} ${error} ${samples}`);
  });

  const fastest = results[0];
  console.log(chalk.bold.green(`\nFastest is ${fastest.name}`));

  // @ts-expect-error this is a Benchmark.js context
  results.slice(1).forEach((r) => {
    const pctSlower = ((fastest.hz - r.hz) / fastest.hz) * 100;
    const slowerText = chalk.red(`${pctSlower.toFixed(2)}% slower`);
    console.log(
      `${chalk.yellow(r.name)} is ${slowerText} than ${chalk.green(fastest.name)}`,
    );
  });
}

export { onComplete };
