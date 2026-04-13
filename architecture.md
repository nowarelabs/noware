# Nomo Architecture

Nomo is a Rails-like TypeScript framework for building serverless applications on Cloudflare Workers. It combines convention over configuration with pluggable evolution points, enabling developers to build fast while maintaining architectural escape hatches.

## Core Philosophy

Nomo follows the **Standard Gauge** - a convention-driven architecture where every layer has a predictable responsibility, lifecycle hooks, and plugin points. The key insight: organize around **what your system does** (business tasks), not **how it's built** (technical layers).

The system follows a **Double-Gate RPC** architecture:

- **Tier 1 RPC** (BaseRpcServer): Public entrance - maps frontend to features
- **Tier 2 RPC** (BaseRpc): Secure vault - ensures business logic can't bypass controller protections

### Why Two-Tier?

| Aspect | Group by Data (Layered) | Group by Task (Nomo Two-Tier) |
|--------|---------------------|------------------------|
| Organization | Technical layers | Business capabilities |
| File navigation | Jump between folders | Everything in feature place |
| Code reuse | Easy to share models | Explicit interfaces |
| Feature development | Touch multiple layers | Contained changes |
| Testing | Easy to mock layers | Easy to test scenarios |
| Team scaling | Teams step on each other | Teams own modules |
| Coupling | High (shared models) | Low (modules + events) |
| Bug isolation | Hard (layer interactions) | Easy (within boundaries) |

This architecture handles every case:
- Simple CRUD? Use RCSM directly
- Complex workflow? Use Features
- Need to scale one area? Extract a context
- New requirement? Add a Plugin
- External service change? Swap an Adapter
- Performance issue? Add a Projection

---

## The Standard Gauge Framework Reference

| Layer / Folder | Base Class | Type | Responsibility | Connects To | Primary Hooks | Plugin Points |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Context** | `BaseContext` | - | Bounded Context Container | `BaseModule` | `onSetup`, `onTeardown` | Config |
| **Module** | `BaseModule` | - | Autoloading & Registry | `FeatureHandler` | `onLoad`, `onUnload` | Middlewares |
| **Api (T1)** | `BaseRpcServer` | Generic\<Env, Ctx\> | Public Routes → Features | `BaseFeatureHandler` | `onInbound`, `onOutbound` | Rate Limiting |
| **Api** | `BaseIntegrationEvent` | Generic\<T\> | Cross-Context Broadcast | `EventBus` | `onPublish`, `onReceive` | Serializers |
| **Feature** | `BaseFeatureHandler` | Generic\<TInput, TOutput\> | **Orchestrator** | `BaseRpc` (multiple allowed) | `validate`, `prepare`, `execute`, `finalize` | Contracts |
| **Core** | `BaseCore` | - | Domain Kernel | (self-contained) | `onWarmup` | Policies |
| **Command (T2)** | `BaseRpc` | Generic\<TInput, TOutput\> | Internal Gate | `BaseController` (RCSM) | `beforeDispatch` | Audit Logs |
| **Controller** | `BaseController` | Generic\<Env, Ctx, Service, Entity, NewEntity\> | **Manager** (C in RCSM) | `BaseService` (RCSM) | `beforeAction`, `afterAction` | Validator, Normalizer |
| **Controller** | `BaseResourceController` | extends BaseController | RESTful CRUD | `BaseService` (RCSM) | `trash`, `restore`, `hide`... | Relations |
| **Service** | `BaseService` | Generic\<Env, Ctx, Model, Entity\> | **Worker** (S in RCSM) | `BaseModel` (RCSM) | `beforeCreate`, `afterUpdate` | Transactions |
| **Model** | `BaseModel` | Generic\<TTable, Entity, NewEntity\> | **State** (M in RCSM) | `BasePersistence` (RCSM) | `beforeSave`, `afterCreate` | Events |
| **Aggregate** | `BaseAggregate` | Generic\<TState, TEvent\> | Consistency Boundary | `EventStore` | `afterCommand`, `applyEvent` | Snapshots |
| **Query** | `BaseQueryController` | Generic\<Env, Ctx, Projection\> | Optimized Reads | `BaseQueryProjection` (RCSM) | `beforeFetch`, `afterFetch` | Formatters |
| **Query** | `BaseQueryProjection` | Generic\<TEntity\> | View Model Updates | `BasePersistence` | `onEvent`, `rebuild` | Materialized Views |
| **View** | `BaseView` | Generic\<TProps\> | JSX Rendering | (data receiver) | `render` | Layouts |
| **View** | `BaseLayout` | Generic\<TData\> | HTML Layout | `BaseView` | `render` | CSS/JS |
| **Infra** | `BaseInfrastructureAdapter` | Generic\<TPort\> | Port Implementation | `BasePort` | `onConnect`, `onDisconnect` | Circuit Breakers |
| **Infra** | `BasePersistence` | - | Data Access Driver | Driver SDKs | `onQuery`, `onTransaction` | Pooling |
| **Microkernel** | `BaseGlobalPlugin` | - | Aspect-Oriented | ALL layers | `onInit`, `aroundFeature` | Telemetry |
| **Shared** | `BaseSharedKernel` | - | Language of System | (used by all) | Immutable | Value Objects |

**Note**: RCSM layers (Controller → Service → Model → Persistence) follow the Rails pattern: **one call per layer only**. FeatureHandler is the orchestration layer and can call multiple RCSM chains.

---

## Directory Structure

```
app/
├── contexts/
│   └── sales/                        # BOUNDED CONTEXT
│       ├── module.ts                 # MODULE: onLoad/onUnload, Dependency Manifest
│       │
│       ├── api/                     # [ADAPTERS IN - TIER 1]
│       │   ├── rpc/
│       │   │   └── orders.rpc.ts     # Frontend -> Feature
│       │   └── events/
│       │       └── order-placed.ts   # Integration Events (Context -> World)
│       │
│       ├── features/                 # [APPLICATION] Task Orchestration
│       │   └── place-order/
│       │       ├── contract.ts       # Service Contract (Request/Response types)
│       │       ├── handler.ts      # Lifecycle: validate -> prepare -> execute -> finalize
│       │       ├── validator.ts   # Local Logic (e.g., age check)
│       │       └── hooks.ts       # Feature plugin points
│       │
│       ├── core/                    # [DOMAIN] The "Inner Circle"
│       │   ├── commands/            # THE RCSM ENGINE (Writes)
│       │   │   ├── rpc/            # TIER 2 RPC: Feature -> Controller
│       │   │   ├── controllers/   # BaseController, BaseResourceController
│       │   │   ├── services/      # BaseService
│       │   │   ├── models/        # BaseModel<TTable, Entity, NewEntity>
│       │   │   └── aggregates/   # BaseAggregate
│       │   │
│       │   ├── queries/            # THE CQRS ENGINE (Reads)
│       │   │   ├── projections/  # BaseQueryProjection
│       │   │   └── controllers/   # BaseQueryController
│       │   │
│       │   ├── events/           # Domain Events (Internal only)
│       │   └── ports/            # Outbound Interfaces
│       │       └── i-gateway.ts
│       │
│       └── infrastructure/       # [ADAPTERS OUT]
│           ├── persistence/       # BasePersistence (D1/EventStore)
│           └── gateways/         # BaseInfrastructureAdapter
│
├── plugins/                       # MICRO-KERNEL (Cross-cutting)
│   ├── global/                   # BaseGlobalPlugin: Auth, Logging, Telemetry
│   │   ├── auth-plugin.ts
│   │   └── audit-plugin.ts
│   └── registry.ts               # Plugin execution engine
│
└── shared-kernel/                # PURE TYPES: BaseSharedKernel
    ├── money.ts
    ├── customer-id.ts
    └── validation-rules.ts
```

