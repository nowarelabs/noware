/**
 * @nowarelabs/depends - Usage Examples
 *
 * These examples cover every pattern in the library.
 * Run with: `vp exec src/example.ts`
 */

import { BaseDepends, DependencyKey, DependencyRegistry, inject } from "./index.ts";
import type { KeyedDependency } from "./index.ts";

function demo(): void {
  // ==========================================================================
  // 1. Defining Keys
  // ==========================================================================

  const Keys = {
    Logger: DependencyKey.named<Logger>("logger"),
    Database: DependencyKey.named<Database>("database"),
    Auth: DependencyKey.named<Authorizer>("auth", () => new DefaultAuthorizer()),
    Cache: DependencyKey.named<CacheClient>("cache", () => new MemoryCache()),
  };

  // ==========================================================================
  // 2. Defining Dependencies
  // ==========================================================================

  interface Logger {
    info(msg: string): void;
    error(msg: string): void;
  }

  interface Database {
    query(sql: string): ReadonlyArray<Record<string, unknown>>;
  }

  interface Authorizer {
    authorize(token: string): boolean;
  }

  interface CacheClient {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
  }

  class ConsoleLogger implements Logger {
    info(msg: string): void {
      console.log(`[INFO] ${msg}`);
    }
    error(msg: string): void {
      console.error(`[ERROR] ${msg}`);
    }
  }

  class PostgresDatabase implements Database {
    query(_sql: string): ReadonlyArray<Record<string, unknown>> {
      return [];
    }
  }

  class DefaultAuthorizer implements Authorizer {
    authorize(_token: string): boolean {
      return true;
    }
  }

  class MemoryCache implements CacheClient {
    private store = new Map<string, unknown>();
    get(key: string): unknown {
      return this.store.get(key);
    }
    set(key: string, value: unknown): void {
      this.store.set(key, value);
    }
  }

  // ==========================================================================
  // 3. Service Using BaseDepends
  // ==========================================================================

  class UserService extends BaseDepends {
    private get logger(): Logger {
      return this.inject(Keys.Logger);
    }

    private get db(): Database {
      return this.inject(Keys.Database);
    }

    findUser(_id: string): ReadonlyArray<Record<string, unknown>> {
      this.logger.info(`finding user`);
      return this.db.query(`SELECT * FROM users`);
    }
  }

  // ==========================================================================
  // 4. Using setup() for Post-Dependency Initialisation
  // ==========================================================================

  class CacheWarmingService extends BaseDepends {
    private get cache(): CacheClient {
      return this.inject(Keys.Cache);
    }

    protected setup(): void {
      this.cache.set("warmed", true);
    }
  }

  // ==========================================================================
  // 5. KeyedDependency - Self-Keyed Types
  // ==========================================================================

  class EmailService extends BaseDepends implements KeyedDependency<EmailService> {
    static readonly key = DependencyKey.named<EmailService>("email.service");
    readonly dependencyKey = EmailService.key;

    send(_to: string, _subject: string): void {
      /* ... */
    }
  }

  class SmsService extends BaseDepends implements KeyedDependency<SmsService> {
    static readonly key = DependencyKey.named<SmsService>("sms.service");
    readonly dependencyKey = SmsService.key;

    send(_to: string, _message: string): void {
      /* ... */
    }
  }

  // ==========================================================================
  // 6. Creating a Registry
  // ==========================================================================

  const registry = DependencyRegistry.build((give) => {
    give(Keys.Logger, new ConsoleLogger());
    give(Keys.Database, new PostgresDatabase());
    give(Keys.Cache, new MemoryCache());
    give(Keys.Auth, new DefaultAuthorizer());
    give(new EmailService());
    give(new SmsService());
    give(DependencyKey.named<UserService>("user-service"), new UserService());
    give(DependencyKey.named<CacheWarmingService>("cache-warmer"), new CacheWarmingService());
  });

  // ==========================================================================
  // 7. Resolving Dependencies
  // ==========================================================================

  const logger = registry.resolve(Keys.Logger);
  logger.info("app started");

  void registry.resolve(Keys.Auth);
  void registry.resolve(Keys.Cache);
  void registry.resolve(EmailService.key);
  void registry.resolve<UserService>(DependencyKey.named<UserService>("user-service"));

  // ==========================================================================
  // 8. Parent Registry (Chain-of-Responsibility)
  // ==========================================================================

  const appRegistry = new DependencyRegistry();
  appRegistry.register(Keys.Database, new PostgresDatabase());
  appRegistry.register(Keys.Logger, new ConsoleLogger());

  const requestRegistry = new DependencyRegistry(appRegistry);
  requestRegistry.register(Keys.Logger, new ConsoleLogger());

  void requestRegistry.resolve(Keys.Logger);
  void requestRegistry.resolve(Keys.Database);

  // ==========================================================================
  // 9. Scoped Testing with Fork
  // ==========================================================================

  const testRegistry = appRegistry.fork();
  const testDb: Database = { query: () => [{ id: "test-1" }] };
  testRegistry.register(Keys.Database, testDb);
  void testRegistry.resolve(Keys.Database).query("SELECT 1");

  // ==========================================================================
  // 10. Checking, Unregistering, Clearing
  // ==========================================================================

  void registry.has(Keys.Logger);
  registry.unregister(Keys.Logger);
  registry.clear();

  // ==========================================================================
  // 11. Standalone inject() Utility
  // ==========================================================================

  class ConfigService extends BaseDepends {
    get cfg(): string {
      return inject(
        this,
        DependencyKey.named<string>("config", () => "default"),
      );
    }
  }

  const configService = new ConfigService();
  void configService.cfg;
}

demo();
