import { defineConfig } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  entry: ['src/index.ts'],
  sourcemap: !isProduction,
  clean: true,
  minify: true,
  format: ['esm', 'cjs'],
  onSuccess: !isProduction ? 'node dist/index.mjs' : undefined,
  watch: !isProduction,
  dts: true,
  cjsInterop: true,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs',
    };
  },
});
