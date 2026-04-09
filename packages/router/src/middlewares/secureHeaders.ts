import { Middleware, Next, RouterContext } from "../types";

export const secureHeaders = <Env = any, Ctx = any>(): Middleware<Env, Ctx> => {
  return async (req: Request, env: Env, ctx: RouterContext<Env, Ctx>, next: Next) => {
    const res = await next();
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    res.headers.set("Referrer-Policy", "no-referrer-when-downgrade");
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    return res;
  };
};
