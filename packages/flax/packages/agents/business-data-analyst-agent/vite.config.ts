import { cloudflare } from '@cloudflare/vite-plugin';
import { flue, flueWorkerConfig } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [flue(), cloudflare({ config: flueWorkerConfig(), inspectorPort: false })],
  server: { port: 5202 },
  environments: {
    flax_business_data_analyst_agent: {
      optimizeDeps: {
        include: [
          '@flue/runtime',
          '@flue/runtime/internal',
          '@flue/runtime/routing',
          '@flue/runtime/cloudflare/internal',
          '@flue/runtime/cloudflare/workers-ai',
          'agents',
          'hono',
        ],
      },
    },
  },
});