### Maps to Existing Nomo Packages

| Directory | Package | Base Classes |
| :--- | :--- | :--- |
| `core/commands/controllers` | `nomo/controllers` | `BaseController`, `BaseResourceController` |
| `core/commands/services` | `nomo/services` | `BaseService` |
| `core/commands/models` | `nomo/models` | `BaseModel` |
| `core/queries/controllers` | `nomo/controllers` | `BaseQueryController` |
| `core/queries/projections` | `nomo/models` | `BaseQueryProjection` |
| `api/rpc` | `nomo/rpc` | `BaseRpcServer`, `BaseRpc` |
| `api/events` | `nomo/events` | `BaseIntegrationEvent` |
| - | `nomo/views` | `BaseView`, `BaseLayout` |
| - | `nomo/validators` | `BaseValidator` |
| - | `nomo/normalizers` | `BaseNormalizer` |
| `infrastructure/persistence` | `nomo/sql` | `BasePersistence` |
| `plugins/global` | `nomo/plugins` | `BaseGlobalPlugin` |

### Convention Over Configuration

- **Auto-routing**: If a file exists in `/features/place-order/handler.ts`, the BaseRpcServer automatically routes the placeOrder RPC call to it. No manual routing tables.
- **Auto-hooks**: BaseModel automatically looks for beforeSave methods. If they exist, they run. If not, the flow continues (Null Implementation).
- **Double-Gate RPC**: Tier 1 RPC (public) delegates to Feature, which calls Tier 2 RPC (secure vault) before reaching Controllers.

---

## The "Standard Gauge" Execution Path

A developer learning the system only needs to memorize this movement:

```
Request enters BaseRpcServer (Tier 1)
        ↓
Global Plugins trigger (e.g., BaseGlobalPlugin.onInit)
        ↓
Feature triggers BaseFeatureHandler.validate()
        ↓
Feature calls Internal RPC (BaseRpc - Tier 2)
        ↓
RCSM Engine fires: Controller → Service → Model
        ↓
Persistence hits BasePersistence
        ↓
Events fire: BaseIntegrationEvent notifies other contexts
```

## Base + Resource Pattern

Nomo uses a **Base + Resource** inheritance hierarchy with strong generics. The Base provides core functionality, while Resource extends with domain-specific capabilities.

### Connection Flow Rules

The Standard Gauge enforces a **strict one-way flow**. Here's what each layer can call:

```
RpcServer → FeatureHandler → Rpc (Tier 2) → Controller → Service → Model → Persistence
                                        ↓
                              (writes)           (reads)
                                        ↓
                                  QueryController → Projection → View
```

| Layer | Can Call | Cannot Call |
| :--- | :--- | :--- |
| **Controller** | Service | Model directly |
| **Service** | Model | Controller |
| **Model** | Persistence | Service |
| **FeatureHandler** | Controller (via Rpc) | Service, Model |
| **RpcServer** | FeatureHandler | Controller, Service, Model |

---

### BaseController<TEnv, TCtx, TService, TModel, TEntity, TNewEntity>

The foundation for all controllers.

**Connection**: This layer → Service (only)

**References**: RCSM pattern - Controller calls ONE service only.

```typescript
// Generic signature
export class BaseController<
  TEnv,              // Environment (Cloudflare bindings)
  TCtx,              // Router context
  TService extends BaseService<TEnv, TCtx, any, any>,
  TModel extends BaseModel<any, any, any>,
  TEntity,
  TNewEntity
> {
  protected request: Request;
  protected env: TEnv;
  protected ctx: TCtx;
  protected service: TService;

  // REFERENCE - the ONE service this controller manages (RCSM pattern)
  protected postsService!: TService;

  // Constructor (expected input)
  constructor(request: Request, env: TEnv, ctx: TCtx) {
    this.request = request;
    this.env = env;
    this.ctx = ctx;
    this.service = this.getService();
  }

  // Abstract - must be implemented
  protected getService(): TService;

  // Accessors
  protected params;        // All params (path + query + body)
  protected pathParams;    // URL path parameters
  protected queryParams;  // Query string parameters
  protected headers;      // Request headers
  protected cookies;     // Parsed cookies
  protected body;        // Parsed body

  // Static plugin points
  static beforeActions: Array<{ normalize?: any; validate?: any; only?: string[]; except?: string[] }> = [];
  static afterActions: Array<{ after?: (result: any) => Promise<any>; only?: string[] }> = [];

  // Lifecycle hooks
  async beforeAction() {}  // Called before any action
  async afterAction() {}   // Called after any action

  // Response helpers
  json(data: any, options?: { status?: number }): Response;
  text(content: string): Response;
  html(content: string): Response;
  redirect_to(path: string): Response;
  render(view: any, data: any): Response;
}
```

### BaseResourceController extends BaseController

Extends `BaseController` with automatic RESTful CRUD operations and lifecycle actions.

```typescript
// Generic: adds Entity types for resource operations
export class BaseResourceController<
  TEnv,
  TCtx,
  TService extends BaseService<TEnv, TCtx, any, any>,
  TModel extends BaseModel<any, any, any>,
  TEntity,
  TNewEntity
> extends BaseController<TEnv, TCtx, TService, TModel, TEntity, TNewEntity> {

  // Automatic REST Actions
  async index(params?): Promise<Response>      // GET    - List all resources
  async show(id): Promise<Response>           // GET    - Get single resource
  async new(): Promise<Response>           // GET    - Form for new resource
  async create(): Promise<Response>         // POST   - Create resource
  async edit(id): Promise<Response>         // GET    - Form for editing
  async update(id): Promise<Response>       // PUT/PATCH - Update resource
  async destroy(id): Promise<Response>       // DELETE - Delete resource

  // Lifecycle Actions (soft/hard deletes, visibility, flags)
  async trash(id)       // Soft delete - sets deleted_at timestamp
  async restore(id)    // Restore from soft delete
  async hide(id)        // Hide resource from lists
  async unhide(id)      // Unhide resource
  async flag(id)       // Flag for review
  async unflag(id)     // Remove flag
  async purge(id)      // Hard delete - permanent removal
  async retire(id)    // Mark as retired
  async unretire(id)  // Unretire

  // Relationship Actions
  async listChildIds(parentId: string): Promise<string[]>
  async listParentIds(childId: string): Promise<string[]>
  async listSiblingIds(id: string): Promise<string[]>
  async listAncestorIds(id: string): Promise<string[]>
  async listDescendantIds(id: string): Promise<string[]>

  // Eager Loading
  async findAllWith(...relations: string[]): Promise<TEntity[]>
  async findWith(id: string, ...relations: string[]): Promise<TEntity>
}
```

### BaseService<TEnv, TCtx, TModel, TEntity>

The service layer with database access.

**Connection**: This layer → Model (only)

**References**: RCSM pattern - Service calls ONE model only.

