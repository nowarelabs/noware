import {
  RpcTarget,
  RpcStub,
  RpcPromise,
  newHttpBatchRpcSession,
  newWebSocketRpcSession,
  newWorkersRpcResponse,
  newMessagePortRpcSession,
} from "capnweb";
import { Logger } from "nomo/logger";
import { RouterContext } from "nomo/router";

// ============================================================================
// ACTION TYPES
// ============================================================================

export type CrudAction = 'create' | 'show' | 'update' | 'destroy' | 'index';

export type LifecycleAction = 'trash' | 'restore' | 'hide' | 'unhide' | 'flag' | 'unflag' | 'purge' | 'retire' | 'unretire';

export type AsyncAction = 'queue' | 'cron';

export type SpecialAction = 'add' | 'remove' | 'assign' | 'unassign';

export type RelationTraversalAction = 
  | 'listChildIds' | 'listParentIds' | 'listSiblingIds' | 'listCousinIds'
  | 'listAncestorIds' | 'listDescendantIds' | 'listAssociatedThroughIds' | 'listRelatedIds';

export type IncludeAction = 'findAllWith' | 'findWith';

export type QueryAction = 'findAllBy' | 'findByIds' | 'pluck';

export type Action = CrudAction | LifecycleAction | AsyncAction | SpecialAction | RelationTraversalAction | IncludeAction | QueryAction;

// ============================================================================
// BASE INTERFACES
// ============================================================================

/** Minimal base class for RPC targets */
export abstract class BaseRpcTarget extends RpcTarget {}

/** Interface for controllers that can be used with RPC targets */
export interface IRpcController {
	runAction(action: string): Promise<Response>;
	withParams(params: Record<string, unknown>): this;
}

// ============================================================================
// BASE RESOURCE RPC TARGET
// ============================================================================

/** Base class for resource RPC targets (list, get, create, update, delete) */
export abstract class BaseResourceRpcTarget<
	Env = unknown,
	Ctx = RouterContext<any, any>,
	Controller extends IRpcController = IRpcController
