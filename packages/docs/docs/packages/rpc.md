# RPC

Remote Procedure Call over HTTP for inter-service communication.

## BaseResourceRpcTarget

```typescript
import { BaseResourceRpcTarget } from 'nomo/rpc';
import { RouterContext } from 'nomo/router';
import { PostsController } from '../controllers/posts_controller';

export class PostsRpc extends BaseResourceRpcTarget<Env, RouterContext<Env, any>, PostsController> {
  protected controllerClass = PostsController;
}
```

## RPC Controller

```typescript
import { BaseController } from 'nomo/controllers';
import { newWorkersRpcResponse } from 'nomo/rpc';

export class PostsRpcController extends BaseController<Env, ExecutionContext> {
  async rpc() {
    return newWorkersRpcResponse(
      this.request,
      new PostsRpc(this.request, this.env, this.ctx)
    );
  }
}
```

## Router Setup

```typescript
// In routes.ts
this.namespace('rpc', (rpc) => {
  rpc.post('/posts', PostsRpcController.action('rpc'));
});
```

## Client

```typescript
// Call RPC from another service
const response = await this.fetch('https://worker.example.com/rpc/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-RPC-Method': 'create' },
  body: JSON.stringify({ title: 'New Post', content: 'Content' })
});
```