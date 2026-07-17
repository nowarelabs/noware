import type {
  EnvLike,
  ControllerContext,
  RequestLike,
  HookOptions,
  HookFunction,
  AfterHookFunction,
  AroundHookFunction,
  RegisteredHook,
} from "@nowarelabs/shared";
import {
  runBeforeHooks,
  runAfterHooks,
  runAroundHooks,
  HttpError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
} from "@nowarelabs/shared";

export abstract class BaseController<
  Ctx extends ControllerContext = ControllerContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
  Svc = unknown,
> {
  static beforeHooks: RegisteredHook[] = [];
  static afterHooks: RegisteredHook[] = [];
  static aroundHooks: RegisteredHook[] = [];

  protected service: Svc | undefined;

  constructor(
    protected request: Req,
    protected env: Env,
    protected ctx: Ctx,
  ) {}

  protected getService(): Svc {
    throw new Error(
      "getService() not implemented. Override getService() or getModel() in your controller.",
    );
  }

  static before<T extends BaseController>(fn: HookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "beforeHooks")) this.beforeHooks = [];
    this.beforeHooks.push({ fn: fn as HookFunction, options });
  }

  static after<T extends BaseController>(fn: AfterHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "afterHooks")) this.afterHooks = [];
    this.afterHooks.push({ fn: fn as AfterHookFunction, options });
  }

  static around<T extends BaseController>(fn: AroundHookFunction<T>, options?: HookOptions): void {
    if (!Object.hasOwn(this, "aroundHooks")) this.aroundHooks = [];
    this.aroundHooks.push({ fn: fn as AroundHookFunction, options });
  }

  async run(action: string, ...args: any[]): Promise<Response> {
    const Ctor = this.constructor;
    const shouldRunHook = (opts?: HookOptions) => {
      if (opts?.only && !opts.only.includes(action)) return false;
      if (opts?.except && opts.except.includes(action)) return false;
      return this.shouldRunHook(opts);
    };

    const instanceBefore = await this.beforeAction();
    if (instanceBefore) return this.sendCookies(instanceBefore);

    const beforeResult = await runBeforeHooks(
      this,
      BaseController.collectHooks(Ctor, "beforeHooks"),
      shouldRunHook,
    );
    if (beforeResult) return this.sendCookies(beforeResult as Response);

    const response = await runAroundHooks(
      this,
      BaseController.collectHooks(Ctor, "aroundHooks"),
      async () => {
        const handler = (this as Record<string, unknown>)[action];
        if (typeof handler !== "function") {
          return this.respondWithError(new NotFoundError(`Action '${action}' not found`));
        }
        return await (handler as (...args: any[]) => Promise<Response>).call(this, ...args);
      },
      shouldRunHook,
    );

    const afterResponse = await runAfterHooks(
      this,
      BaseController.collectHooks(Ctor, "afterHooks"),
      response,
      shouldRunHook,
    );

    const instanceAfter = await this.afterAction(afterResponse);
    return this.sendCookies(instanceAfter ?? afterResponse);
  }

  private static collectHooks(ctor: object, prop: string): RegisteredHook[] {
    const hooks: RegisteredHook[] = [];
    let current: any = ctor;
    while (current && current !== Function.prototype) {
      if (Object.hasOwn(current, prop)) {
        hooks.unshift(...current[prop]);
      }
      current = Object.getPrototypeOf(current);
    }
    return hooks;
  }

  protected async beforeAction(): Promise<Response | void> {}

  protected async afterAction(_result: Response): Promise<Response | void> {}

  protected shouldRunHook(_options?: HookOptions): boolean {
    return true;
  }

  protected get params(): Record<string, string> {
    return this.ctx.params;
  }

  protected get pathParams(): Record<string, string> {
    return this.ctx.params;
  }

  protected get queryParams(): Record<string, string> {
    const url = new URL(this.request.url);
    return Object.fromEntries(url.searchParams);
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

  protected get headers(): Record<string, string> {
    const result: Record<string, string> = {};
    this.request.headers.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }

  protected get ip(): string | null {
    return (
      this.request.headers.get("cf-connecting-ip") ||
      this.request.headers.get("x-real-ip") ||
      this.request.headers.get("x-forwarded-for") ||
      null
    );
  }

  protected json(data: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(data), { ...init, headers });
  }

  protected html(content: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "text/html");
    return new Response(content, { ...init, headers });
  }

  protected text(content: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "text/plain");
    return new Response(content, { ...init, headers });
  }

  protected xml(content: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/xml");
    return new Response(content, { ...init, headers });
  }

  protected csv(content: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "text/csv");
    return new Response(content, { ...init, headers });
  }

  protected xlsx(data: Uint8Array, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return new Response(data as Uint8Array, { ...init, headers });
  }

  protected redirect(url: string, status: number = 302): Response {
    return new Response(null, { status, headers: { Location: url } });
  }

  protected notFound(message = "Not Found"): Response {
    return this.respondWithError(new NotFoundError(message));
  }

  protected unauthorized(message = "Unauthorized"): Response {
    return this.respondWithError(new UnauthorizedError(message));
  }

  protected forbidden(message = "Forbidden"): Response {
    return this.respondWithError(new ForbiddenError(message));
  }

  protected badRequest(message = "Bad Request"): Response {
    return this.respondWithError(new BadRequestError(message));
  }

  protected serverError(message = "Internal Server Error"): Response {
    return this.respondWithError(new HttpError(message, 500));
  }

  protected respondWithError(error: HttpError): Response {
    const body: Record<string, unknown> = { error: error.message };
    if (error.details !== undefined) body.details = error.details;
    return this.json(body, { status: error.status });
  }

  protected get cookies(): Record<string, string> {
    const cookieStr = this.request.headers.get("cookie") || "";
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
  ): void {
    let cookie = `${name}=${value}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.secure) cookie += "; Secure";
    if (options.httpOnly) cookie += "; HttpOnly";
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    this._cookies.push(cookie);
  }

  protected deleteCookie(name: string): void {
    this.setCookie(name, "", { maxAge: 0 });
  }

  private _cookies: string[] = [];

  private sendCookies(response: Response): Response {
    if (this._cookies.length === 0) return response;
    const headers = new Headers(response.headers);
    for (const cookie of this._cookies) {
      headers.append("Set-Cookie", cookie);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export abstract class BaseResourceController<
  Ctx extends ControllerContext = ControllerContext,
  Env extends EnvLike = EnvLike,
  Req extends RequestLike = RequestLike,
  Svc = unknown,
  TSelect = any,
  TInsert = any,
> extends BaseController<Ctx, Env, Req, Svc> {
  protected getModel(): any {
    return this.getService();
  }

  protected get data(): any {
    return this.getModel();
  }

  protected getIdentifier(): string {
    const params = this.pathParams;
    const id = params.id ?? Object.values(params).reverse()[0];
    if (!id) {
      throw new Error(
        "getIdentifier() failed: no 'id' param found in route. " +
          "Define a route with :id or override getIdentifier() in your controller.",
      );
    }
    return id as string;
  }

  protected getScopeConditions(): Record<string, string> {
    const conditions: Record<string, string> = {};
    const columns: string[] = this.data?.columnNames ?? [];

    for (const [key, value] of Object.entries(this.pathParams)) {
      if (key !== "id" && columns.includes(key)) {
        conditions[key] = value;
      }
    }
    return conditions;
  }

  protected async getRequestData(): Promise<any> {
    try {
      return (await this.request.json()) || {};
    } catch {
      return {};
    }
  }

  protected async respondWith(data: any, options: { status?: number } = {}): Promise<Response> {
    if (data === null) return this.notFound();

    const accept = (this.request.headers.get("accept") || "").toLowerCase();
    const wantsXml = accept.includes("application/xml");
    const wantsCsv = accept.includes("text/csv");
    const wantsXlsx = accept.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    if (wantsXml) return this.xml(this.toXml(data), { status: options.status });
    if (wantsCsv) return this.csv(this.toCsv(data), { status: options.status });
    if (wantsXlsx) return this.xlsx(this.toXlsx(data), { status: options.status });
    return this.json(data, { status: options.status });
  }

  protected toXml(data: unknown): string {
    return JSON.stringify(data);
  }

  protected toCsv(data: unknown): string {
    return JSON.stringify(data);
  }

  protected toXlsx(_data: unknown): Uint8Array {
    return new Uint8Array();
  }

  async index(): Promise<Response> {
    const query = this.data.query();
    const conditions = this.getScopeConditions();

    if (Object.keys(conditions).length > 0) {
      query.where(conditions);
    }

    const items: TSelect[] = await query.all();
    return this.respondWith(items);
  }

  async show(): Promise<Response> {
    const id = this.getIdentifier();
    const conditions = { id, ...this.getScopeConditions() };
    const item: TSelect | null = await this.data.findBy(conditions);
    return this.respondWith(item);
  }

  async create(): Promise<Response> {
    const data = (await this.getRequestData()) as TInsert;
    if (!data || Object.keys(data).length === 0) {
      return this.badRequest("Missing request body");
    }

    const conditions = this.getScopeConditions();
    const dataWithScope = { ...data, ...conditions };
    const item: TSelect = await this.data.create(dataWithScope as TInsert);
    return this.respondWith(item, { status: 201 });
  }

  async update(): Promise<Response> {
    const id = this.getIdentifier();
    const data = (await this.getRequestData()) as Partial<TInsert>;
    const conditions = { id, ...this.getScopeConditions() };

    const existing = await this.data.findBy(conditions);
    if (!existing) return this.notFound();

    const item = await this.data.update(id, data);
    return this.respondWith(item);
  }

  async destroy(): Promise<Response> {
    const id = this.getIdentifier();
    const conditions = { id, ...this.getScopeConditions() };

    const existing = await this.data.findBy(conditions);
    if (!existing) return this.notFound();

    await this.data.delete(id);
    return this.json({ message: "Deleted" });
  }

  async new(): Promise<Response> {
    return this.respondWith({});
  }

  async edit(): Promise<Response> {
    const id = this.getIdentifier();
    const conditions = { id, ...this.getScopeConditions() };
    const item: TSelect | null = await this.data.findBy(conditions);
    return this.respondWith(item);
  }

  async trash(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;
    const conditions = { id, ...this.getScopeConditions() };
    const existing = await d.findBy(conditions);
    if (!existing) return this.notFound();

    if (typeof d.trash === "function") {
      await d.trash(id);
    } else {
      await d.update(id, { trashedAt: new Date().toISOString() });
    }
    return this.respondWith(existing);
  }

  async restore(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;

    if (typeof d.restore === "function") {
      await d.restore(id);
    } else {
      await d.update(id, { trashedAt: null });
    }

    const conditions = { id, ...this.getScopeConditions() };
    return this.respondWith(await d.findBy(conditions));
  }

  async hide(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;
    const conditions = { id, ...this.getScopeConditions() };
    const existing = await d.findBy(conditions);
    if (!existing) return this.notFound();

    if (typeof d.hide === "function") {
      await d.hide(id);
    } else {
      await d.update(id, { hiddenAt: new Date().toISOString() });
    }
    return this.respondWith(existing);
  }

  async unhide(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;

    if (typeof d.unhide === "function") {
      await d.unhide(id);
    } else {
      await d.update(id, { hiddenAt: null });
    }

    const conditions = { id, ...this.getScopeConditions() };
    return this.respondWith(await d.findBy(conditions));
  }

  async flag(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;
    const conditions = { id, ...this.getScopeConditions() };
    const existing = await d.findBy(conditions);
    if (!existing) return this.notFound();

    if (typeof d.flag === "function") {
      await d.flag(id);
    } else {
      await d.update(id, { flaggedAt: new Date().toISOString() });
    }
    return this.respondWith(existing);
  }

  async unflag(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;

    if (typeof d.unflag === "function") {
      await d.unflag(id);
    } else {
      await d.update(id, { flaggedAt: null });
    }

    const conditions = { id, ...this.getScopeConditions() };
    return this.respondWith(await d.findBy(conditions));
  }

  async purge(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;

    if (typeof d.purge === "function") {
      await d.purge(id);
    } else {
      await d.delete(id);
    }
    return this.json({ message: "Purged" });
  }

  async retire(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;
    const conditions = { id, ...this.getScopeConditions() };
    const existing = await d.findBy(conditions);
    if (!existing) return this.notFound();

    if (typeof d.retire === "function") {
      await d.retire(id);
    } else {
      await d.update(id, { retiredAt: new Date().toISOString() });
    }
    return this.respondWith(existing);
  }

  async unretire(): Promise<Response> {
    const id = this.getIdentifier();
    const d = this.data;

    if (typeof d.unretire === "function") {
      await d.unretire(id);
    } else {
      await d.update(id, { retiredAt: null });
    }

    const conditions = { id, ...this.getScopeConditions() };
    return this.respondWith(await d.findBy(conditions));
  }

  async listChildIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listChildIds(data.relation, id);
    return this.json({ ids });
  }

  async listParentIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listParentIds(data.relation, id);
    return this.json({ ids });
  }

  async listSiblingIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listSiblingIds(data.relation, id);
    return this.json({ ids });
  }

  async listCousinIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listCousinIds(data.relation, id);
    return this.json({ ids });
  }

  async listAncestorIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listAncestorIds(data.relation, id);
    return this.json({ ids });
  }

  async listDescendantIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listDescendantIds(data.relation, id);
    return this.json({ ids });
  }

  async listRelatedIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string };
    const id = this.getIdentifier();
    if (!data.relation) return this.badRequest("relation is required");

    const ids = await this.data.listRelatedIds(data.relation, id);
    return this.json({ ids });
  }

  async listAssociatedThroughIds(): Promise<Response> {
    const data = (await this.getRequestData()) as { relation?: string; through?: string };
    const id = this.getIdentifier();
    if (!data.relation || !data.through)
      return this.badRequest("relation and through are required");

    const ids = await this.data.listAssociatedThroughIds(data.relation, data.through, id);
    return this.json({ ids });
  }

  async findAllWith(): Promise<Response> {
    const data = (await this.getRequestData()) as {
      includes?: Record<string, any>;
      orderBy?: { column: string; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    };
    if (!data.includes || Object.keys(data.includes).length === 0) {
      return this.badRequest("includes is required");
    }

    const conditions = this.getScopeConditions();
    const items = await this.data.findAllWith(conditions, data.includes, {
      orderBy: data.orderBy,
      limit: data.limit,
      offset: data.offset,
    });
    return this.respondWith(items);
  }

  async findWith(): Promise<Response> {
    const data = (await this.getRequestData()) as {
      includes?: Record<string, any>;
    };
    if (!data.includes || Object.keys(data.includes).length === 0) {
      return this.badRequest("includes is required");
    }

    const conditions = this.getScopeConditions();
    const item = await this.data.findWith(conditions, data.includes);
    return this.respondWith(item);
  }
}
