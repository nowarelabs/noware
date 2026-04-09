import type { ExecutionContext } from '@cloudflare/workers-types';
import { {{serviceClassName}} } from '../services/{{tableName}}';
import { {{typeName}}Model } from '../models/{{modelFileName}}';
import { {{typeName}}, New{{typeName}} } from '../models/types/{{modelFileName}}';
import { RouterContext } from 'nomo/router';
import { BaseResourceController } from 'nomo/controllers';

export class {{pluralTypeName}}Controller extends BaseResourceController<
	Env,
	ExecutionContext,
	{{serviceClassName}},
	{{typeName}}Model,
	{{typeName}},
	New{{typeName}}
> {
	protected service: {{serviceClassName}};

	constructor(req: Request, env: Env, ctx: RouterContext<Env, ExecutionContext>) {
		super(req, env, ctx);
		this.service = new {{serviceClassName}}(this.request, this.env, this.ctx);
	}

	protected getModel() {
		return this.service.{{modelPropertyName}};
	}
}