```typescript
export class BaseService<
  TEnv,
  TCtx,
  TModel extends BaseModel<any, any, any>,
  TEntity
> {
  protected req: Request;
  protected env: TEnv;
  protected ctx: TCtx;
  protected logger: Logger;
  protected db: D1Database;
  protected model!: TModel;

  // REFERENCE - the ONE model this service manages (RCSM pattern)
  public posts!: TModel;

  // Constructor (expected input)
  constructor(req: Request, env: TEnv, ctx: TCtx) {
    this.req = req;
    this.env = env;
    this.ctx = ctx;
    this.logger = new Logger(ctx, this.constructor.name);
    this.db = env.DB as D1Database;
  }

  // Abstract - implement to return Model instance
  protected getModel(): TModel {
    throw new Error('Must be implemented');
  }

  // Static plugin points
  static beforeCreates: Array<(data: any) => Promise<any>> = [];
  static afterCreates: Array<(entity: any) => Promise<void>> = [];
  static beforeUpdates: Array<(id: string, data: any) => Promise<any>> = [];
  static afterUpdates: Array<(entity: any) => Promise<void>> = [];
  static beforeDeletes: Array<(id: string) => Promise<void>> = [];
  static afterDeletes: Array<(id: string) => Promise<void>> = [];

  // Lifecycle hooks
  async beforeCreate(data: any): Promise<any>
  async afterCreate(entity: TEntity): Promise<void>
  async beforeUpdate(id: string, data: Partial<TEntity>): Promise<Partial<TEntity>>
  async afterUpdate(entity: TEntity): Promise<void>
  async beforeDelete(id: string): Promise<void>
  async afterDelete(id: string): Promise<void>

  // HTTP fetching (external calls)
  protected async fetch(
    input: string | Request | URL,
    init?: RequestInit
  ): Promise<Response>

  // Create child context for nested operations
  protected createServiceContext(
    serviceName: string,
    metadata?: Record<string, any>
  ): TCtx
}
```

**Real-World Usage**:

```typescript
import { BaseService } from "nomo/services";
import { PostModel } from "../models/post";

export class BlogService extends BaseService<Env, RouterContext, PostModel, Post> {
  public posts: PostModel;

  constructor(req: Request, env: Env, ctx: RouterContext) {
    super(req, env, ctx);
    this.posts = new PostModel(this.db, this.req, this.env, this.ctx);
  }
}
```

### BaseModel<TTable, TEntity, TNewEntity>

The model layer with Drizzle ORM support and fluent query API.

**Connection**: This layer → Persistence (only)

**References**: RCSM pattern - uses ONE persistence driver only.

```typescript
export class BaseModel<
  TTable,          // Drizzle table definition
  TEntity,        // Select type (inferred)
  TNewEntity      // Insert type (inferred)
> {
  protected db: any;           // Database instance (D1)
  protected table: TTable;     // Drizzle table definition
  protected alias?: string;     // Table alias for joins
  protected req?: Request;
  protected env?: any;
  protected ctx?: any;

  // REFERENCE - the ONE persistence driver (RCSM pattern)
  protected d1!: D1Database;

  // Constructor (expected input)
  constructor(db: any, req: Request, env: any, ctx: any) {
    this.db = db;
    this.req = req;
    this.env = env;
    this.ctx = ctx;
  }

  // Static plugin points
  static beforeSaves: Array<(model: any) => Promise<any>> = [];
  static afterSaves: Array<(model: any) => Promise<void>> = [];
  static beforeCreates: Array<(data: any) => Promise<any>> = [];
  static afterCreates: Array<(model: any) => Promise<void>> = [];
  static beforeUpdates: Array<(id: string, data: any) => Promise<any>> = [];
  static afterUpdates: Array<(model: any) => Promise<void>> = [];
  static beforeDeletes: Array<(id: string) => Promise<void>> = [];
  static afterDeletes: Array<(id: string) => Promise<void>> = [];
  static beforeTrashes: Array<(id: string) => Promise<void>> = [];
  static afterRestores: Array<(id: string) => Promise<void>> = [];

  // Fluent Query API
  query(): QueryBuilder<TTable, TEntity>;
  where(conditions: WhereConditions): QueryBuilder<TTable, TEntity>;
  whereId(id: string): QueryBuilder<TTable, TEntity>;
  select(...columns: string[]): QueryBuilder<TTable, TEntity>;
  orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder<TTable, TEntity>;
  limit(n: number): QueryBuilder<TTable, TEntity>;
  offset(n: number): QueryBuilder<TTable, TEntity>;
  page(page: number, perPage: number): QueryBuilder<TTable, TEntity>;

  // Operators
  // { eq: 'value' }, { neq: 'value' }, { gt: n }, { gte: n }, { lt: n }, { lte: n }
  // { like: '%pattern%' }, { in: [a, b] }, { nin: [a, b] }, { null: true }

  // CRUD
  async create(data: TNewEntity): Promise<TEntity>;
  async findById(id: string): Promise<TEntity | null>;
  async findByIds(ids: string[]): Promise<TEntity[]>;
  async all(): Promise<TEntity[]>;
  async first(): Promise<TEntity | null>;
  async count(): Promise<number>;
  async exists(): Promise<boolean>;
  async update(id: string, data: Partial<TNewEntity>): Promise<TEntity>;
  async delete(id: string): Promise<void>;

  // Lifecycle Actions
  async trash(id: string): Promise<void>     // Soft delete
  async restore(id: string): Promise<void> // Restore
  async purge(id: string): Promise<void> // Hard delete

  // Relationships
  hasMany(name: string, config: RelationshipConfig): void;
  belongsTo(name: string, config: RelationshipConfig): void;
  hasOne(name: string, config: RelationshipConfig): void;

  // Joins
  join(table: any, on: string): QueryBuilder<TTable, TEntity>;
  leftJoin(table: any, on: string): QueryBuilder<TTable, TEntity>;
}
```

**Real-World Usage**:

```typescript
import { BaseModel } from "nomo/models";
import { posts } from "../db/schema/schema";

export class PostModel extends BaseModel<typeof posts, Post, NewPost> {
  constructor(db: D1Database, req: Request, env: Env, ctx: any) {
    super(db, req, env, ctx);
  }
}
```

### BaseView<TProps>

JSX-based view rendering.

```typescript
export class BaseView<TProps> {
  protected props: TProps;
  render(): JSX.Element;
}

export class BaseLayout<TData> {
  render(content: string, data: TData): JSX.Element;
}
```

---

## Layer Details with Full Generics

### BaseContext

The bounded context "container" that hosts multiple modules.

**Connection**: This layer → Module (only)

```typescript
export class BaseContext {
  protected modules: Map<string, BaseModule> = new Map();
  protected config: Record<string, any>;
  protected env: any;
  protected ctxName: string;

  // Constructor (expected input)
  constructor(config: Record<string, any>, env?: any) {
    this.config = config;
    this.env = env;
    this.modules = new Map();
  }

  // Static plugin points
  static onSetups: Array<(ctx: any) => Promise<void>> = [];
  static onTeardowns: Array<(ctx: any) => Promise<void>> = [];
  static contextConfigs: Record<string, any> = {};

  // Lifecycle
  async onSetup(): Promise<void>      // Initialize context
  async onTeardown(): Promise<void>   // Cleanup

  // Module management
  async loadModule(name: string, module: BaseModule): Promise<void>
  async unloadModule(name: string): Promise<void>
  getModule<T extends BaseModule>(name: string): T | undefined
  getModuleNames(): string[]

  // Config
  getConfig(key: string, fallback?: any): any
  setConfig(key: string, value: any): void

  // Get context name
  getName(): string
}
```

### BaseModule

Autoloading and dependency registry.

**Connection**: This layer → FeatureHandler (only)

```typescript
export class BaseModule {
  protected features: Map<string, FeatureHandler> = new Map();
  protected plugins: Map<string, BasePlugin> = new Map();
  protected env!: any;
  protected moduleName: string;

  // Constructor (expected input)
  constructor(env?: any, moduleName?: string) {
    this.env = env;
    this.moduleName = moduleName || this.constructor.name;
    this.features = new Map();
    this.plugins = new Map();
  }

  // Static plugin points
  static onLoads: Array<(module: any) => Promise<void>> = [];
  static onUnloads: Array<(module: any) => Promise<void>> = [];
  static autoDiscovers: Array<string> = [];   // Auto-discover features from folder
  static middlewares: Array<any> = [];        // Module-level middleware

  // Lifecycle
  async onLoad(): Promise<void>      // Register features & plugins
  async onUnload(): Promise<void>     // Cleanup registrations

  // Feature registration
  registerFeature<T extends FeatureHandler>(
    name: string,
    handler: new (...args: any[]) => T
  ): void
  getFeature<T extends FeatureHandler>(name: string): T | undefined
  getFeatureNames(): string[]

  // Plugin registration
  registerPlugin<T extends BasePlugin>(
    name: string,
    plugin: T
  ): void
  getPlugin<T extends BasePlugin>(name: string): T | undefined
}
```

