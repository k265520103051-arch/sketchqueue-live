import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const clientRoot = fileURLToPath(new URL('./src/client/', import.meta.url));

export default defineConfig({
  root: 'src/client',
  base: '/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    assetsDir: 'assets',
    rolldownOptions: {
      input: {
        control: clientRoot + 'control/index.html',
        stage: clientRoot + 'stage/index.html',
      },
    },
  },
});
