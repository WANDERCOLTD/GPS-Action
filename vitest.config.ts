import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'eslint-rules/tests/**/*.test.js'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        'eslint-rules/**',
        'prisma/migrations/**',
        'prisma/seed.ts',
        'tests/**',
      ],
    },
  },
  css: {
    postcss: { plugins: [] },
  },
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/server': path.resolve(__dirname, './server'),
      '@/shared': path.resolve(__dirname, './shared'),
      '@/styles': path.resolve(__dirname, './styles'),
    },
  },
});