### BaseRpcServer<TEnv, TCtx>

Tier 1: Public entrance - maps frontend to features.

**Connection**: This layer → FeatureHandler (only)

**References**: BaseRpcServer maps to ONE or more FeatureHandlers based on the route.

```typescript
// Generic: Env (Cloudflare bindings), Ctx (Router context)
export class BaseRpcServer<
  TEnv,              // Environment (Cloudflare bindings)
  TCtx               // Router context
> {
  protected env: TEnv;
  protected ctx: TCtx;
  protected routes: Map<string, FeatureHandler> = new Map();

  // REFERENCES - features this RPC server can route to
  protected placeOrderFeature!: BaseFeatureHandler<PlaceOrderInput, PlaceOrderOutput>;
  protected cancelOrderFeature!: BaseFeatureHandler<CancelOrderInput, void>;
  protected getOrderFeature!: BaseFeatureHandler<GetOrderInput, Order>;
  protected listOrdersFeature!: BaseFeatureHandler<ListOrdersInput, Order[]>;
  protected registerUserFeature!: BaseFeatureHandler<RegisterUserInput, User>;

  // Constructor (expected input)
  constructor(env: TEnv, ctx?: TCtx) {
    this.env = env;
    this.ctx = ctx;
  }

  // Static plugin points
  static beforeRouting: Array<(input: any) => Promise<any>> = [];
  static afterRouting: Array<(output: any) => Promise<void>> = [];
  static rateLimits: Record<string, RateLimitConfig> = {};
  static authenticators: Array<(input: any) => Promise<AuthResult>> = [];

  // Lifecycle
  async onInbound(input: any): Promise<any>      // Handle incoming RPC
  async onOutbound(output: any): Promise<void>    // Handle outgoing

  // Routing - auto-discovers features
  registerRoute<T extends BaseFeatureHandler<any, any>>(
    method: string,
    path: string,
    handler: new (...args: any[]) => T
  ): void
  routeToFeature(featureName: string, input: any): Promise<any>

  // Routing lookup
  protected getRoute(method: string, path: string): FeatureHandler | undefined;
  protected resolveHandler(method: string, path: string): BaseFeatureHandler<any, any> | undefined;

  // Global hooks
  async beforeRoute(input: any): Promise<void>   // Rate limiting, auth
  async afterRoute(output: any): Promise<void>  // Logging
}
```

### BaseRpc<TInput, TOutput>

Tier 2: Internal gate between Feature and Controller.

**Connection**: This layer → Controller (only)

**References**: RCSM pattern - dispatches to ONE controller only.

```typescript
// Generic: Input and Output types
export class BaseRpc<
  TInput,
  TOutput
> {
  protected input: TInput;
  protected output?: TOutput;

  // REFERENCE - the ONE controller this RPC routes to (RCSM pattern)
  protected ordersController!: BaseController<any, any, any, any, any, any>;

  // Constructor (expected input)
  constructor(input: TInput) {
    this.input = input;
  }

  // Static plugin points
  static beforeDispatch: Array<(input: any) => Promise<any>> = [];
  static afterDispatch: Array<(output: any) => Promise<void>> = [];
  static auditLogs: Array<(input: any, output: any) => Promise<void>> = [];

  // Lifecycle
  async beforeDispatch(input: TInput): Promise<TInput>    // Validate, audit
  async afterDispatch(output: TOutput): Promise<void>    // Audit logs

  // Dispatch to controller
  async dispatch<TController extends BaseController<any, any, any, any, any, any>>(
    controller: new (...args: any[]) => TController,
    action: string,
    params: any
  ): Promise<any>

  // Error handling
  async onError(error: Error): Promise<void>
}
```

### BaseRpc<TInput, TOutput>

Tier 2: Internal gate between Feature and Controller.

```typescript
// Generic: Input and Output types
export class BaseRpc<
  TInput,
  TOutput
> {
  protected input: TInput;
  protected output?: TOutput;

  // Lifecycle
  async beforeDispatch(input: TInput): Promise<TInput>    // Validate
  async afterDispatch(output: TOutput): Promise<void>    // Audit logs

  // Dispatch to controller
  async dispatch<TController extends BaseController<any, any, any, any, any, any>>(
    controller: new (...args: any[]) => TController,
    action: string,
    params: any
  ): Promise<any>

  // Error handling
  async onError(error: Error): Promise<void>
}
```

### BaseFeatureHandler<TInput, TOutput>

The orchestrator with validate → prepare → execute → finalized lifecycle.

**Connection**: This layer → Tier 2 Rpc (only)

**References**: FeatureHandler can call multiple BaseRpc instances to orchestrate workflows.

**Important**: For a developer to call Service or Model, they must go through BaseRpc (Tier 2) which then routes to Controller → Service → Model.

```typescript
// Generic: Input and Output types
export class BaseFeatureHandler<
  TInput,
  TOutput
> {
  protected input!: TInput;
  protected output?: TOutput;
  protected env!: any;
  protected ctx!: any;

  // REFERENCES - what this layer can call (Tier 2 Rpc)
  protected ordersRpc!: BaseRpc<CreateOrderInput, Order>;
  protected paymentsRpc!: BaseRpc<ChargeInput, Charge>;
  protected inventoryRpc!: BaseRpc<DecrementInput, Inventory>;
  protected usersRpc!: BaseRpc<GetUserInput, User>;
  protected authorsRpc!: BaseRpc<GetAuthorInput, Author>;

  // Constructor (expected input)
  constructor(input: TInput, env: any, ctx?: any) {
    this.input = input;
    this.env = env;
    this.ctx = ctx;
  }

  // Abstract - implement to return Rpc references
  protected getRpc<T extends BaseRpc<any, any>>(name: string): T;

  // Static plugin points
  static beforeExecutes: Array<(input: TInput) => Promise<void>> = [];
  static afterExecutes: Array<(output: TOutput) => Promise<void>> = [];
  static validators: Array<(input: TInput) => Promise<void>> = [];
  static plugins: Array<FeaturePlugin> = [];

  // The 4-Phase Lifecycle (convention)
  async validate(input: TInput): Promise<void>      // Business rule validation
  async prepare(input: TInput): Promise<any>   // Gather data from sources
  async execute(prepared: any): Promise<TOutput>  // Core logic
  async finalize(output: TOutput): Promise<void> // Emit events, side effects

  // Hooks
  async beforeExecute(input: TInput): Promise<void>
  async afterExecute(output: TOutput): Promise<void>
  async onError(error: Error): Promise<void>

  // Internal RPC (Tier 2) - ONLY way to call Controller
  async internalRpc(
    rpcName: string,
    input: any
  ): Promise<any>

  // Run the complete flow
  async run(input: TInput): Promise<TOutput> {
    await this.beforeExecute(input);
    await this.validate(input);
    const prepared = await this.prepare(input);
    const output = await this.execute(prepared);
    await this.finalize(output);
    await this.afterExecute(output);
    return output;
  }

  // Events (internal)
  protected events = {
    emit: async (eventName: string, payload: any) => { /* emit internally */ },
    dispatch: async (eventName: string, payload: any) => { /* dispatch */ }
  };
}
```

**Real-World Usage**:

