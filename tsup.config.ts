import { defineConfig } from 'tsup';

// tsup always injects the deprecated `baseUrl` option into its DTS build,
// which TypeScript 6 reports as an error (TS5101) unless silenced here.
const dtsCompilerOptions = { ignoreDeprecations: '6.0' };

export default defineConfig([
  {
    name: 'fetchff',
    globalName: 'fetchff',
    entry: ['src/index.ts'],
    format: ['esm', 'iife'],
    target: 'es2018',
    bundle: true,
    dts: { compilerOptions: dtsCompilerOptions },
    clean: true,
    outDir: 'dist/browser',
    platform: 'browser',
    sourcemap: true,
    minify: true,
    treeshake: true,
    splitting: true,
  },
  {
    name: 'fetchff-node',
    globalName: 'fetchff',
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'node18',
    outDir: 'dist/node',
    platform: 'node',
    sourcemap: true,
    minify: true,
    treeshake: true,
    splitting: false,
    dts: false,
    clean: false,
  },
  {
    name: 'fetchff-react',
    globalName: 'fetchffReact',
    entry: ['src/react/index.ts'],
    target: 'es2018',
    dts: { compilerOptions: dtsCompilerOptions },
    format: ['esm', 'cjs'],
    outDir: 'dist/react',
    platform: 'neutral',
    sourcemap: true,
    clean: false,
    minify: true,
    treeshake: true,
    bundle: true,
    splitting: true,
    external: ['react', 'react-dom', 'fetchff'], // prevent bundling React
  },
]);
