import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "0.0.0.0",
    port: 3000,
    // allowedHosts: ["3e68f413ee4c.ngrok-free.app"],
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'crypto': 'crypto-browserify',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
        NodeModulesPolyfillPlugin()
      ],
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          polkadot: [
            '@polkadot/api',
            '@polkadot/extension-dapp',
            '@polkadot/util',
            '@polkadot/types',
            '@polkadot/types/lookup',
            '@polkadot/util-crypto',
          ],
          recharts: ['recharts'],
          reacticons: ['react-icons'],
        },
      },
    },
  },
}));