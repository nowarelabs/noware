import { Middleware, Next, RouterContext } from "../types";

export const logger = <Env = any, Ctx = any>(): Middleware<Env, Ctx> => {
  return async (req: Request, env: Env, ctx: RouterContext<Env, Ctx>, next: Next) => {
    const start = Date.now();
    const { method, url } = req;
    const { pathname } = new URL(url);

    try {
      const response = await next();
      const duration = Date.now() - start;
      console.log(`${method} ${pathname} ${response.status} - ${duration}ms`);
      return response;
    } catch (err) {
      const duration = Date.now() - start;
      console.error(`${method} ${pathname} error - ${duration}ms`);
      throw err;
    }
  };
};
