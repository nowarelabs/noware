import { cloudflare } from '@cloudflare/vite-plugin';
import { flue, flueWorkerConfig } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [flue(), cloudflare({ config: flueWorkerConfig(), inspectorPort: false })],
  server: { port: 5199 },
  environments: {
    flax_orchestrator_agent: {
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
