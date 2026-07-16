# Entrypoints

Protocol-agnostic entry point base classes for the Standard Gauge framework. Every entrypoint shares the same hook pipeline and delegates dispatch to an `abstract router: RouterLike`.

## Entrypoints

| Class                        | Input                                  | Output                                    | Public method                                                 | Protocol                                     |
| ---------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| `HttpEntrypoint`             | `Request`                              | `Response`                                | `fetch()`                                                     | HTTP / REST / GraphQL / Webhooks             |
| `RpcEntrypoint`              | `Request`                              | `Response`                                | `fetch()`                                                     | Cap'n Web / bidirectional RPC                |
| `WebSocketEntrypoint`        | `Request`                              | `Response`                                | `fetch()`                                                     | WebSocket upgrade + lifecycle                |
| `CliEntrypoint`              | `string[]`                             | `number`                                  | `main()`                                                      | Terminal / CLI commands                      |
| `IotEntrypoint<T>`           | `T`                                    | `void`                                    | `handleSignal()`                                              | Sensor / IoT device signals                  |
| `CronEntrypoint`             | `string`                               | `void`                                    | `handleTrigger()`                                             | Scheduled tasks / cron jobs                  |
| `QueueEntrypoint<T>`         | `T`                                    | `void`                                    | `handleMessage()`                                             | Message queues                               |
| `EmailEntrypoint<T>`         | `T`                                    | `void`                                    | `handleEmail()`                                               | Email routing                                |
| `TcpEntrypoint<T>`           | `T`                                    | `void`                                    | `onData()`                                                    | Raw TCP sockets                              |
| `UdpEntrypoint<T>`           | `T`                                    | `void`                                    | `onDatagram()`                                                | UDP datagrams                                |
| `DurableObjectEntrypoint`    | `DurableObjectEvent` (discriminated)   | `Response \| void`                        | `fetch()`, `alarm()`                                          | Durable Object lifecycle (fetch + alarm)     |
| `GrpcEntrypoint`             | `GrpcEvent` (discriminated)            | `Uint8Array \| AsyncIterable<Uint8Array>` | `unary()`, `serverStream()`, `clientStream()`, `bidiStream()` | gRPC-style remote calls                      |
| `WorkflowEntrypoint<TP, TR>` | `TP` (payload) + `WorkflowStep`        | `TR`                                      | `run()`                                                       | Step-based workflow orchestration            |
| `MessageEntrypoint<TB, TM>`  | `MessageEvent` (body + metadata tuple) | `void`                                    | `handleMessage()`                                             | Message brokers (Kafka, SQS, RabbitMQ, etc.) |

## Examples

### HttpEntrypoint (HTTP)

```ts
import { HttpEntrypoint } from "@nowarelabs/entrypoints";
import { BaseRouter } from "@nowarelabs/router";

class MyRouter extends BaseRouter {
  /* ... */
}

class MyEntrypoint extends HttpEntrypoint {
  router = new MyRouter();
}

export default { fetch: (req, env, ctx) => new MyEntrypoint().fetch(req, env, ctx) };
```

### RpcEntrypoint (Cap'n Web)

```ts
import { RpcEntrypoint } from "@nowarelabs/entrypoints";
import { RpcTarget, newWorkersRpcResponse } from "capnweb";

class MyApi extends RpcTarget {
  greet(name: string) {
    return `Hello, ${name}!`;
  }
}

class MyRpcEntrypoint extends RpcEntrypoint {
  router = {
    handle: (request: Request) => newWorkersRpcResponse(request, new MyApi()),
  };
}

export default { fetch: (req, env, ctx) => new MyRpcEntrypoint().fetch(req, env, ctx) };
```

### WebSocketEntrypoint

```ts
import { WebSocketEntrypoint } from "@nowarelabs/entrypoints";

class ChatWs extends WebSocketEntrypoint {
  router = {
    handle: (request: Request) => {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      server.addEventListener("message", (e) => server.send(`Echo: ${e.data}`));
      return new Response(null, { status: 101, webSocket: client });
    },
  };
}

export default { fetch: (req, env, ctx) => new ChatWs().fetch(req, env, ctx) };
```

### CliEntrypoint (terminal / CLI)

```ts
import { CliEntrypoint } from "@nowarelabs/entrypoints";

class DeployCommand extends CliEntrypoint {
  router = {
    handle: (argv: string[]) => {
      console.log(`Running: ${argv.join(" ")}`);
      return 0;
    },
  };
}

await new DeployCommand().main(process.argv.slice(2), {}, {});
```

### IotEntrypoint (sensor / IoT)

```ts
import { IotEntrypoint } from "@nowarelabs/entrypoints";

class TempSensor extends IotEntrypoint<number> {
  router = {
    handle: (celsius: number) => {
      console.log(`Temp: ${celsius}°C`);
    },
  };
}

await new TempSensor().handleSignal(22.5, env, ctx);
```

### CronEntrypoint (scheduled tasks)

```ts
import { CronEntrypoint } from "@nowarelabs/entrypoints";

class DailyReport extends CronEntrypoint {
  router = {
    handle: async (cron: string) => {
      await generateReport();
    },
  };
}

export default {
  scheduled: (event, env, ctx) => new DailyReport().handleTrigger(event.cron, env, ctx),
};
```

### QueueEntrypoint (message queues)

```ts
interface Order {
  orderId: string;
  items: string[];
}

class OrderProcessor extends QueueEntrypoint<Order> {
  router = {
    handle: async (body: Order) => {
      await fulfillOrder(body);
    },
  };
}

// Cloudflare Workers: queue consumer
export default {
  queue: (batch, env, ctx) => {
    for (const msg of batch.messages) {
      new OrderProcessor().handleMessage(msg.body, env, ctx);
    }
  },
};
```

