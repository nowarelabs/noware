# nomo/rpc

A thin wrapper around `capnweb` for RPC in nomo applications.

## Features

- **BaseRpcTarget**: Extend this to define your RPC services.
- **Thin Session Creators**: Lightweight wrappers for `newHttpBatchRpcSession`, `newWebSocketRpcSession`, `newWorkersRpcResponse`, and `newMessagePortRpcSession`.
- **Stream Support**: Pass `ReadableStream` or `WritableStream` directly over RPC.

## Installation

```bash
pnpm add nomo/rpc
```

## Usage

### 1. Define an Interface

```typescript
import { RpcTarget } from "nomo/rpc";

interface MyApi extends RpcTarget {
  greet(name: string): string;
}
```

### 2. Implementation (Server)

```typescript
import { BaseRpcTarget, newWorkersRpcResponse } from "nomo/rpc";

class MyApiImpl extends BaseRpcTarget implements MyApi {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

// In a Worker fetch handler:
export default {
  fetch(request: Request) {
    return newWorkersRpcResponse(request, new MyApiImpl());
  },
};
```

### 3. Usage (Client - Batch)

```typescript
import { RpcStub, newHttpBatchRpcSession } from "nomo/rpc";

using stub: RpcStub<MyApi> = newHttpBatchRpcSession<MyApi>("https://example.com/api");

const result = await stub.greet("Alice");
console.log(result);
```

### 4. MessagePort RPC

```typescript
import { BaseRpcTarget, RpcStub, newMessagePortRpcSession } from "nomo/rpc";

class Greeter extends BaseRpcTarget {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

const channel = new MessageChannel();
newMessagePortRpcSession(channel.port1, new Greeter());

using stub: RpcStub<Greeter> = newMessagePortRpcSession<Greeter>(channel.port2);
console.log(await stub.greet("Alice"));
```

### 5. Passing Streams

You can pass `ReadableStream` or `WritableStream` directly as arguments or return values.

```typescript
interface FileApi extends RpcTarget {
  upload(stream: ReadableStream): Promise<void>;
}
```

---

## License

MIT
