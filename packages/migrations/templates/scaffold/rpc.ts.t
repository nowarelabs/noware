import { BaseResourceRpcTarget } from 'nomo/rpc';
import { RouterContext } from 'nomo/router';
import { {{pluralTypeName}}Controller } from '../controllers/{{tableName}}_controller';

export class {{pluralTypeName}}Rpc extends BaseResourceRpcTarget<
	Env,
	RouterContext<Env, any>,
	{{pluralTypeName}}Controller
> {
	protected controllerClass = {{pluralTypeName}}Controller;
}
