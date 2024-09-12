import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'fetchff',
  globalName: 'fetchff',
  entry: ['src/index.ts'],
  target: 'es2017',
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  splitting: false,
});
