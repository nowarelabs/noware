import { Middleware, Next, RouterContext } from "../types";

export const basicAuth = <Env = any, Ctx = any>(
  options: {
    username?: string;
    password?: string;
    realm?: string;
  } = {},
): Middleware<Env, Ctx> => {
  return async (req: Request, env: Env, ctx: RouterContext<Env, Ctx>, next: Next) => {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": `Basic realm="${options.realm || "Secure Area"}"`,
        },
      });
    }

    const base64 = authHeader.split(" ")[1];
    const decoded = atob(base64);
    const [username, password] = decoded.split(":");

    // Constant-time comparison to prevent timing attacks
    const compare = (a: string, b: string) => {
      if (a.length !== b.length) return false;
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
      }
      return result === 0;
    };

    const userOk = options.username ? compare(username, options.username) : true;
    const passOk = options.password ? compare(password, options.password) : true;

    if (!userOk || !passOk) {
      return new Response("Unauthorized", { status: 401 });
    }

    return await next();
  };
};
