import { RouteDrawer } from 'nomo/router';
import type { AppExecutionContext } from 'nomo/router';

import { htmlRewriterMiddleware, importMapMiddleware } from './middlewares';

import {
{{controllerImports}}
} from './controllers';

import {
{{controllerRpcImports}}
} from './controllers/rpcs';

import {
{{controllerRpcViewImports}}
} from './controllers/rpcs/views';

export class AppRoutes extends RouteDrawer<Env, AppExecutionContext> {
  draw() {
    this.use(htmlRewriterMiddleware);
    this.use(importMapMiddleware);
    this.get('/health', (req: Request, env: Env, ctx: any) => ctx.json({ req, env, ctx, status: 'ok', service: 'gateway' }));

    this.version('1', (v1: AppRoutes) => {
{{d1ResourceRoutes}}

      v1.namespace('rpc', (rpc: AppRoutes) => {
{{d1RpcRoutes}}
      });

      v1.namespace('rpc/views', (views: AppRoutes) => {
{{doRpcViewRoutes}}
      });
    });
  }
}