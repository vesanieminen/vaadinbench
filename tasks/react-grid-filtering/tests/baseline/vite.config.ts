/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React application lives in src/main/frontend. `npm run build` writes it
// to target/classes/static, where Spring Boot serves it from the classpath, so
// a @SpringBootTest(webEnvironment = RANDOM_PORT) test sees the latest build.
//
// `npm run dev` serves the frontend on its own and forwards /api to a backend
// on port 8080, for whoever wants to run the two separately.
export default defineConfig({
  root: 'src/main/frontend',
  // Vite keeps its cache under the root's node_modules by default; this keeps it
  // in the project's own, out of the source tree.
  cacheDir: '../../../node_modules/.vite',
  plugins: [react()],
  build: {
    outDir: '../../../target/classes/static',
    emptyOutDir: true,
  },
  server: {
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
  },
});
