import { Middleware, Next, RouterContext } from "../types";

export type CorsOptions = {
  origin?: string;
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
};

export const cors = <Env = any, Ctx = any>(options: CorsOptions = {}): Middleware<Env, Ctx> => {
  return async (req: Request, env: Env, ctx: RouterContext<Env, Ctx>, next: Next) => {
    const origin = options.origin || "*";
    const methods = options.methods || ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
    const headers = options.headers || ["Content-Type", "Authorization", "X-Requested-With"];

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": methods.join(", "),
          "Access-Control-Allow-Headers": headers.join(", "),
          "Access-Control-Allow-Credentials": options.credentials ? "true" : "false",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const res = await next();
    res.headers.set("Access-Control-Allow-Origin", origin);
    if (options.credentials) res.headers.set("Access-Control-Allow-Credentials", "true");
    return res;
  };
};
