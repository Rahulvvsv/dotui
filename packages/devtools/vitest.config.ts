import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // happy-dom gives the inspector a real DOM for render tests; globals enables
    // Testing Library's automatic cleanup between tests.
    environment: 'happy-dom',
    globals: true,
  },
});