> extends BaseRpcTarget {
	protected request: Request;
	protected env: Env;
	protected ctx: Ctx;
	protected logger: Logger;

	constructor(request: Request, env: Env, ctx: Ctx) {
		super();
		this.request = request;
		this.env = env;
		this.ctx = ctx;
		this.logger = new Logger({ service: 'rpc', context: { component: this.constructor.name } });
	}

	protected abstract controllerClass: new (request: Request, env: Env, ctx: Ctx) => Controller;

	protected controller(): Controller {
		return new this.controllerClass(this.request, this.env, this.ctx);
	}

	protected async runAction<T = any>(action: Action, params: Record<string, unknown> = {}): Promise<T> {
		try {
			const res = await this.controller().withParams(params).runAction(action);
			return await res.json();
		} catch (error) {
			this.logger.error(`[${action.toUpperCase()} ERROR]`, { action, params, error: (error as Error).message });
			throw error;
		}
	}

	// ===== CRUD Actions =====

	async list(params: Record<string, unknown> = {}): Promise<any> {
		this.logger.debug(`[LIST]`, { params });
		try {
			const res = await this.controller().withParams(params).runAction('index');
			const jsonResult = await res.json();
			this.logger.debug(`[LIST] count=${Array.isArray(jsonResult) ? jsonResult.length : 'unknown'}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[LIST ERROR]`, { error: (error as Error).message });
			throw error;
		}
	}

	async get(id: string, params: Record<string, unknown> = {}): Promise<any> {
		this.logger.debug(`[GET] ${id}`, { params });
		try {
			const res = await this.controller().withParams({ id, ...params }).runAction('show');
			const jsonResult = await res.json();
			this.logger.debug(`[GET] ${id} found=${!!jsonResult}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[GET ERROR] ${id}`, { error: (error as Error).message });
			throw error;
		}
	}

	async create(data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[CREATE]`, { data });
		try {
			const res = await this.controller().withParams(data).runAction('create');
			const jsonResult = await res.json();
			this.logger.info(`[CREATE] ${(jsonResult as any)?.id}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[CREATE ERROR]`, { data, error: (error as Error).message });
			throw error;
		}
	}

	async update(id: string, data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[UPDATE] ${id}`, { data });
		try {
			const res = await this.controller().withParams({ id, ...data }).runAction('update');
			const jsonResult = await res.json();
			this.logger.info(`[UPDATE] ${id}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[UPDATE ERROR] ${id}`, { data, error: (error as Error).message });
			throw error;
		}
	}

	async delete(id: string): Promise<any> {
		this.logger.debug(`[DELETE] ${id}`);
		try {
			const res = await this.controller().withParams({ id }).runAction('destroy');
			const jsonResult = await res.json();
			this.logger.info(`[DELETE] ${id}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[DELETE ERROR]`, { error: (error as Error).message });
			throw error;
		}
	}

	// ===== Lifecycle Actions =====

	async trash(id: string): Promise<any> {
		this.logger.debug(`[TRASH] ${id}`);
		return this.runAction('trash', { id });
	}

	async restore(id: string): Promise<any> {
		this.logger.debug(`[RESTORE] ${id}`);
		return this.runAction('restore', { id });
	}

	async hide(id: string): Promise<any> {
		this.logger.debug(`[HIDE] ${id}`);
		return this.runAction('hide', { id });
	}

	async unhide(id: string): Promise<any> {
		this.logger.debug(`[UNHIDE] ${id}`);
		return this.runAction('unhide', { id });
	}

	async flag(id: string): Promise<any> {
		this.logger.debug(`[FLAG] ${id}`);
		return this.runAction('flag', { id });
	}

	async unflag(id: string): Promise<any> {
		this.logger.debug(`[UNFLAG] ${id}`);
		return this.runAction('unflag', { id });
	}

	async purge(id: string): Promise<any> {
		this.logger.debug(`[PURGE] ${id}`);
		return this.runAction('purge', { id });
	}

	async retire(id: string): Promise<any> {
		this.logger.debug(`[RETIRE] ${id}`);
		return this.runAction('retire', { id });
	}

	async unretire(id: string): Promise<any> {
		this.logger.debug(`[UNRETIRE] ${id}`);
		return this.runAction('unretire', { id });
	}

	// ===== Async Actions =====

	async queue(id: string, data?: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[QUEUE] ${id}`, { data });
		return this.runAction('queue', { id, ...data });
	}

	async cron(id: string, data?: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[CRON] ${id}`, { data });
		return this.runAction('cron', { id, ...data });
	}

	// ===== Special Actions =====

	async add(id: string, data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[ADD] ${id}`, { data });
		return this.runAction('add', { id, ...data });
	}

	async remove(id: string, data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[REMOVE] ${id}`, { data });
		return this.runAction('remove', { id, ...data });
	}

	async assign(id: string, data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[ASSIGN] ${id}`, { data });
		return this.runAction('assign', { id, ...data });
	}

	async unassign(id: string, data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[UNASSIGN] ${id}`, { data });
		return this.runAction('unassign', { id, ...data });
	}

  // ===== Relationship Traversal =====

  async listChildIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_CHILD_IDS] ${relation}#${id}`);
    return this.runAction('listChildIds', { relation, id });
  }

  async listParentIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_PARENT_IDS] ${relation}#${id}`);
    return this.runAction('listParentIds', { relation, id });
  }

  async listSiblingIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_SIBLING_IDS] ${relation}#${id}`);
    return this.runAction('listSiblingIds', { relation, id });
  }

  async listCousinIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_COUSIN_IDS] ${relation}#${id}`);
    return this.runAction('listCousinIds', { relation, id });
  }

  async listAncestorIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_ANCESTOR_IDS] ${relation}#${id}`);
    return this.runAction('listAncestorIds', { relation, id });
  }

  async listDescendantIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_DESCENDANT_IDS] ${relation}#${id}`);
    return this.runAction('listDescendantIds', { relation, id });
  }

  async listAssociatedThroughIds(relation: string, through: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_ASSOCIATED_THROUGH_IDS] ${relation}#${id}`, { through });
    return this.runAction('listAssociatedThroughIds', { relation, through, id });
  }

  async listRelatedIds(relation: string, id: string): Promise<{ ids: (string | number)[] }> {
    this.logger.debug(`[LIST_RELATED_IDS] ${relation}#${id}`);
    return this.runAction('listRelatedIds', { relation, id });
  }

  // ===== Pluck for RPC chain mapping =====
  // Returns raw IDs for use with .map() in capnweb

  async pluck(column: string, conditions?: Record<string, any>): Promise<any[]> {
    return this.runAction('pluck' as any, { column, conditions });
  }

  async findAllBy(
    conditions: Record<string, any>,
    options?: {
      orderBy?: { column: string; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    return this.runAction('findAllBy' as any, { conditions, options });
  }

  async findByIds(ids: (string | number)[]): Promise<any[]> {
    return this.runAction('findByIds' as any, { ids });
  }

  // ===== Include Methods for Eager Loading =====

  async findAllWith(
    conditions: Record<string, any>,
    includes: Record<string, { model: string; foreignKey: string }>,
    options?: {
      orderBy?: { column: string; direction?: "ASC" | "DESC" };
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    return this.runAction('findAllWith' as any, { conditions, includes, options });
  }

  async findWith(
    conditions: Record<string, any>,
    includes: Record<string, { model: string; foreignKey: string }>,
  ): Promise<any> {
    return this.runAction('findWith' as any, { conditions, includes });
  }
}

// ============================================================================
// BASE RESOURCE INSTANCE RPC TARGET
// ============================================================================

/** Base class for resource instance RPC targets (get, update, delete) */
export abstract class BaseResourceInstanceRpcTarget<
	Env = unknown,
	Ctx = RouterContext<any, any>,
	Controller extends IRpcController = IRpcController
> extends BaseRpcTarget {
	protected id: string;
	protected request: Request;
	protected env: Env;
	protected ctx: Ctx;
	protected logger: Logger;

	constructor(id: string, request: Request, env: Env, ctx: Ctx) {
		super();
		this.id = id;
		this.request = request;
		this.env = env;
		this.ctx = ctx;
		this.logger = new Logger({ service: 'rpc', context: { component: this.constructor.name } });
	}

	protected abstract controllerClass: new (request: Request, env: Env, ctx: Ctx) => Controller;

	protected controller(): Controller {
		return new this.controllerClass(this.request, this.env, this.ctx);
	}

	protected async runAction<T = any>(action: Action, params: Record<string, unknown> = {}): Promise<T> {
		try {
			const res = await this.controller().withParams({ id: this.id, ...params }).runAction(action);
			return await res.json();
		} catch (error) {
			this.logger.error(`[${action.toUpperCase()} ERROR]`, { action, id: this.id, params, error: (error as Error).message });
			throw error;
		}
	}

	async get(params: Record<string, unknown> = {}): Promise<any> {
		this.logger.debug(`[GET] ${this.id}`, { params });
		try {
			const res = await this.controller().withParams({ id: this.id, ...params }).runAction('show');
			const jsonResult = await res.json();
			this.logger.debug(`[GET] ${this.id} found=${!!jsonResult}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[GET ERROR] ${this.id}`, { error: (error as Error).message });
			throw error;
		}
	}

	async update(data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[UPDATE] ${this.id}`, { data });
		try {
			const res = await this.controller().withParams({ id: this.id, ...data }).runAction('update');
			const jsonResult = await res.json();
			this.logger.info(`[UPDATE] ${this.id}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[UPDATE ERROR] ${this.id}`, { data, error: (error as Error).message });
			throw error;
		}
	}

	async delete(): Promise<any> {
		this.logger.debug(`[DELETE] ${this.id}`);
		try {
			const res = await this.controller().withParams({ id: this.id }).runAction('destroy');
			const jsonResult = await res.json();
			this.logger.info(`[DELETE] ${this.id}`);
			return jsonResult;
		} catch (error) {
			this.logger.error(`[DELETE ERROR] ${this.id}`, { error: (error as Error).message });
			throw error;
		}
	}

	// ===== Lifecycle Actions =====

	async trash(): Promise<any> {
		this.logger.debug(`[TRASH] ${this.id}`);
		return this.runAction('trash');
	}

	async restore(): Promise<any> {
		this.logger.debug(`[RESTORE] ${this.id}`);
		return this.runAction('restore');
	}

	async hide(): Promise<any> {
		this.logger.debug(`[HIDE] ${this.id}`);
		return this.runAction('hide');
	}

	async unhide(): Promise<any> {
		this.logger.debug(`[UNHIDE] ${this.id}`);
		return this.runAction('unhide');
	}

	async flag(): Promise<any> {
		this.logger.debug(`[FLAG] ${this.id}`);
		return this.runAction('flag');
	}

	async unflag(): Promise<any> {
		this.logger.debug(`[UNFLAG] ${this.id}`);
		return this.runAction('unflag');
	}

	async purge(): Promise<any> {
		this.logger.debug(`[PURGE] ${this.id}`);
		return this.runAction('purge');
	}

	async retire(): Promise<any> {
		this.logger.debug(`[RETIRE] ${this.id}`);
		return this.runAction('retire');
	}

	async unretire(): Promise<any> {
		this.logger.debug(`[UNRETIRE] ${this.id}`);
		return this.runAction('unretire');
	}

	// ===== Async Actions =====

	async queue(data?: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[QUEUE] ${this.id}`, { data });
		return this.runAction('queue', data || {});
	}

	async cron(data?: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[CRON] ${this.id}`, { data });
		return this.runAction('cron', data || {});
	}

	// ===== Special Actions =====

	async add(data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[ADD] ${this.id}`, { data });
		return this.runAction('add', data);
	}

	async remove(data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[REMOVE] ${this.id}`, { data });
		return this.runAction('remove', data);
	}

	async assign(data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[ASSIGN] ${this.id}`, { data });
		return this.runAction('assign', data);
	}

	async unassign(data: Record<string, unknown>): Promise<any> {
		this.logger.debug(`[UNASSIGN] ${this.id}`, { data });
		return this.runAction('unassign', data);
	}

	// ===== Relationship Traversal =====

	async listChildIds(): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_CHILD_IDS] ${this.id}`);
		return this.runAction('listChildIds');
	}

	async listParentIds(): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_PARENT_IDS] ${this.id}`);
		return this.runAction('listParentIds');
	}

	async listSiblingIds(): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_SIBLING_IDS] ${this.id}`);
		return this.runAction('listSiblingIds');
	}

	async listCousinIds(): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_COUSIN_IDS] ${this.id}`);
		return this.runAction('listCousinIds');
	}

	async listAncestorIds(): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_ANCESTOR_IDS] ${this.id}`);
		return this.runAction('listAncestorIds');
	}

	async listDescendantIds(): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_DESCENDANT_IDS] ${this.id}`);
		return this.runAction('listDescendantIds');
	}

	async listAssociatedThroughIds(through: string): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_ASSOCIATED_THROUGH_IDS] ${this.id}`, { through });
		return this.runAction('listAssociatedThroughIds', { through });
	}

	async listRelatedIds(relation: string): Promise<{ ids: (string | number)[] }> {
		this.logger.debug(`[LIST_RELATED_IDS] ${this.id}`, { relation });
		return this.runAction('listRelatedIds', { relation });
	}

	// ===== Pluck for RPC chain mapping =====

	async pluck(column: string, conditions?: Record<string, any>): Promise<any[]> {
		return this.runAction('pluck' as any, { column, conditions });
	}

	async findAllBy(
		conditions: Record<string, any>,
		options?: {
			orderBy?: { column: string; direction?: "ASC" | "DESC" };
			limit?: number;
			offset?: number;
		},
	): Promise<any[]> {
		return this.runAction('findAllBy' as any, { conditions, options });
	}
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

/** Re-export essential RPC primitives */
export {
  RpcStub,
  RpcPromise,
  newHttpBatchRpcSession,
  newWebSocketRpcSession,
  newWorkersRpcResponse,
  newMessagePortRpcSession,
};
