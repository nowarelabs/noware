/**
 * @nowarelabs/depends — Usage Examples
 *
 * This file shows every pattern in the library and how it composes
 * within the Nowarelabs framework. Three layers:
 *
 *   1. Framework plumbing   — what Nowarelabs itself ships (developer never writes this)
 *   2. Developer app        — controllers, services, models (the user's code)
 *   3. Entry point          — export default { fetch } (Cloudflare Worker)
 *
 * Run with: `vp exec src/example.ts`
 */

import {
  DependsOn,
  uses,
  container,
  type ContainerConfig,
  DependencyKey,
  DependencyRegistry,
  BaseDepends,
} from "./index.ts";
import type { KeyedDependency } from "./index.ts";

// =============================================================================
// Layer 1 — Framework Plumbing (shipped by Nowarelabs, developer never writes this)
// =============================================================================

// --- Platform Adapter (one per platform) ------------------------------------
// Translates the platform's env object into Standard Gauge container config.
// Developers never see env directly — the framework handles it.

interface PlatformAdapter<E = unknown> {
  bootstrap(env: E): ContainerConfig;
}

class CloudflareAdapter implements PlatformAdapter<{
  DB: unknown;
  KV: unknown;
  AI: unknown;
}> {
  bootstrap(env: { DB: unknown; KV: unknown; AI: unknown }): ContainerConfig {
    return {
      Database: () => new D1Database(env.DB),
      Cache: () => new KVCache(env.KV),
      AI: () => new AIAdapter(env.AI),
    };
  }
}

// To add a new platform, write an adapter that translates its env:
//   class NodeAdapter implements PlatformAdapter { ... }
//   class FlyAdapter  implements PlatformAdapter { ... }
// The developer never changes their services — just the adapter import.

// --- Platform implementations -----------------------------------------------

class D1Database {
  constructor(_binding: unknown) {}
  query(sql: string): unknown[] {
    console.log(`  [D1] ${sql}`);
    return [{ id: "1", name: "Alice" }];
  }
}

class KVCache {
  constructor(_binding: unknown) {}
}

class AIAdapter {
  constructor(_binding: unknown) {}
}

// --- RCSM Resolver (framework internals) -------------------------------------
// The RCSM chain (Controller → Service → Model) is a fixed one-per-layer
// pattern. The framework auto-wires it from uses() declarations — no manual
// new Service(...) in constructors.

interface Logger {
  log(message: string): void;
}

interface Database {
  query(sql: string): unknown[];
}

class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(`  [LOG] ${message}`);
  }
}

// The framework's fetch handler — called once per request.
// This is COMPLETELY internal — the developer never sees it.
async function handleRequest<E>(
  adapter: PlatformAdapter<E>,
  _request: Request,
  env: E,
  _ctx: unknown,
): Promise<Response> {
  const registry = container({
    // Platform bindings (from the adapter)
    ...adapter.bootstrap(env),
    // Framework services (ConsoleLogger for non-production, etc.)
    Logger: () => new ConsoleLogger(),
    // Developer's services are registered by convention
    // (auto-discovered from file paths — see Layer 2)
    services: [UsersController, UsersService, PostsService],
  });

  // Router is resolved from the registry
  const router = registry.resolve(Router);
  return router.handle();
}

// =============================================================================
// Layer 2 — Developer App (the user writes this)
// =============================================================================

// --- Services ----------------------------------------------------------------
// Instead of:
//   constructor(req, env, ctx) {
//     super(req, env, ctx);
//     this.db = env.DB;
//     this.posts = new PostModel(this.db, this.req, this.env, this.ctx);
//   }
//
// They write:

class UsersService extends DependsOn {
  private db = uses(DependencyKey.named<Database>("Database"));
  private log = uses(DependencyKey.named<Logger>("Logger"));

  all() {
    this.log.log("UsersService.all");
    return this.db.query("SELECT * FROM users");
  }
}

class PostsService extends DependsOn {
  private db = uses(DependencyKey.named<Database>("Database"));

  all() {
    return this.db.query("SELECT * FROM posts");
  }
}

// --- Controllers -------------------------------------------------------------
// Same pattern — no manual service wiring.

class UsersController {
  private users = uses(UsersService);

  index() {
    return this.users.all();
  }
}

// --- Router (resolved by the framework) --------------------------------------

class Router {
  private users = uses(UsersController);

  handle() {
    console.log("Router.handle");
    console.log(`  Users: ${JSON.stringify(this.users.index())}`);
    return new Response("ok", { status: 200 });
  }
}

// =============================================================================
// Layer 3 — Entry Point (user's wrangler.toml / server.ts)
// =============================================================================

// This is the ONLY Cloudflare-specific file the developer writes.
// No env, no bindings, no container() — just the adapter choice.
//
// export default {
//   async fetch(request, env, ctx) {
//     return handleRequest(new CloudflareAdapter(), request, env, ctx);
//   },
// };

function demo(): void {
  console.log("=== Nowarelabs + @nowarelabs/depends ===\n");

  const request = new Request("https://example.com/users");
  const cloudflareEnv = { DB: {}, KV: {}, AI: {} };

  void handleRequest(new CloudflareAdapter(), request, cloudflareEnv, {});
}

demo();

// =============================================================================
// Testing — scope() and fake() in test files
// =============================================================================

function testDemo(): void {
  console.log("\n=== Testing ===\n");

  const registry = container({
    Database: () => new D1Database("test"),
    Logger: () => new ConsoleLogger(),
    services: [UsersService],
  });

  // Fake the database without touching UsersService:
  const { resolve } = registry.fake({
    Database: () => {
      const mock: Database = { query: () => [{ id: "mock-user" }] };
      return mock;
    },
  });

  const users = resolve(UsersService);
  users.all();
}

testDemo();

// =============================================================================
// Primitives — available when conventions don't fit
// =============================================================================

function primitivesDemo(): void {
  console.log("\n=== Primitives ===\n");

  const Keys = {
    Logger: DependencyKey.named<Logger>("logger"),
  };

  class Notifier extends BaseDepends {
    private get logger(): Logger {
      return this.inject(Keys.Logger);
    }
    notify(msg: string): void {
      this.logger.log(msg);
    }
  }

  class EmailService
    extends BaseDepends
    implements KeyedDependency<EmailService>
  {
    static readonly key = DependencyKey.named<EmailService>("email");
    readonly dependencyKey = EmailService.key;
  }

  const registry = DependencyRegistry.build((give) => {
    give(Keys.Logger, new ConsoleLogger());
    give(new EmailService());
    give(DependencyKey.named<Notifier>("notifier"), new Notifier());
  });

  registry.resolve(Keys.Logger).log("primitives demo running");
  void registry.resolve(EmailService.key);

  const testRegistry = registry.fork();
  void testRegistry.resolve(Keys.Logger);
}

primitivesDemo();
