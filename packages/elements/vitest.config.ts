import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // happy-dom gives the elements a real DOM for interaction tests; globals enables
    // Testing Library's automatic cleanup between tests.
    environment: 'happy-dom',
    globals: true,
  },
});