```typescript
import { BaseResourceController } from 'nomo/controllers';
import { PostsValidator } from '../validators/posts';
import { PostsNormalizer } from '../normalizers/posts';

export class PostsController extends BaseResourceController<...> {
  // Static plugin points for validation/normalization
  static beforeActions = [
    {
      normalize: PostsNormalizer,
      only: ['create', 'update']
    },
    {
      validate: PostsValidator,
      only: ['create']
    }
  ];
}
```

### BaseController<TEnv, TCtx, TService, TModel, TEntity, TNewEntity>

**The Manager** (C in RCSM).

```typescript
// Generic signature
export class BaseController<
  TEnv,              // Environment (Cloudflare bindings)
  TCtx,              // Router context
  TService extends BaseService<TEnv, TCtx, any, any>,
  TModel extends BaseModel<any, any, any>,
  TEntity,
  TNewEntity
> {
  protected request: Request;
  protected env: TEnv;
  protected ctx: TCtx;
  protected service: TService;

  // Accessors
  protected params!: Record<string, any>;        // All params
  protected pathParams!: Record<string, string>;    // URL path params
  protected queryParams!: Record<string, string>;  // Query string
  protected headers!: Record<string, string>;        // Headers
  protected cookies!: Record<string, string>;      // Parsed cookies
  protected body!: any;                         // Parsed body
  protected ip!: string;                       // Client IP

  // Response helpers
  json(data: any, options?: { status?: number }): Response;
  text(content: string, options?: { status?: number }): Response;
  html(content: string, options?: { status?: number }): Response;
  xml(content: string, options?: { status?: number }): Response;
  csv(content: string, options?: { status?: number }): Response;
  redirect_to(path: string, options?: { status?: number }): Response;
  render(view: any, data: any): Response;

  // Cookie helpers
  setCookie(name: string, value: string, options?: CookieOptions): Response;
  deleteCookie(name: string): Response;

  // Error responses
  notFound(message?: string): Response;
  unauthorized(message?: string): Response;
  forbidden(message?: string): Response;
  badRequest(message?: string): Response;
  internalServerError(message?: string): Response;

  // Lifecycle hooks
  async beforeAction(): Promise<void>
  async afterAction(result?: any): Promise<void>
}
```

### BaseResourceController<TEnv, TCtx, TService, TModel, TEntity, TNewEntity>

Extends `BaseController` with automatic RESTful CRUD operations and lifecycle actions.

**Connection**: This layer → Service (only)

**References**: RCSM pattern - calls ONE service only.

```typescript
// Generic: adds Entity types for resource operations
export class BaseResourceController<
  TEnv,
  TCtx,
  TService extends BaseService<TEnv, TCtx, any, any>,
  TModel extends BaseModel<any, any, any>,
  TEntity,
  TNewEntity
> extends BaseController<TEnv, TCtx, TService, TModel, TEntity, TNewEntity> {

  // REFERENCE - the ONE service this controller manages (RCSM pattern)
  protected ordersService!: TService;

  // Constructor (expected input)
  constructor(request: Request, env: TEnv, ctx: TCtx) {
    super(request, env, ctx);
    this.service = this.getService();
  }

  // Abstract - implement to return Model
  protected getModel(): TModel;

  // Static plugin points
  static beforeActions = [
    {
      normalize: BaseNormalizer,
      only: ['create', 'update', 'patch']
    },
    {
      validate: BaseValidator,
      only: ['create', 'update', 'patch']
    }
  ];

  static afterActions = [
    {
      serialize: BaseSerializer,
      only: ['index', 'show', 'create', 'update']
    }
  ];

  // Automatic REST Actions
  async index(params?): Promise<Response>      // GET    - List all resources
  async show(id): Promise<Response>           // GET    - Get single resource
  async new(): Promise<Response>           // GET    - Form for new resource
  async create(): Promise<Response>         // POST   - Create resource
  async edit(id): Promise<Response>         // GET    - Form for editing
  async update(id): Promise<Response>       // PUT/PATCH - Update resource
  async destroy(id): Promise<Response>       // DELETE - Delete resource

  // Lifecycle Actions (soft/hard deletes, visibility, flags)
  async trash(id)       // Soft delete - sets deleted_at timestamp
  async restore(id)    // Restore from soft delete
  async hide(id)        // Hide resource from lists
  async unhide(id)      // Unhide resource
  async flag(id)       // Flag for review
  async unflag(id)     // Remove flag
  async purge(id)      // Hard delete - permanent removal
  async retire(id)    // Mark as retired
  async unretire(id)  // Unretire

  // Relationship Actions
  async listChildIds(parentId: string): Promise<string[]>
  async listParentIds(childId: string): Promise<string[]>
  async listSiblingIds(id: string): Promise<string[]>
  async listAncestorIds(id: string): Promise<string[]>
  async listDescendantIds(id: string): Promise<string[]>

  // Eager Loading
  async findAllWith(...relations: string[]): Promise<TEntity[]>
  async findWith(id: string, ...relations: string[]): Promise<TEntity>
}
```

### BaseService<TEnv, TCtx, TModel, TEntity>

**The Worker** (S in RCSM).

```typescript
export class BaseService<
  TEnv,
  TCtx,
  TModel extends BaseModel<any, any, any>,
  TEntity
> {
  protected req: Request;
  protected env: TEnv;
  protected ctx: TCtx;
  protected logger: Logger;
  protected db: D1Database;

  // Access to model
  protected model!: TModel;

  // Lifecycle hooks
  async beforeCreate(data: any): Promise<any>
  async afterCreate(entity: TEntity): Promise<void>
  async beforeUpdate(id: string, data: any): Promise<any>
  async afterUpdate(entity: TEntity): Promise<void>
  async beforeDelete(id: string): Promise<void>
  async afterDelete(id: string): Promise<void>

  // HTTP fetching
  protected async fetch(
    input: string | Request | URL,
    init?: RequestInit
  ): Promise<Response>

  // Service context
  protected createServiceContext(
    serviceName: string,
    metadata?: Record<string, any>
  ): TCtx
}
```

### BaseModel<TTable, TEntity, TNewEntity>

**The State** (M in RCSM).

```typescript
export class BaseModel<
  TTable,      // Drizzle table definition
  TEntity,    // Select type
  TNewEntity  // Insert type
> {
  protected db: any;           // Database instance
  protected table: TTable;     // Table definition
  protected alias?: string;      // Table alias for joins

  // Fluent Query API
  query(): QueryBuilder<TTable, TEntity>
  where(conditions: WhereConditions): QueryBuilder<TTable, TEntity>
  whereId(id: string): QueryBuilder<TTable, TEntity>
  select(...columns: string[]): QueryBuilder<TTable, TEntity>
  orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder<TTable, TEntity>
  limit(n: number): QueryBuilder<TTable, TEntity>
  offset(n: number): QueryBuilder<TTable, TEntity>
  page(page: number, perPage: number): QueryBuilder<TTable, TEntity>

  // Query Operators
  // { eq: 'value' }, { neq: 'value' }, { gt: n }, { gte: n }, { lt: n }, { lte: n }
  // { like: '%pattern%' }, { in: [a, b] }, { nin: [a, b] }, { null: true }

  // CRUD Methods
  async create(data: TNewEntity): Promise<TEntity>
  async findById(id: string): Promise<TEntity | null>
  async findByIds(ids: string[]): Promise<TEntity[]>
  async all(): Promise<TEntity[]>
  async first(): Promise<TEntity | null>
  async count(): Promise<number>
  async exists(): Promise<boolean>
  async update(id: string, data: Partial<TNewEntity>): Promise<TEntity>
  async delete(id: string): Promise<void>

  // Lifecycle Actions
  async trash(id: string): Promise<void>     // Soft delete
  async restore(id: string): Promise<void>   // Restore
  async purge(id: string): Promise<void>   // Hard delete

  // Relationships
  hasMany(name: string, config: RelationshipConfig): void
  belongsTo(name: string, config: RelationshipConfig): void
  hasOne(name: string, config: RelationshipConfig): void

  // Joins
  join(table: TTable, on: string): QueryBuilder<TTable, TEntity>
  leftJoin(table: TTable, on: string): QueryBuilder<TTable, TEntity>
}
```

