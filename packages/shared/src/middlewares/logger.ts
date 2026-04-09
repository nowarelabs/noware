import { Middleware, Next, RouterContext } from "../router";

export const logger = (): Middleware => {
  return async (req: Request, env: any, ctx: RouterContext, next: Next) => {
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
