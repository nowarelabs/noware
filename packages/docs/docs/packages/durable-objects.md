# Durable Objects

Stateful coordination for real-time features and distributed state.

## BaseDurableObject

```typescript
import { BaseDurableObject } from 'nomo/durable-objects';

export class ChatRoomDO extends BaseDurableObject {
  async onMessage(message: string) {
    const messages = await this.storage.get('messages') || [];
    messages.push(message);
    await this.storage.put('messages', messages);
  }

  async onConnect(request: Request): Promise<Response> {
    const [client, server] = new WebSocketPair();
    this.addClient(client);
    return new Response(null, { status: 101, webSocket: server });
  }
}
```

## Storage Methods

```typescript
// Get/Set
await this.storage.get('key');
await this.storage.put('key', 'value');
await this.storage.delete('key');

// List
const keys = await this.storage.list();

// Alarms
await this.storage.setAlarm(Date.now() + 60000); // 1 minute
async alarm() { /* handle alarm */ }
```

## With Drizzle ORM

```typescript
import { drizzle } from 'drizzle-orm/durable-object-sqlite';

export class BlogDO extends BaseDurableObject {
  db: any;

  constructor(state, env) {
    super(state, env);
    this.db = drizzle(this.storage, { schema });
  }
}
```