### BaseAggregate<TState, TEvent>

Consistency boundary for event sourcing.

**Connection**: This layer → Event Store (only)

```typescript
export class BaseAggregate<
  TState,
  TEvent
> {
  protected id!: string;
  protected version: number = 0;
  protected state!: TState;
  protected events: TEvent[] = [];
  protected env!: any;
  protected ctx!: any;

  // Constructor (expected input)
  constructor(id: string, env?: any, ctx?: any) {
    this.id = id;
    this.env = env;
    this.ctx = ctx;
  }

  // Static plugin points
  static commandHandlers: Array<(aggregate: any, command: any) => Promise<any>> = [];
  static eventAppliers: Array<(event: TEvent) => Promise<void>> = [];
  static snapshotTriggers: Array<(version: number) => boolean> = [];

  // Command methods
  apply(event: TEvent): void     // Apply event to state
  commit(): TEvent[]             // Get committed events

  // Lifecycle
  async afterCommand(): Promise<void>    // Save events to store
  async applyEvent(event: TEvent): void  // Apply event to state

  // State rebuilding
  static async load(id: string): Promise<BaseAggregate<TState, TEvent>>
  static async loadFromSnapshot(id: string): Promise<BaseAggregate<TState, TEvent>>

  // Snapshot
  async createSnapshot(): Promise<void>
  static async fromSnapshot(snapshot: any): BaseAggregate<TState, TEvent>
}
```

### BaseQueryController<TEnv, TCtx, TProjection>

Optimized "fast-path" reads.

**Connection**: This layer → Projection (only)

**References**: RCSM pattern - calls ONE projection only.

```typescript
export class BaseQueryController<
  TEnv,
  TCtx,
  TProjection extends BaseQueryProjection<any>
> {
  protected env: TEnv;
  protected ctx: TCtx;
  protected projection!: TProjection;

  // REFERENCE - the ONE projection this controller manages (RCSM pattern)
  public orderListProjection!: TProjection;

  // Constructor (expected input)
  constructor(env: TEnv, ctx: TCtx) {
    this.env = env;
    this.ctx = ctx;
    this.projection = this.getProjection();
  }

  // Abstract - implement to return Projection
  protected getProjection(): TProjection;

  // Static plugin points
  static beforeFetches: Array<(query: any) => Promise<any>> = [];
  static afterFetches: Array<(result: any) => Promise<any>> = [];
  static outputFormats: Array<(result: any) => Promise<any>> = [];

  // Lifecycle
  async beforeFetch(query: any): Promise<any>
  async afterFetch(result: any): Promise<any>

  // Query methods
  async getById(id: string): Promise<any>
  async getByIds(ids: string[]): Promise<any[]>
  async list(params?: QueryParams): Promise<any[]>
  async paginate(page: number, perPage: number): Promise<PaginatedResult>
}
```

### BaseQueryProjection<TEntity>

Hydrating view models from events.

**Connection**: This layer → Persistence (only)

```typescript
export class BaseQueryProjection<
  TEntity
> {
  protected db: any;
  protected tableName: string;
  protected req?: Request;
  protected env?: any;
  protected ctx?: any;

  // Constructor (expected input)
  constructor(db: any, req?: Request, env?: any, ctx?: any) {
    this.db = db;
    this.req = req;
    this.env = env;
    this.ctx = ctx;
  }

  // Static plugin points
  static eventHandlers: Array<(event: any) => Promise<void>> = [];
  static rebuildTriggers: Array<(entityId: string) => Promise<void>> = [];

  // Event handling
  async onEvent(event: any): Promise<void>   // Handle event
  async rebuild(entityId: string): Promise<void>  // Rebuild from events

  // Projection methods
  async upsert(id: string, data: Partial<TEntity>): Promise<void>
  async update(id: string, data: Partial<TEntity>): Promise<void>
  async delete(id: string): Promise<void>
  async findById(id: string): Promise<TEntity | null>
  async findByIds(ids: string[]): Promise<TEntity[]>
  async findAll(): Promise<TEntity[]>
  async findWhere(conditions: Record<string, any>): Promise<TEntity[]>

  // Materialized views
  async materialize(): Promise<void>
  async refresh(): Promise<void>
}
```

### BaseIntegrationEvent<T>

Cross-context broadcast.

**Connection**: This layer → Event Bus (only)

```typescript
export class BaseIntegrationEvent<
  T
> {
  static readonly name: string;
  static readonly version: number;
  protected eventBus: any;

  // Constructor (expected input)
  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  // Static plugin points
  static serializers: Array<(event: T) => Promise<string>> = [];
  static deserializers: Array<(data: string) => Promise<T>> = [];
  static subscribers: Array<(event: T) => Promise<void>> = [];

  // Lifecycle
  async onPublish(event: T): Promise<void>   // Publish event
  async onReceive(payload: any): Promise<T>   // Receive event
  async serialize(event: T): Promise<string> // Serialize for transport
  async deserialize(data: string): Promise<T> // Deserialize

  // Subscribe - static pattern
  static subscribe(handler: (event: T) => Promise<void>): void;
  static unsubscribe(): void;
}
```

### BaseGlobalPlugin

Aspect-oriented concerns (all contexts).

**Connection**: This layer → can intercept ALL layers (global)

```typescript
export class BaseGlobalPlugin {
  static readonly name: string;
  static readonly version: string;
  protected env!: any;

  // Constructor (expected input)
  constructor(env?: any) {
    this.env = env;
  }

  // Static plugin points - GLOBAL scope
  static onInits: Array<() => Promise<void>> = [];
  static onShutdowns: Array<() => Promise<void>> = [];

  // Around hooks (wrap ALL executions)
  static aroundFeatures: Array<(ctx: FeatureContext, next: () => Promise<any>) => Promise<any>> = [];
  static aroundControllers: Array<(ctx: ControllerContext, next: () => Promise<any>) => Promise<any>> = [];
  static aroundServices: Array<(ctx: ServiceContext, next: () => Promise<any>) => Promise<any>> = [];
  static aroundModels: Array<(ctx: ModelContext, next: () => Promise<any>) => Promise<any>> = [];

  // Before hooks
  beforeFeatureExecutes: Array<(ctx: FeatureContext) => Promise<void>> = [];
  beforeControllerActions: Array<(ctx: ControllerContext) => Promise<void>> = [];
  beforeServiceCalls: Array<(ctx: ServiceContext) => Promise<void>> = [];
  beforeModelSaves: Array<(ctx: ModelContext) => Promise<void>> = [];

  // After hooks
  afterFeatureExecutes: Array<(ctx: FeatureContext, result: any) => Promise<void>> = [];
  afterControllerActions: Array<(ctx: ControllerContext, result: any) => Promise<void>> = [];
  afterServiceCalls: Array<(ctx: ServiceContext, result: any) => Promise<void>> = [];
  afterModelSaves: Array<(ctx: ModelContext, result: any) => Promise<void>> = [];

  // Lifecycle
  async onInit(): Promise<void>        // Startup
  async onShutdown(): Promise<void>    // Cleanup

  // Around hooks (wrap execution)
  async aroundFeature(ctx: FeatureContext, next: () => Promise<any>): Promise<any>;
  async aroundController(ctx: ControllerContext, next: () => Promise<any>): Promise<any>;
  async aroundService(ctx: ServiceContext, next: () => Promise<any>): Promise<any>;
  async aroundModel(ctx: ModelContext, next: () => Promise<any>): Promise<any>;
}
```

