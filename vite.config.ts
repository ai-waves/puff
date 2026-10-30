import { defineConfig } from 'vite';

export default defineConfig({
  // box2d3-wasm finds its .wasm next to its own module. Pre-bundling would move the module away
  // from the file, so serve it as-is; production builds copy the .wasm into dist as an asset.
  optimizeDeps: { exclude: ['box2d3-wasm'] },
  build: { target: 'es2022' },
});
