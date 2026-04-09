import { newHttpBatchRpcSession, RpcStub } from "capnweb";

const MUTATION_METHODS = new Set(["create", "update", "delete"]);
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export class RpcClient {
  #paths = new Map();
  #cache = new Map();
  #pending = new Map();
  #storageKey;

  constructor(baseUrl = "", options = {}) {
    this.baseUrl = baseUrl;
    this.#storageKey = `nofo:rpc:cache:${baseUrl}`;
    this.options = {
      headers: options.headers || {},
      timeout: options.timeout || 30000,
      staleTime: options.staleTime ?? DEFAULT_STALE_TIME,
      persist: options.persist !== false,
      onError: options.onError || (() => {}),
      ...options,
    };

    if (this.options.persist) {
      this.#restoreCache();
    }
  }

  #cacheKey(op) {
    return `${op.endpoint}:${op.method}:${JSON.stringify(op.params || op.id || "")}`;
  }

  #getCacheEntry(key) {
    const entry = this.#cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.options.staleTime) {
      this.#cache.delete(key);
      this.#persistCache();
      return null;
    }
    return entry;
  }

  #setCacheEntry(key, data) {
    this.#cache.set(key, { data, timestamp: Date.now() });
    this.#persistCache();
  }

  #persistCache() {
    if (!this.options.persist) return;
    try {
      const serializable = {};
      for (const [key, entry] of this.#cache.entries()) {
        serializable[key] = { data: entry.data, timestamp: entry.timestamp };
      }
      sessionStorage.setItem(this.#storageKey, JSON.stringify(serializable));
    } catch {}
  }

  #restoreCache() {
    try {
      const raw = sessionStorage.getItem(this.#storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const [key, entry] of Object.entries(parsed)) {
        this.#cache.set(key, entry);
      }
    } catch {}
  }

  invalidateCache(endpoint) {
    for (const key of this.#cache.keys()) {
      if (key.startsWith(`${endpoint}:`)) {
        this.#cache.delete(key);
      }
    }
    this.#persistCache();
  }

  clearCache() {
    this.#cache.clear();
    this.#pending.clear();
    this.#persistCache();
  }

  endpoint(name, path) {
    if (path) {
      this.#paths.set(name, path);
    }
    const storedPath = this.#paths.get(name) || `/${name}`;
    const fullPath = String(storedPath).startsWith("/") ? storedPath : `/${storedPath}`;
    const url = this.baseUrl + fullPath;
    return newHttpBatchRpcSession(url);
  }

  async query(operations) {
    const ops = Array.isArray(operations) ? operations : [operations];
    const promises = [];

    for (const op of ops) {
      const isQuery = !MUTATION_METHODS.has(op.method);
      const cacheKey = isQuery ? this.#cacheKey(op) : null;

      if (isQuery && cacheKey) {
        const cached = this.#getCacheEntry(cacheKey);
        if (cached) {
          promises.push(
            Promise.resolve({ data: cached.data, error: null, operation: op, cached: true }),
          );
          continue;
        }

        const pending = this.#pending.get(cacheKey);
        if (pending) {
          promises.push(
            pending.then((data) => ({ data, error: null, operation: op, deduped: true })),
          );
          continue;
        }
      }

      const session = this.endpoint(op.endpoint);
      let promise;

      switch (op.method) {
        case "create":
          promise = session.create(op.data);
          break;
        case "get":
          promise = session.get(op.id);
          break;
        case "list":
          promise = session.list(op.params || {});
          break;
        case "update":
          promise = session.update(op.id, op.data);
          break;
        case "delete":
          promise = session.delete(op.id);
          break;
        default:
          promise = Promise.resolve({ error: `Unknown method: ${op.method}` });
      }

      const resultPromise = this.#handleResult(promise, op, cacheKey);
      promises.push(resultPromise);

      if (isQuery && cacheKey) {
        this.#pending.set(
          cacheKey,
          resultPromise.then((r) => r.data),
        );
        resultPromise.finally(() => this.#pending.delete(cacheKey));
      }
    }

    const results = await Promise.all(promises);
    return Array.isArray(operations) ? results : results[0];
  }

  async #handleResult(promise, op, cacheKey) {
    try {
      const result = await promise;
      const id = result?.id;
      if (cacheKey) {
        this.#setCacheEntry(cacheKey, result);
      }
      return { data: result, id, error: null, operation: op };
    } catch (err) {
      this.options.onError(err, op);
      return { data: null, id: null, error: err.message || err, operation: op };
    }
  }

  create(endpoint, data) {
    return this.query({ endpoint, method: "create", data }).then((r) => {
      if (!r.error) this.invalidateCache(endpoint);
      return r;
    });
  }

  get(endpoint, id) {
    return this.query({ endpoint, method: "get", id });
  }

  list(endpoint, params) {
    return this.query({ endpoint, method: "list", params });
  }

  update(endpoint, id, data) {
    return this.query({ endpoint, method: "update", id, data }).then((r) => {
      if (!r.error) this.invalidateCache(endpoint);
      return r;
    });
  }

  delete(endpoint, id) {
    return this.query({ endpoint, method: "delete", id }).then((r) => {
      if (!r.error) this.invalidateCache(endpoint);
      return r;
    });
  }
}

export function createRpcClient(baseUrl, options) {
  return new RpcClient(baseUrl, options);
}

export class NofoRpc {
  #client;
  #endpoints = [];

  constructor(baseUrl = "", options = {}) {
    this.#client = new RpcClient(baseUrl, options);
  }

  configure(endpoints) {
    this.#endpoints = endpoints;
    for (const { name, path } of endpoints) {
      this.#client.endpoint(name, path);
    }
    return this;
  }

  get api() {
    const proxy = new Proxy(
      {},
      {
        get: (_, endpoint) => {
          return new Proxy(
            {},
            {
              get: (_, method) => {
                return (dataOrIdOrId, data) => {
                  if (method === "create" || method === "list") {
                    return this.#client[method](endpoint, dataOrIdOrId);
                  } else if (method === "get" || method === "delete") {
                    return this.#client[method](endpoint, dataOrIdOrId);
                  } else if (method === "update") {
                    return this.#client[method](endpoint, dataOrIdOrId, data);
                  }
                };
              },
            },
          );
        },
      },
    );
    return proxy;
  }

  async batch(operations) {
    return this.#client.query(operations);
  }

  getClient() {
    return this.#client;
  }
}

export function createNofoRpc(baseUrl, options) {
  return new NofoRpc(baseUrl, options);
}
