import { RouterContext } from "nomo/router";
import status from "http-status";
import { Logger, LogLevel } from "nomo/logger";
import { BaseModel } from "nomo/models";

export interface INormalizer<T = unknown> {
  normalize(): T;
}

export interface IValidator<T = unknown> {
  validate(): T;
}

export interface IFormatter<T = unknown> {
  format(): T;
}

export type Constructor<T, Args extends unknown[] = [unknown]> = new (...args: Args) => T;

export type HookConfig<T = unknown, Env = unknown, Ctx = unknown> = {
  run?:
    | (string | symbol)
    | ((
        controller: T,
        ctx: RouterContext<Env, Ctx>,
        env: Env,
        request: Request,
      ) => void | Response | Promise<void | Response>);
  normalize?: Constructor<INormalizer>;
  validate?: Constructor<IValidator>;
  format?: Constructor<IFormatter>;
  only?: (string | symbol)[];
  except?: (string | symbol)[];
};

export abstract class BaseController<Env = unknown, Ctx = unknown, Service = unknown> {
  static beforeActions: HookConfig<BaseController<unknown, unknown, unknown>, unknown, unknown>[] =
    [];
  static afterActions: HookConfig<BaseController<unknown, unknown, unknown>, unknown, unknown>[] =
    [];

  protected abstract service: Service;
  protected responseHeaders: Headers = new Headers();
  protected responseCookies: string[] = [];
  protected _paramsOverride: Record<string, unknown> = {};
  protected _actionName?: string;
  protected _controllerName?: string;

  constructor(
    protected request: Request,
    protected env: Env,
    protected ctx: RouterContext<Env, Ctx>,
  ) {}

  /**
   * Inject parameters manually (useful for RPC method arguments).
   */
  withParams(params: Record<string, unknown>): this {
    this._paramsOverride = { ...this._paramsOverride, ...params };
    return this;
  }

  protected get params(): Record<string, unknown> {
    const ctxWithJson = this.ctx as RouterContext<Env, Ctx> & {
      validJson?: Record<string, unknown>;
    };
    const body = ctxWithJson.validJson || {};
    const wrappedKey = this.controller_name.toLowerCase().replace("controller", "");
    const wrappedBody = (body as Record<string, unknown>)[wrappedKey] || body;

    return {
      ...this.ctx.params,
      ...this.ctx.query,
      ...body,
      [wrappedKey]: wrappedBody,
      ...this._paramsOverride,
    };
  }

  protected get pathParams(): Record<string, string> {
    return this.ctx.params;
  }

  protected get queryParams(): Record<string, string> {
    return this.ctx.query;
  }

  protected get logger(): Logger {
    const envWithLogLevel = this.env as Record<string, unknown>;
    const rawLogLevel = envWithLogLevel?.LOG_LEVEL;
    const level: LogLevel =
      typeof rawLogLevel === "string" && rawLogLevel in LogLevel
        ? LogLevel[rawLogLevel as keyof typeof LogLevel]
        : LogLevel.INFO;

    if (this.ctx.logger) {
      // Create a new logger with updated service and context
      const baseLogger = this.ctx.logger;
      return new Logger({
        service: "controllers",
        environment: (baseLogger as any).environment,
        level: (baseLogger as any).level,
        context: {
          ...(baseLogger as any).context,
          controller: this.controller_name,
          action: this.action_name,
        },
      });
    }
    return new Logger({
      service: "controllers",
      level,
      context: {
        controller: this.controller_name,
        action: this.action_name,
      },
    });
  }

  protected get headers(): Record<string, string> {
    return this.ctx.headers;
  }

  protected get action_name(): string {
    return this._actionName || "";
  }

  protected get controller_name(): string {
    return this._controllerName || this.constructor.name;
  }

  protected extract_value(key: string, delimiter: string = "_"): string[] {
    const val = this.params[key];
    if (typeof val !== "string") return [];
    return val.split(delimiter);
  }

  protected get method(): string {
    return this.request.method;
  }

  protected get path(): string {
    return new URL(this.request.url).pathname;
  }

  protected get url(): URL {
    return new URL(this.request.url);
  }

  protected get ip(): string | null {
    return (
      this.headers["cf-connecting-ip"] ||
      this.headers["x-real-ip"] ||
      this.headers["x-forwarded-for"] ||
      null
    );
  }

  protected async rpc(method: string, ...args: unknown[]): Promise<unknown> {
    const routerCtx = this.ctx as RouterContext<Env, Ctx> & {
      router: {
        rpc: (method: string, args: unknown[], env: Env, ctx: unknown) => Promise<unknown>;
      };
    };
    return routerCtx.router.rpc(method, args, this.env, this.ctx.executionCtx);
  }