**Real-World Usage**:

```typescript
// app/features/place-order/handler.ts
export class PlaceOrderHandler extends BaseFeatureHandler<PlaceOrderInput, PlaceOrderOutput> {
  // REFERENCES - multiple Rpc calls for orchestration
  protected ordersRpc!: BaseRpc<CreateOrderInput, Order>;
  protected paymentsRpc!: BaseRpc<ChargeInput, Charge>;
  protected inventoryRpc!: BaseRpc<DecrementInput, Inventory>;
  protected usersRpc!: BaseRpc<GetUserInput, User>;
  protected productsRpc!: BaseRpc<GetProductsInput, Product[]>;
  protected notificationsRpc!: BaseRpc<SendNotificationInput, void>;

  constructor(input: PlaceOrderInput, env: Env) {
    super(input, env);
    
    // Initialize RPC references
    this.ordersRpc = new OrdersRpc(input);
    this.paymentsRpc = new PaymentsRpc(input);
    this.inventoryRpc = new InventoryRpc(input);
    this.usersRpc = new UsersRpc(input);
    this.productsRpc = new ProductsRpc(input);
    this.notificationsRpc = new NotificationsRpc(input);
  }

  async prepare(input: PlaceOrderInput): Promise<PreparedData> {
    // Gather data using multiple RPC calls
    const user = await this.usersRpc.dispatch('show', input.userId);
    const products = await this.productsRpc.dispatch('findByIds', input.productIds);
    return { user, products };
  }

  async execute(prepared: PreparedData): PlaceOrderOutput {
    // Orchestrate multiple RCSM operations
    const order = await this.ordersRpc.dispatch('create', prepared);
    await this.paymentsRpc.dispatch('charge', { orderId: order.id, amount: order.total });
    await this.inventoryRpc.dispatch('decrement', { products: prepared.products });
    return order;
  }

  async finalize(output: PlaceOrderOutput): Promise<void> {
    await this.notificationsRpc.dispatch('send', { orderId: output.id });
  }
}
```

```typescript
// app/controllers/posts.controller.ts
import { BaseResourceController } from 'nomo/controllers';
import { PostsValidator } from '../validators/posts';
import { PostsNormalizer } from '../normalizers/posts';

export class PostsController extends BaseResourceController<...> {
  // REFERENCES - service calls
  protected postsService!: BlogService;
  protected commentsService!: CommentsService;
  protected authorsService!: AuthorsService;

  constructor(request: Request, env: Env, ctx: RouterContext) {
    super(request, env, ctx);
    this.postsService = new BlogService(request, env, ctx);
    this.commentsService = new CommentsService(request, env, ctx);
    this.authorsService = new AuthorsService(request, env, ctx);
  }

  // Static plugin points - hooks for validation/normalization
  static beforeActions = [
    {
      normalize: PostsNormalizer,
      only: ['create', 'update']
    },
    {
      validate: PostsValidator,
      only: ['create']
    }
  ];

  // ...
}
```

### BaseInfrastructureAdapter<TPort>

Port implementation (gateways).

**Connection**: This layer → Port Interface (only)

```typescript
export class BaseInfrastructureAdapter<
  TPort
> {
  protected config: Record<string, any>;
  protected client?: any;

  // Constructor (expected input)
  constructor(config: Record<string, any>) {
    this.config = config;
  }

  // Static plugin points
  static beforeConnects: Array<() => Promise<void>> = [];
  static afterDisconnects: Array<() => Promise<void>> = [];
  static circuitBreakers: CircuitBreakerConfig = {};

  // Lifecycle
  async onConnect(): Promise<void>       // Initialize
  async onDisconnect(): Promise<void>   // Cleanup

  // Circuit breaker pattern
  protected async withCircuitBreaker(
    fn: () => Promise<any>,
    options?: CircuitBreakerOptions
  ): Promise<any>
}
```

### BasePersistence

Data access driver (D1/SQLite/KV).

**Connection**: This layer → Database Driver (only)

```typescript
export class BasePersistence {
  protected driver: any;
  protected env?: any;

  // Constructor (expected input)
  constructor(env?: any) {
    this.env = env;
  }

  // Static plugin points
  static beforeQueries: Array<(sql: string, params: any[]) => Promise<any>> = [];
  static afterQueries: Array<(result: any) => Promise<any>> = [];
  static transactionLogs: Array<(fn: () => Promise<any>) => Promise<any>> = [];

  // Query lifecycle
  async onQuery(sql: string, params: any[]): Promise<any>
  async onTransaction(fn: () => Promise<any>): Promise<any>

  // Connection
  async connect(): Promise<void>
  async disconnect(): Promise<void>

  // Raw queries
  async raw(sql: string, params?: any[]): Promise<any>
  async all(sql: string, params?: any[]): Promise<any[]>
  async get(sql: string, params?: any[]): Promise<any>
  async run(sql: string, params?: any[]): Promise<{ changes: number }>
}
```

### BaseView<TProps>

JSX view rendering.

**Connection**: This layer → receives data, returns JSX

```typescript
export class BaseView<
  TProps
> {
  protected props!: TProps;

  // Constructor (expected input)
  constructor(props: TProps) {
    this.props = props;
  }

  // Static plugin points
  static beforeRenders: Array<(props: TProps) => Promise<TProps>> = [];
  static afterRenders: Array<(jsx: JSX.Element) => Promise<JSX.Element>> = [];

  // Abstract - implement in subclass
  render(): JSX.Element

  // Static children (convention)
  protected static Header: JSX.Element;
  protected static Footer: JSX.Element;
}
```

### BaseLayout<TData>

HTML layout.

**Connection**: This layer → wraps Views

```typescript
export class BaseLayout<
  TData
> {
  protected data!: TData;

  // Constructor (expected input)
  constructor(data: TData) {
    this.data = data;
  }

  // Static plugin points
  static layouts: Record<string, any> = {};
  static defaultLayout: string = 'default';

  // Core slots (convention)
  protected head(): JSX.Element;        // <head> content
  protected body(content: string): JSX.Element;  // <body> wrapper
  protected scripts(): JSX.Element;    // <script> tags
  protected styles(): JSX.Element;   // <style> tags

  // Render
  render(content: string, data: TData): JSX.Element
}
```

### BaseSharedKernel

The language of the system (immutable types).

**Connection**: This layer → used by ALL other layers (shared)

```typescript
// No generics - immutable value objects
export class BaseSharedKernel {
  // Money (immutable)
  static Money: {
    create(amount: number, currency: string): Readonly<Money>
    add(a: Money, b: Money): Money
    subtract(a: Money, b: Money): Money
    multiply(a: Money, factor: number): Money
    divide(a: Money, factor: number): Money
    zero(currency: string): Money
    isZero(money: Money): boolean
    equals(a: Money, b: Money): boolean
    format(money: Money, locale?: string): string
  }

  // CustomerId (immutable)
  static CustomerId: {
    generate(): string
    validate(id: string): boolean
    isValid(id: string): boolean
  }

  // Address (immutable)
  static Address: {
    create(data: AddressData): Readonly<Address>
    format(address: Address): string
    equals(a: Address, b: Address): boolean
    isEmpty(address: Address): boolean
  }

  // DateRange (immutable)
  static DateRange: {
    create(start: Date, end: Date): Readonly<DateRange>
    contains(range: DateRange, date: Date): boolean
    overlaps(a: DateRange, b: DateRange): boolean
    duration(range: DateRange): number // milliseconds
    isInverse(range: DateRange): boolean
  }

  // Pagination
  static Pagination: {
    create(page: number, perPage: number, total: number): Readonly<Pagination>
    fromOffset(offset: number, limit: number): Readonly<Pagination>
  }
}
```

