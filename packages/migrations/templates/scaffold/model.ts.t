import { BaseModel, type DatabaseInstance } from 'nomo/models';
import { RouterContext } from 'nomo/router';
import { {{tableName}} } from '../db/schema/schema';
import type { {{typeName}}, New{{typeName}} } from '../models/types/{{modelFileName}}';

export class {{typeName}}Model extends BaseModel<
	typeof {{tableName}},
	{{typeName}},
	New{{typeName}}
> {
	constructor(
		db: DatabaseInstance,
		req: Request,
		env: Env,
		ctx: RouterContext<Env, ExecutionContext>
	) {
		super(db, {{tableName}}, req, env, ctx);
{{relationships}}	}
}