  protected async fetch(input: string | Request | URL, init?: RequestInit): Promise<Response> {
    return this.ctx.fetch(input, init);
  }

  protected get db(): unknown {
    return (this.env as Record<string, unknown>).DB;
  }

  protected get cookies(): Record<string, string> {
    const cookieStr = this.headers["cookie"] || "";
    return Object.fromEntries(
      cookieStr
        .split(";")
        .map((v) => v.split("="))
        .map(([k, v]) => [k?.trim(), v?.trim()])
        .filter(([k, v]) => k && v),
    );
  }

  protected setCookie(
    name: string,
    value: string,
    options: {
      expires?: Date;
      maxAge?: number;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
    } = {},
  ) {
    let cookie = `${name}=${value}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.secure) cookie += `; Secure`;
    if (options.httpOnly) cookie += `; HttpOnly`;
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    this.responseCookies.push(cookie);
  }

  protected deleteCookie(name: string) {
    this.setCookie(name, "", { maxAge: 0 });
  }

  protected layout: unknown = null;

  async render(options: {
    view?: unknown;
    layout?: unknown;
    data?: unknown;
    json?: unknown;
    text?: string;
    html?: string;
    xml?: string;
    csv?: string;
    xlsx?: Uint8Array;
    status?: number;
    headers?: Record<string, string>;
  }): Promise<Response> {
    const {
      json,
      text,
      html,
      xml,
      csv,
      xlsx,
      view,
      data,
      status = 200,
      headers: extraHeaders,
    } = options;

    if (extraHeaders) {
      Object.entries(extraHeaders).forEach(([k, v]) => this.responseHeaders.set(k, v));
    }

    this.responseCookies.forEach((cookie) => this.responseHeaders.append("Set-Cookie", cookie));

    const init = {
      status,
      headers: this.responseHeaders,
    };

    if (json !== undefined) return this.json(json, init);
    if (text !== undefined) return this.text(text, init);
    if (html !== undefined) return this.html(html, init);
    if (xml !== undefined) return this.xml(xml, init);
    if (csv !== undefined) return this.csv(csv, init);
    if (xlsx !== undefined) return this.xlsx(xlsx, init);

    if (view) {
      const LayoutClass =
        options.layout || (this.constructor as unknown as Record<string, unknown>).layout;
      const viewData = data || this.params || {};

      // Initialize Asset Pipeline
      const { AssetPipeline } = await import("nomo/assets");
      const envRecord = this.env as Record<string, unknown>;
      const ctxRecord = this.ctx as Record<string, unknown>;

      const assets = new AssetPipeline({
        // @ts-ignore
        manifest: envRecord.ASSET_MANIFEST,
        isProd: envRecord.ENVIRONMENT === "production",
        importMap: ctxRecord.IMPORT_MAP || envRecord.IMPORT_MAP,
      });

      if (LayoutClass) {
        const { BaseLayout } = await import("nomo/views");
        const renderedHtml = BaseLayout.withLayout(
          LayoutClass as never,
          view as never,
          viewData,
          assets,
        );
        return this.html(renderedHtml, init);
      }
      const { BaseView } = await import("nomo/views");
      const renderedHtml = (view as typeof BaseView).render(viewData, assets);
      return this.html(renderedHtml, init);
    }

    if (status === 204 || status === 304) {
      return new Response(null, init);
    }

    return new Response(null, { ...init, status: 204 });
  }

  protected redirect_to(url: string, options: { status?: number } = {}): Response {
    let { status } = options;
    if (!status) {
      const safeMethod = ["GET", "HEAD"].includes(this.method);
      status = safeMethod ? 302 : 303;
    }
    return this.ctx.redirect(url, status);
  }

  // Status code shorthands
  protected notFound(message: string = "Not Found"): Promise<Response> {
    return this.render({ json: { error: message }, status: status.NOT_FOUND });
  }

  protected unauthorized(message: string = "Unauthorized"): Promise<Response> {
    return this.render({
      json: { error: message },
      status: status.UNAUTHORIZED,
    });
  }

  protected forbidden(message: string = "Forbidden"): Promise<Response> {
    return this.render({ json: { error: message }, status: status.FORBIDDEN });
  }

  protected badRequest(message: string = "Bad Request"): Promise<Response> {
    return this.render({
      json: { error: message },
      status: status.BAD_REQUEST,
    });
  }

  protected internalServerError(message: string = "Internal Server Error"): Promise<Response> {
    return this.render({
      json: { error: message },
      status: status.INTERNAL_SERVER_ERROR,
    });
  }

  protected json(data: unknown, init?: ResponseInit): Response {
    const mergedHeaders = new Headers(init?.headers);
    this.responseHeaders.forEach((v, k) => mergedHeaders.set(k, v));
    return this.ctx.json(data, { ...init, headers: mergedHeaders });
  }

  protected text(data: string, init?: ResponseInit): Response {
    const mergedHeaders = new Headers(init?.headers);
    this.responseHeaders.forEach((v, k) => mergedHeaders.set(k, v));
    return this.ctx.text(data, { ...init, headers: mergedHeaders });
  }

  protected html(data: string, init?: ResponseInit): Response {
    const mergedHeaders = new Headers(init?.headers);
    this.responseHeaders.forEach((v, k) => mergedHeaders.set(k, v));
    return this.ctx.html(data, { ...init, headers: mergedHeaders });
  }

  protected xml(data: string, init?: ResponseInit): Response {
    const mergedHeaders = new Headers(init?.headers);
    this.responseHeaders.forEach((v, k) => mergedHeaders.set(k, v));
    mergedHeaders.set("Content-Type", "application/xml");
    return new Response(data, { ...init, headers: mergedHeaders });
  }

  protected csv(data: string, init?: ResponseInit): Response {
    const mergedHeaders = new Headers(init?.headers);
    this.responseHeaders.forEach((v, k) => mergedHeaders.set(k, v));
    mergedHeaders.set("Content-Type", "text/csv");
    return new Response(data, { ...init, headers: mergedHeaders });
  }

  protected xlsx(data: Uint8Array, init?: ResponseInit): Response {
    const mergedHeaders = new Headers(init?.headers);
    this.responseHeaders.forEach((v, k) => mergedHeaders.set(k, v));
    mergedHeaders.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return new Response(data as unknown as BodyInit, {
      ...init,
      headers: mergedHeaders,
    });
  }

  protected validate<V>(Validator: Constructor<IValidator<V>>, data: unknown): V {
    return new Validator(data).validate();
  }

  protected normalize<N>(Normalizer: Constructor<INormalizer<N>>, data: unknown): N {
    return new Normalizer(data).normalize();
  }

  protected format<F>(Formatter: Constructor<IFormatter<F>>, data: unknown): F {
    return new Formatter(data).format();
  }

  static action<
    T extends BaseController<Env, Ctx, Service>,
    Env = unknown,
    Ctx = unknown,
    Service = unknown,
  >(this: new (req: Request, env: Env, ctx: RouterContext<Env, Ctx>) => T, name: keyof T) {
    return async (req: Request, env: Env, ctx: RouterContext<Env, Ctx>): Promise<Response> => {
      const controller = new this(req, env, ctx);
      (controller as Record<string, unknown>)._controllerName = this.name;
      return await (controller as any).runAction(name);
    };
  }

  public async runAction(name: string | symbol, args: unknown[] = []): Promise<any> {
    const action = (this as any)[name];
    if (typeof action !== "function") {
      this.logger.error(`[ACTION NOT FOUND] ${this.controller_name}#${String(name)}`, {
        controller: this.controller_name,
        action: name,
      });
      throw new Error(`Action ${String(name)} not found on controller`);
    }

    this._actionName = name as string;
    const ctor = this.constructor as typeof BaseController;
    const startTime = Date.now();

    // Log request entry
    this.logger.info(`[START] ${this.controller_name}#${String(name)}`, {
      method: this.method,
      path: this.path,
      ip: this.ip,
    });

    // Execute beforeActions
    if (ctor.beforeActions) {
      for (const hook of ctor.beforeActions) {
        if (shouldRunHook(hook, name)) {
          const hookStart = Date.now();

          // Semantic: Normalize
          if (hook.normalize) {
            this.logger.debug(`[NORMALIZE] ${String(name)}`);
            const json = await this.ctx.parseJson();
            // Use params (includes withParams data) or fall back to parsed JSON
            const dataToNormalize =
              Object.keys(this._paramsOverride).length > 0 ? this._paramsOverride : json || {};
            if (dataToNormalize && Object.keys(dataToNormalize).length > 0) {
              (this.ctx as Record<string, unknown>).validJson = this.normalize(
                hook.normalize,
                dataToNormalize,
              );
            }
          }

          // Semantic: Validate
          if (hook.validate) {
            this.logger.debug(`[VALIDATE] ${String(name)}`);
            try {
              const ctxWithJson = this.ctx as Record<string, unknown>;
              ctxWithJson.validJson = this.validate(hook.validate, ctxWithJson.validJson);
            } catch (err: unknown) {
              const error = err as Error & { errors?: unknown };
              this.logger.warn(`[VALIDATE FAILED] ${String(name)}`, {
                error: error.message,
                duration_ms: Date.now() - hookStart,
              });
              return this.render({
                json: {
                  error: "Validation failed",
                  details: error.errors || error.message,
                },
                status: 400,
              });
            }
          }

          // Generic: Run
          if (hook.run) {
            if (typeof hook.run === "function") {
              this.logger.debug(`[HOOK] ${String(name)}`);
              const result = await hook.run(this, this.ctx, this.env, this.request);
              if (result instanceof Response) {
                this.logger.debug(`[HOOK EARLY RESPONSE] ${String(name)}`, {
                  duration_ms: Date.now() - hookStart,
                });
                return result;
              }
            } else {
              const actionName = hook.run; // Narrowed to string | symbol
              const hookFn = (this as unknown as Record<string | symbol, Function>)[actionName];
              if (typeof hookFn === "function") {
                this.logger.debug(`[HOOK] ${String(actionName)}→${String(name)}`);
                const result = await hookFn.apply(this);
                if (result instanceof Response) {
                  this.logger.debug(`[HOOK EARLY RESPONSE] ${String(name)}`, {
                    duration_ms: Date.now() - hookStart,
                  });
                  return result;
                }
              }
            }
          }

          this.logger.debug(`[HOOK DONE] ${String(name)}`, {
            duration_ms: Date.now() - hookStart,
          });
        }
      }
    }

    const actionStart = Date.now();
    let response: any;
    try {
      this.logger.debug(`[ACTION] ${String(name)}`);
      response = await (action as Function).apply(this, args);
      this.logger.info(`[ACTION DONE] ${String(name)}`, {
        duration_ms: Date.now() - actionStart,
      });
    } catch (error: unknown) {
      this.logger.error(`[ACTION ERROR] ${String(name)}`, {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - actionStart,
      });
      throw error;
    }

    // Execute afterActions
    if (ctor.afterActions) {
      for (const hook of ctor.afterActions) {
        if (shouldRunHook(hook, name)) {
          const hookStart = Date.now();

          if (hook.run) {
            if (typeof hook.run === "function") {
              this.logger.debug(`[AFTER] ${String(name)}`);
              await hook.run(this, this.ctx, this.env, this.request);
            } else {
              const actionName = hook.run; // Narrowed to string | symbol
              const hookFn = (this as unknown as Record<string | symbol, Function>)[actionName];
              if (typeof hookFn === "function") {
                this.logger.debug(`[AFTER] ${String(actionName)}→${String(name)}`);
                await hookFn.apply(this, [response]);
              }
            }
          }

          this.logger.debug(`[AFTER DONE] ${String(name)}`, {
            duration_ms: Date.now() - hookStart,
          });
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const responseStatus = response?.status || "unknown";
    this.logger.info(`[DONE] ${this.controller_name}#${String(name)}`, {
      total_ms: totalDuration,
      status: responseStatus,
    });

    return response;
  }
}

export abstract class BaseResourceController<
  Env = unknown,
  Ctx = unknown,
  Service = unknown,
  TModel extends BaseModel<any, TSelect, TInsert> = BaseModel<any, any, any>,
  TSelect = unknown,
  TInsert = unknown,
> extends BaseController<Env, Ctx, Service> {
  protected abstract getModel(): TModel;

  protected getDtoView(): any {
    return null;
  }

  protected getView(): any {
    return null;
  }

  protected getLayout(): any {
    return null;
  }

  protected getIdentifier(): string {
    // Check pathParams first (traditional routing), then fall back to params (RPC withParams)
    return (this.pathParams.id ||
      Object.values(this.pathParams).reverse()[0] ||
      this.params.id ||
      "") as string;
  }

  protected getScopeConditions(): Record<string, string> {
    const conditions: Record<string, string> = {};
    const columns = (this as any).getModel().columnNames;

    for (const [key, value] of Object.entries(this.pathParams)) {
      if (key !== "id" && columns.includes(key)) {
        conditions[key] = value as string;
      }
    }
    return conditions;
  }

  protected getTitle(item?: TSelect): string {
    return this.controller_name.replace("Controller", "");
  }

  protected async respondWith(data: any, options: { status?: number } = {}): Promise<Response> {
    if (data === null) return this.notFound();

    const accept = (this.request.headers.get("accept") || "").toLowerCase();
    const ViewComponent = this.getView();
    const DtoComponent = this.getDtoView();

    const wantsHtmlOnly =
      accept.includes("text/html") &&
      !accept.includes("application/json") &&
      !accept.includes("*/*");
    const wantsXml = accept.includes("application/xml");
    const wantsCsv = accept.includes("text/csv");
    const wantsXlsx = accept.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    // HTML with view component
    if (ViewComponent && wantsHtmlOnly) {
      return this.render({
        view: ViewComponent,
        layout: this.getLayout(),
        data: {
          title: this.getTitle(Array.isArray(data) ? undefined : data),
          item: Array.isArray(data) ? undefined : data,
          items: Array.isArray(data) ? data : undefined,
          ...this.getScopeConditions(),
        },
        status: options.status,
      });
    }

    // XML with DTO
    if (wantsXml) {
      if (DtoComponent) {
        const { BaseDtoView } = await import("nomo/views");
        return this.xml((DtoComponent as typeof BaseDtoView).renderXml(data), {
          status: options.status,
        });
      }
      return this.xml(JSON.stringify(data), { status: options.status });
    }

    // CSV
    if (wantsCsv) {
      return this.csv(JSON.stringify(data), { status: options.status });
    }

    // XLSX
    if (wantsXlsx) {
      return this.xlsx(new Uint8Array(), { status: options.status });
    }

    // JSON (Default)
    if (DtoComponent) {
      const { BaseDtoView } = await import("nomo/views");
      return this.json((DtoComponent as typeof BaseDtoView).renderJson(data), {
        status: options.status,
      });
    }
    return this.json(data, { status: options.status });
  }

  async index(): Promise<Response> {
    const query = this.getModel().query();
    const conditions = this.getScopeConditions();

    if (Object.keys(conditions).length > 0) {
      query.where(conditions);
    }

    const items: TSelect[] = await query.all();
    this.logger.info(`[INDEX] ${this.controller_name}`, {
      count: items.length,
      filtered: Object.keys(conditions).length > 0,
    });
    return this.respondWith(items);
  }

  async findAllBy(): Promise<Response> {
    const conditions = this.getScopeConditions();
    const { orderBy, limit, offset } = (await this.getRequestData()) as {
      orderBy?: { column: string; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    };

    let query = this.getModel().query().where(conditions);

    if (orderBy?.column) {
      query = query.orderBy(orderBy.column as any, orderBy.direction || "ASC");
    }

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.offset(offset);
    }

    const items: TSelect[] = await query.all();
    this.logger.info(`[FIND_ALL_BY] ${this.controller_name}`, {
      count: items.length,
      conditions,
    });
    return this.respondWith(items);
  }

  async findByIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { ids?: (string | number)[] };
    const ids = data?.ids || [];

    if (ids.length === 0) {
      return this.respondWith([]);
    }

    const items: TSelect[] = await (this.service as any).findByIds(ids);
    this.logger.info(`[FIND_BY_IDS] ${this.controller_name}`, {
      count: items.length,
      idCount: ids.length,
    });
    return this.respondWith(items);
  }

  async pluck(): Promise<Response> {
    const data = (await this.getRequestData()) as {
      column?: string;
      conditions?: Record<string, any>;
    };
    const { column, conditions } = data || {};

    if (!column) {
      return this.badRequest("column is required");
    }

    const values = await (this.service as any).pluck(column, conditions || {});
    this.logger.info(`[PLUCK] ${this.controller_name}`, {
      column,
      count: values.length,
    });
    return this.respondWith(values);
  }

  async new(): Promise<Response> {
    this.logger.debug(`[NEW] ${this.controller_name}`);
    return this.respondWith({} as TSelect);
  }

  protected async getRequestData(): Promise<any> {
    if (Object.keys(this._paramsOverride).length > 0) {
      return this._paramsOverride;
    }
    try {
      return (await this.ctx.parseJson()) || {};
    } catch (e) {
      return {};
    }
  }

  async create(): Promise<Response> {
    const data = (await this.getRequestData()) as TInsert;
    if (!data || Object.keys(data).length === 0) {
      this.logger.warn(`[CREATE FAILED] ${this.controller_name}: Missing body`);
      return this.badRequest("Missing request body");
    }

    // Auto-inject scope parameters
    const conditions = this.getScopeConditions();
    const dataWithScope = { ...data, ...conditions };

    this.logger.info(`[CREATE] ${this.controller_name}`, {
      fields: Object.keys(data).length,
      scope: Object.keys(conditions).length,
    });
    const item: TSelect = await this.getModel().create(dataWithScope as TInsert);
    this.logger.info(`[CREATED] ${this.controller_name}`, {
      id: (item as any).id,
    });
    return this.respondWith(item, { status: 201 });
  }

  async show(): Promise<Response> {
    const id = this.getIdentifier();
    const conditions = { id, ...this.getScopeConditions() };
    this.logger.debug(`[SHOW] ${this.controller_name}#${id}`);
    const item: TSelect | null = await this.getModel().findBy(conditions);
    if (!item) {
      this.logger.warn(`[NOT FOUND] ${this.controller_name}#${id}`);
    } else {
      this.logger.info(`[FOUND] ${this.controller_name}#${id}`);
    }
    return this.respondWith(item);
  }

  async edit(): Promise<Response> {
    const id = this.getIdentifier();
    const conditions = { id, ...this.getScopeConditions() };
    this.logger.debug(`[EDIT] ${this.controller_name}#${id}`);
    const item: TSelect | null = await this.getModel().findBy(conditions);
    if (!item) {
      this.logger.warn(`[NOT FOUND] ${this.controller_name}#${id}`);
    } else {
      this.logger.info(`[LOADED] ${this.controller_name}#${id}`);
    }
    return this.respondWith(item);
  }

  async update(): Promise<Response> {
    const id = this.getIdentifier();
    const data = (await this.getRequestData()) as Partial<TInsert>;
    const conditions = { id, ...this.getScopeConditions() };

    this.logger.debug(`[UPDATE] ${this.controller_name}#${id}`, {
      fields: Object.keys(data).length,
    });

    const existing = await this.getModel().findBy(conditions);
    if (!existing) {
      this.logger.warn(`[UPDATE FAILED] ${this.controller_name}#${id}: Not found`);
      return this.notFound();
    }

    const item = await this.getModel().update(id, data);
    this.logger.info(`[UPDATED] ${this.controller_name}#${id}`);
    return this.respondWith(item);
  }

  async destroy(): Promise<Response> {
    const id = this.getIdentifier();
    const conditions = { id, ...this.getScopeConditions() };

    this.logger.debug(`[DELETE] ${this.controller_name}#${id}`);

    const existing = await this.getModel().findBy(conditions);
    if (!existing) {
      this.logger.warn(`[DELETE FAILED] ${this.controller_name}#${id}: Not found`);
      return this.notFound();
    }

    await this.getModel().delete(id);
    this.logger.info(`[DELETED] ${this.controller_name}#${id}`);
    return this.render({ json: { message: "Deleted" } });
  }

  // ===== Lifecycle Actions =====

  protected async getItemForLifecycle(id?: string): Promise<TSelect | null> {
    const identifier = id || this.getIdentifier();
    const conditions = { id: identifier, ...this.getScopeConditions() };
    return this.getModel().findBy(conditions);
  }

  async trash(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[TRASH] ${this.controller_name}#${identifier}`);

    const item = await this.getItemForLifecycle(identifier);
    if (!item) return this.notFound();

    const model = this.getModel() as any;
    if (model.trash) {
      await model.trash(identifier);
    } else if (model.update) {
      await model.update(identifier, { trashedAt: new Date().toISOString() });
    }

    this.logger.info(`[TRASHED] ${this.controller_name}#${identifier}`);
    return this.respondWith(item);
  }

  async restore(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[RESTORE] ${this.controller_name}#${identifier}`);

    const model = this.getModel() as any;
    if (model.restore) {
      await model.restore(identifier);
    } else if (model.update) {
      await model.update(identifier, { trashedAt: null });
    }

    this.logger.info(`[RESTORED] ${this.controller_name}#${identifier}`);
    return this.respondWith(await this.getItemForLifecycle(identifier));
  }

  async hide(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[HIDE] ${this.controller_name}#${identifier}`);

    const item = await this.getItemForLifecycle(identifier);
    if (!item) return this.notFound();

    const model = this.getModel() as any;
    if (model.hide) {
      await model.hide(identifier);
    } else if (model.update) {
      await model.update(identifier, { hiddenAt: new Date().toISOString() });
    }

    this.logger.info(`[HIDDEN] ${this.controller_name}#${identifier}`);
    return this.respondWith(item);
  }

  async unhide(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[UNHIDE] ${this.controller_name}#${identifier}`);

    const model = this.getModel() as any;
    if (model.unhide) {
      await model.unhide(identifier);
    } else if (model.update) {
      await model.update(identifier, { hiddenAt: null });
    }

    this.logger.info(`[UNHIDDEN] ${this.controller_name}#${identifier}`);
    return this.respondWith(await this.getItemForLifecycle(identifier));
  }

  async flag(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[FLAG] ${this.controller_name}#${identifier}`);

    const item = await this.getItemForLifecycle(identifier);
    if (!item) return this.notFound();

    const model = this.getModel() as any;
    if (model.flag) {
      await model.flag(identifier);
    } else if (model.update) {
      await model.update(identifier, { flaggedAt: new Date().toISOString() });
    }

    this.logger.info(`[FLAGGED] ${this.controller_name}#${identifier}`);
    return this.respondWith(item);
  }

  async unflag(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[UNFLAG] ${this.controller_name}#${identifier}`);

    const model = this.getModel() as any;
    if (model.unflag) {
      await model.unflag(identifier);
    } else if (model.update) {
      await model.update(identifier, { flaggedAt: null });
    }

    this.logger.info(`[UNFLAGGED] ${this.controller_name}#${identifier}`);
    return this.respondWith(await this.getItemForLifecycle(identifier));
  }

  async purge(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[PURGE] ${this.controller_name}#${identifier}`);

    const model = this.getModel() as any;
    if (model.purge) {
      await model.purge(identifier);
    } else {
      await this.getModel().delete(identifier);
    }

    this.logger.info(`[PURGED] ${this.controller_name}#${identifier}`);
    return this.render({ json: { message: "Purged" } });
  }

  async retire(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[RETIRE] ${this.controller_name}#${identifier}`);

    const item = await this.getItemForLifecycle(identifier);
    if (!item) return this.notFound();

    const model = this.getModel() as any;
    if (model.retire) {
      await model.retire(identifier);
    } else if (model.update) {
      await model.update(identifier, { retiredAt: new Date().toISOString() });
    }

    this.logger.info(`[RETIRED] ${this.controller_name}#${identifier}`);
    return this.respondWith(item);
  }

  async unretire(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    this.logger.debug(`[UNRETIRE] ${this.controller_name}#${identifier}`);

    const model = this.getModel() as any;
    if (model.unretire) {
      await model.unretire(identifier);
    } else if (model.update) {
      await model.update(identifier, { retiredAt: null });
    }

    this.logger.info(`[UNRETIRED] ${this.controller_name}#${identifier}`);
    return this.respondWith(await this.getItemForLifecycle(identifier));
  }

  // ===== Async Actions =====

  async queue(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    const data = await this.getRequestData();
    this.logger.debug(`[QUEUE] ${this.controller_name}#${identifier}`, { data });

    const model = this.getModel() as any;
    let result: any;

    if (model.queue) {
      result = await model.queue(identifier, data);
    } else {
      result = { queued: true, id: identifier, data };
    }

    this.logger.info(`[QUEUED] ${this.controller_name}#${identifier}`);
    return this.render({ json: result });
  }

  async cron(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    const data = await this.getRequestData();
    this.logger.debug(`[CRON] ${this.controller_name}#${identifier}`, { data });

    const model = this.getModel() as any;
    let result: any;

    if (model.cron) {
      result = await model.cron(identifier, data);
    } else {
      result = { cron: true, id: identifier, data };
    }

    this.logger.info(`[CRON] ${this.controller_name}#${identifier}`);
    return this.render({ json: result });
  }

  // ===== Special Actions =====

  async add(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    const data = await this.getRequestData();
    this.logger.debug(`[ADD] ${this.controller_name}#${identifier}`, { data });

    const model = this.getModel() as any;
    let result: any;

    if (model.add) {
      result = await model.add(identifier, data);
    } else {
      return this.badRequest("Add action not implemented");
    }

    this.logger.info(`[ADDED] ${this.controller_name}#${identifier}`);
    return this.respondWith(result);
  }

  async remove(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    const data = await this.getRequestData();
    this.logger.debug(`[REMOVE] ${this.controller_name}#${identifier}`, { data });

    const model = this.getModel() as any;
    let result: any;

    if (model.remove) {
      result = await model.remove(identifier, data);
    } else {
      return this.badRequest("Remove action not implemented");
    }

    this.logger.info(`[REMOVED] ${this.controller_name}#${identifier}`);
    return this.respondWith(result);
  }

  async assign(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    const data = await this.getRequestData();
    this.logger.debug(`[ASSIGN] ${this.controller_name}#${identifier}`, { data });

    const model = this.getModel() as any;
    let result: any;

    if (model.assign) {
      result = await model.assign(identifier, data);
    } else {
      return this.badRequest("Assign action not implemented");
    }

    this.logger.info(`[ASSIGNED] ${this.controller_name}#${identifier}`);
    return this.respondWith(result);
  }

  async unassign(id?: string): Promise<Response> {
    const identifier = id || this.getIdentifier();
    const data = await this.getRequestData();
    this.logger.debug(`[UNASSIGN] ${this.controller_name}#${identifier}`, { data });

    const model = this.getModel() as any;
    let result: any;

    if (model.unassign) {
      result = await model.unassign(identifier, data);
    } else {
      return this.badRequest("Unassign action not implemented");
    }

    this.logger.info(`[UNASSIGNED] ${this.controller_name}#${identifier}`);
    return this.respondWith(result);
  }

  // ===== Relationship Traversal =====

  async listChildIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_CHILD_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listChildIds(relation, identifier);

    this.logger.info(`[LIST_CHILD_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listParentIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_PARENT_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listParentIds(relation, identifier);

    this.logger.info(`[LIST_PARENT_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listSiblingIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_SIBLING_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listSiblingIds(relation, identifier);

    this.logger.info(`[LIST_SIBLING_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listCousinIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_COUSIN_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listCousinIds(relation, identifier);

    this.logger.info(`[LIST_COUSIN_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listAncestorIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_ANCESTOR_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listAncestorIds(relation, identifier);

    this.logger.info(`[LIST_ANCESTOR_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listDescendantIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_DESCENDANT_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listDescendantIds(relation, identifier);

    this.logger.info(`[LIST_DESCENDANT_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listAssociatedThroughIds(): Promise<Response> {
    const { relation, through, id } = (await this.getRequestData()) as {
      relation?: string;
      through?: string;
      id?: string;
    };
    const identifier = id || this.getIdentifier();

    if (!relation || !through) {
      return this.badRequest("relation and through are required");
    }

    this.logger.debug(`[LIST_ASSOCIATED_THROUGH_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      through,
    });

    const model = this.getModel() as any;
    const ids = await model.listAssociatedThroughIds(relation, through, identifier);

    this.logger.info(`[LIST_ASSOCIATED_THROUGH_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      through,
      count: ids.length,
    });
    return this.json({ ids });
  }

  async listRelatedIds(): Promise<Response> {
    const { relation, id } = (await this.getRequestData()) as { relation?: string; id?: string };
    const identifier = id || this.getIdentifier();

    if (!relation) {
      return this.badRequest("relation is required");
    }

    this.logger.debug(`[LIST_RELATED_IDS] ${this.controller_name}#${identifier}`, { relation });

    const model = this.getModel() as any;
    const ids = await model.listRelatedIds(relation, identifier);

    this.logger.info(`[LIST_RELATED_IDS] ${this.controller_name}#${identifier}`, {
      relation,
      count: ids.length,
    });
    return this.json({ ids });
  }

  // ===== Include/Eager Loading =====

  async findAllWith(): Promise<Response> {
    const conditions = this.getScopeConditions();
    const { includes, orderBy, limit, offset } = (await this.getRequestData()) as {
      includes?: Record<string, { model: string; foreignKey: string }>;
      orderBy?: { column: string; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    };

    if (!includes || Object.keys(includes).length === 0) {
      return this.badRequest("includes is required");
    }

    this.logger.debug(`[FIND_ALL_WITH] ${this.controller_name}`, { includes, conditions });

    const model = this.getModel() as any;
    const items = await model.findAllWith(conditions, includes, { orderBy, limit, offset });

    this.logger.info(`[FIND_ALL_WITH] ${this.controller_name}`, {
      count: items.length,
      includes: Object.keys(includes),
    });
    return this.respondWith(items);
  }

  async findWith(): Promise<Response> {
    const conditions = this.getScopeConditions();
    const { includes } = (await this.getRequestData()) as {
      includes?: Record<string, { model: string; foreignKey: string }>;
    };

    if (!includes || Object.keys(includes).length === 0) {
      return this.badRequest("includes is required");
    }

    this.logger.debug(`[FIND_WITH] ${this.controller_name}`, { includes, conditions });

    const model = this.getModel() as any;
    const item = await model.findWith(conditions, includes);

    this.logger.info(`[FIND_WITH] ${this.controller_name}`, {
      found: !!item,
      includes: Object.keys(includes),
    });
    return this.respondWith(item);
  }
}

function shouldRunHook(
  hook: HookConfig<BaseController<unknown, unknown, unknown>, unknown, unknown>,
  actionName: string | symbol,
): boolean {
  if (hook.only && !hook.only.includes(actionName)) return false;
  if (hook.except && hook.except.includes(actionName)) return false;
  return true;
}
