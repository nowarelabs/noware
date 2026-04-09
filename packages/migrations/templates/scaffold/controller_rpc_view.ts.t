import { BaseController } from 'nomo/controllers';
import { newWorkersRpcResponse } from 'nomo/rpc';
import type { AppExecutionContext } from 'nomo/router';
import { {{pluralTypeName}}Rpc } from '../../../rpc/{{tableName}}';

export class {{pluralTypeName}}RpcController extends BaseController<Env, AppExecutionContext> {
  protected service = null;
  async rpc() {
    return newWorkersRpcResponse(this.request, new {{pluralTypeName}}Rpc(this.request, this.env, this.ctx));
  }
}
