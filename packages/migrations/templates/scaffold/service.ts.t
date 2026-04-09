import type { ExecutionContext } from '@cloudflare/workers-types';
import type { RouterContext } from 'nomo/router';
import { BaseService } from 'nomo/services';
import { {{typeName}}Model } from '../models/{{modelFileName}}';

export class {{serviceClassName}} extends BaseService<Env, ExecutionContext> {
	public {{modelPropertyName}}: {{typeName}}Model;

	constructor(req: Request, env: Env, ctx: RouterContext<Env, ExecutionContext>) {
		super(req, env, ctx);
		this.{{modelPropertyName}} = new {{typeName}}Model(this.db, req, env, ctx);
	}
}
