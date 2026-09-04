import { defineConfig } from 'vite'

export default defineConfig({
  // relative base: the same build works at aj8uppal.github.io/blockhold, at
  // the domain root, and in local preview
  base: './',
  build: {
    rollupOptions: {
      output: {
        /**
         * Three.js is ~60% of the bundle and changes only when the dependency
         * does; the game changes every deploy. Splitting them means a returning
         * player re-downloads the game code alone, and the two parse in
         * parallel on first visit instead of as one 811 KB block.
         */
        manualChunks: (id: string) =>
          id.includes('node_modules/three') ? 'three' : undefined,
      },
    },
    // Sized to sit just above the `three` vendor chunk, which is what it is and
    // is not ours to trim. The number that actually guards this project is the
    // gzip budget enforced in CI by scripts/, not this warning.
    chunkSizeWarningLimit: 500,
  },
})