### EmailEntrypoint (email routing)

```ts
class SupportEmail extends EmailEntrypoint<ForwardableEmailMessage> {
  router = {
    handle: async (msg) => {
      await msg.forward("support@example.com");
    },
  };
}

// Cloudflare Workers: email handler
export default {
  email: (message, env, ctx) => new SupportEmail().handleEmail(message, env, ctx),
};
```

### TcpEntrypoint (raw TCP)

```ts
import net from "node:net";
import { TcpEntrypoint } from "@nowarelabs/entrypoints";

class EchoServer extends TcpEntrypoint {
  router = {
    handle: (data: Uint8Array) => {
      /* send response */
    },
  };
}

net
  .createServer((socket) => {
    socket.on("data", (data) => new EchoServer().onData(data, env, ctx));
  })
  .listen(8080);
```

### UdpEntrypoint (UDP datagrams)

```ts
import dgram from "node:dgram";
import { UdpEntrypoint } from "@nowarelabs/entrypoints";

class LogCollector extends UdpEntrypoint {
  router = {
    handle: (data: Uint8Array) => {
      processLog(data);
    },
  };
}

dgram
  .createSocket("udp4")
  .on("message", (msg) => new LogCollector().onDatagram(msg, env, ctx))
  .bind(514);
```

### DurableObjectEntrypoint (DO lifecycle)

Uses an `abstract handler: DurableObjectHandlerLike` instead of `router`. Events are dispatched via a discriminated union through the same hook pipeline as all RouterLike entrypoints.

```ts
import { DurableObjectEntrypoint } from "@nowarelabs/entrypoints";

class MyDurableObject extends DurableObjectEntrypoint {
  handler = {
    fetch: async (request: Request, env, ctx) => {
      return new Response("Hello from DO");
    },
    alarm: async (env, ctx) => {
      console.log("Alarm fired");
    },
  };
}

// Runtime calls:
const do = new MyDurableObject();
await do.fetch(request, env, ctx);
await do.alarm(env, ctx);
```

### GrpcEntrypoint (gRPC-style streaming)

Uses an `abstract handler: GrpcHandlerLike` with support for unary, server-streaming, client-streaming, and bidirectional streaming.

```ts
import { GrpcEntrypoint } from "@nowarelabs/entrypoints";

class GreeterService extends GrpcEntrypoint {
  handler = {
    unary: async (request: Uint8Array, env, ctx) => {
      return new Uint8Array([
        /* ... */
      ]);
    },
    serverStream: async function* (request: Uint8Array, env, ctx) {
      yield new Uint8Array([0x01]);
      yield new Uint8Array([0x02]);
    },
    clientStream: async (requests: AsyncIterable<Uint8Array>, env, ctx) => {
      for await (const chunk of requests) {
        /* aggregate */
      }
      return new Uint8Array([0xff]);
    },
    bidiStream: async function* (requests: AsyncIterable<Uint8Array>, env, ctx) {
      for await (const chunk of requests) {
        yield chunk;
      }
    },
  };
}

const svc = new GreeterService();
await svc.unary(msg, env, ctx);
```

### MessageEntrypoint (Kafka / SQS / RabbitMQ / PubSub)

Uses an `abstract handler: MessageHandlerLike<TBody, TMetadata>` where `TMetadata` is a broker-specific envelope shape. Messages flow through the same hook pipeline as all `BaseEntrypoint` subclasses, but metadata is a first-class parameter rather than being embedded in the body.

```ts
import { MessageEntrypoint } from "@nowarelabs/entrypoints";

interface KafkaMeta {
  topic: string;
  partition: number;
  offset: string;
  key: Buffer | null;
  timestamp: string;
  headers: Record<string, Buffer | Buffer[]>;
}

class OrderConsumer extends MessageEntrypoint<Buffer, KafkaMeta> {
  handler = {
    handle: async (body: Buffer, meta: KafkaMeta, env, ctx) => {
      console.log(`[${meta.topic}:${meta.partition}@${meta.offset}] ${body.toString()}`);
    },
  };
}

// Kafka consumer loop:
// consumer.eachMessage(async ({ topic, partition, message }) => {
//   await new OrderConsumer().handleMessage(
//     message.value!,
//     { topic, partition, offset: message.offset, key: message.key, timestamp: message.timestamp, headers: message.headers },
//     env, ctx,
//   );
// });
```

### WorkflowEntrypoint (step-based orchestration)

Uses an `abstract handler: WorkflowHandlerLike`. Extends `BaseEntrypoint` — hooks wrap the entire `execute()` call identically to all other entrypoints. The `WorkflowStep` parameter is set on the instance before the hook pipeline runs, so `handler.run()` receives it inside the protected `run()` method.

```ts
import { WorkflowEntrypoint } from "@nowarelabs/entrypoints";

class OrderWorkflow extends WorkflowEntrypoint<{ orderId: string }, string> {
  handler = {
    run: async (payload, step, env, ctx) => {
      const result = await step.do("process", async () => {
        return `Processed ${payload.orderId}`;
      });
      return result;
    },
  };
}

// Runtime calls execute(payload, step, env, ctx)
const result = await new OrderWorkflow().execute({ orderId: "abc" }, workflowStep, env, ctx);
```

## Hooks

All 14 entrypoints support static hook registration:

```ts
OrderProcessor.before(async (ep) => {
  if (!process.env.ACTIVE) return; // skip
});
OrderProcessor.around(async (ep, next) => {
  console.time("process");
  const result = await next();
  console.timeEnd("process");
  return result;
});
```

## Development

```bash
vp install
vp test
vp pack
```