---

## Real-World Examples

### OrdersRpcServer - Tier 1 RPC

```typescript
// app/contexts/sales/api/rpc/orders.rpc.ts
export class OrdersRpcServer extends BaseRpcServer<Env, RouterContext> {
  async onInbound(input: PlaceOrderInput) {
    return this.routeToFeature('place-order', input);
  }

  async onInbound(input: GetOrderInput) {
    return this.routeToFeature('get-order', input);
  }
}
```

### PlaceOrderHandler - Feature Handler

```typescript
// app/contexts/sales/features/place-order/handler.ts
export class PlaceOrderHandler extends BaseFeatureHandler<PlaceOrderInput, PlaceOrderOutput> {
  async validate(input: PlaceOrderInput): Promise<void> {
    if (!input.items?.length) {
      throw new ValidationError('No items in order');
    }
  }

  async prepare(input: PlaceOrderInput): Promise<PreparedData> {
    return {
      user: await userController.show(input.userId),
      products: await productController.index(input.productIds)
    };
  }

  async execute(prepared: PreparedData): PlaceOrderOutput {
    const order = await this.internalRpc('orders.create', prepared);
    await this.internalRpc('payments.charge', order);
    return order;
  }

  async finalize(output: PlaceOrderOutput): Promise<void> {
    await this.events.emit('order.placed', output);
  }
}
```

### BaseRpc (Tier 2)

Internal gate between Feature and Controller.

```typescript
// app/contexts/sales/core/commands/rpc/orders.rpc.ts
export class OrdersRpc extends BaseRpc {
  async beforeDispatch(command: any) {
    // Internal audit logs
  }
}
```

### BaseController

The Manager (C in RCSM).

```typescript
// app/contexts/sales/core/commands/controllers/orders.controller.ts
export class OrdersController extends BaseController {
  async beforeAction() {
    // Authentication, logging
  }

  async create(params: CreateOrderParams) {
    const order = await this.service.create(params);
    await this.runHook('afterAction', order);
    return order;
  }
}
```

### BaseService

The Worker (S in RCSM).

```typescript
// app/contexts/sales/core/commands/services/orders.service.ts
export class OrdersService extends BaseService {
  async beforeCreate(data: CreateOrderData) {
    // Validate data shape
  }

  async create(data: CreateOrderData) {
    const order = await this.model.create(data);
    await this.runHook('afterCreate', order);
    return order;
  }
}
```

### BaseModel

The State (M in RCSM).

```typescript
// app/contexts/sales/core/commands/models/order.model.ts
export class OrderModel extends BaseModel<typeof orders> {
  async beforeSave(order: Order) {
    order.updatedAt = new Date();
  }

  async afterCreate(order: Order) {
    await this.events.emit('order.created', order);
  }
}
```

### BaseQueryController

Optimized fast-path reads.

```typescript
// app/contexts/sales/core/queries/controllers/orders-query.controller.ts
export class OrdersQueryController extends BaseQueryController {
  async beforeFetch(query: GetOrderQuery) {
    // Add query optimizations
  }

  async getOrder(orderId: string) {
    return this.projection.findById(orderId);
  }
}
```

### BaseQueryProjection

Hydrating view models from events.

```typescript
// app/contexts/sales/core/queries/projections/order-list.projection.ts
export class OrderListProjection extends BaseQueryProjection {
  async onEvent(event: OrderPlacedEvent) {
    await this.upsert({
      orderId: event.orderId,
      total: event.total,
      status: 'placed'
    });
  }
}
```

### BaseAggregate

Consistency boundary for event sourcing.

```typescript
// app/contexts/sales/core/commands/aggregates/order.aggregate.ts
export class OrderAggregate extends BaseAggregate {
  placeOrder(data: PlaceOrderData) {
    this.apply(new OrderPlacedEvent(data));
  }

  async afterCommand() {
    await this.eventStore.append(this.id, this.events);
  }
}
```

### BaseIntegrationEvent

Cross-context broadcast.

```typescript
// app/contexts/sales/api/events/order-placed.ts
export class OrderPlacedEvent extends BaseIntegrationEvent {
  static readonly name = 'sales.order-placed';

  async onPublish(event: any) {
    await this.eventBus.publish(this.name, event);
  }

  async onReceive(payload: any) {
    await this.handle(payload);
  }
}
```

### BasePlugin

Cross-cutting concerns.

```typescript
// app/plugins/global/auth-plugin.ts
export class AuthPlugin extends BaseGlobalPlugin {
  async onInit() {
    this.registerHook('aroundFeature', this.authenticateFeature);
  }

  private async authenticateFeature(ctx: FeatureContext, next: () => Promise<any>) {
    // Verify auth
    return next();
  }
}
```

---

## CQRS Implementation

### Commands vs Queries

```
# WRITES go through full RCSM + Feature
Frontend → BaseRpcServer → FeatureHandler → BaseRpc → Controller → Service → Model

# READS bypass features, go straight to projections
Frontend → BaseRpcServer → QueryController → Projection → View
```

### Event Sourcing (Optional)

```typescript
// Events stored instead of state
export class OrderAggregate extends BaseAggregate {
  private state: OrderState = { ... };

  // Commands emit events
  placeOrder(data: PlaceOrderData) {
    this.apply(new OrderPlacedEvent({ ... }));
  }

  // Events update state
  apply(event: OrderPlacedEvent) {
    this.state.status = 'placed';
    this.events.push(event);
  }

  // Rebuild from events
  static async load(orderId: string) {
    const events = await eventStore.getEvents(orderId);
    const aggregate = new OrderAggregate();
    events.forEach(e => aggregate.apply(e));
    return aggregate;
  }
}
```

---

## Ports and Adapters

### Port Interface

```typescript
// app/contexts/sales/core/ports/i-payment-gateway.ts
export interface IPaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(paymentId: string): Promise<RefundResult>;
}
```

### Adapter Implementation

```typescript
// app/contexts/sales/infrastructure/gateways/stripe.adapter.ts
export class StripeAdapter extends BaseInfrastructureAdapter implements IPaymentGateway {
  async onConnect() {
    // Initialize Stripe
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    return this.stripe.charges.create(input);
  }
}
```

---

## Plugin System

### Hook Types

| Hook | Layer | Purpose |
|------|-------|---------|
| `onInit` | Global | Startup initialization |
| `aroundFeature` | Global | Wrap feature execution |
| `beforeExecute` | Feature | Pre-execution logic |
| `afterExecute` | Feature | Post-execution logic |
| `beforeAction` | Controller | Pre-action logic |
| `afterAction` | Controller | Post-action logic |
| `beforeCreate` | Service | Pre-create logic |
| `afterCreate` | Service | Post-create logic |
| `beforeSave` | Model | Pre-save logic |
| `afterCreate` | Model | Post-create logic |

---

## Summary

Nomo provides **Rails-like happiness** with **architectural escape hatches**:

### Core Features
- **Double-Gate RPC**: Predictable security gates
- **Standard Gauge**: Clear layer responsibilities
- **Auto-routing**: Convention over configuration
- **Auto-hooks**: Null implementation pattern

### Progression Path
1. **Start simple**: Just handlers + validators
2. **Add hooks when needed**: New requirement? Add a plugin
3. **Add events sparingly**: Only when multiple features need to react
4. **Add ports when scaling**: Swap implementations elegantly
5. **Extract workers**: When a feature gets heavy, split into its own Worker

This architecture handles every case:
- Simple CRUD? Use RCSM directly
- Complex workflow? Use Features
- Need to scale one area? Extract a Context
- New requirement? Add a Plugin
- External service change? Swap an Adapter
- Performance issue? Add a Projection
- Cross-context communication? Use Integration Events