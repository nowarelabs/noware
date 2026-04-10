# Architecture

Nomo follows a layered architecture pattern for building serverless applications on Cloudflare Workers.

## Overview

```mermaid
graph TB
    subgraph "Client"
        A[Browser/Mobile]
    end
    
    subgraph "Cloudflare Edge"
        B[Workers]
        C[Durable Objects]
        D[KV]
        E[D1 Database]
    end
    
    A -->|HTTP| B
    B -->|Request| C
    B -->|Storage| D
    B -->|Query| E
```

## Request Flow

```mermaid
sequenceDiagram
    participant User
    participant Worker
    participant Router
    participant Controller
    participant Service
    participant Model
    
    User->>Worker: HTTP Request
    Worker->>Router: Route to Controller
    Router->>Controller: Invoke Action
    Controller->>Service: Call Service
    Service->>Model: Database Query
    Model-->>Service: Data
    Service-->>Controller: Result
    Controller-->>Worker: Response
    Worker-->>User: HTTP Response
```

## Layers

### 1. Entrypoints
Entrypoints handle incoming HTTP requests at the edge.

```mermaid
graph LR
    A[Request] --> B[Parse Headers]
    B --> C[CORS Check]
    C --> D[Auth Check]
    D --> E[Route to Controller]
```

### 2. Controllers
Controllers contain business logic and orchestrate services.

```typescript
export class UsersController extends BaseController {
  protected service = userService;

  async index() {
    const users = await this.service.list();
    return this.json(users);
  }
}
```

### 3. Services
Services handle external integrations and business rules.

```typescript
export class UserService extends BaseService {
  async list(): Promise<User[]> {
    return this.model.query().all();
  }
}
```

### 4. Models
Models define data structures and handle database operations.

```typescript
export class UserModel extends BaseModel {
  table = users;
  
  async findByEmail(email: string) {
    return this.query().where({ email }).first();
  }
}
```

## State Management

```mermaid
graph TB
    subgraph "State Options"
        A[KV Storage] --> B[Simple key-value]
        C[Durable Objects] --> D[Stateful coordination]
        E[D1 Database] --> F[Relational data]
    end
    
    B --> G[Application State]
    D --> G
    F --> G
```

### KV Storage
Best for caching and simple key-value data.

### Durable Objects
Best for stateful coordination, WebSockets, and real-time features.

### D1 Database
Best for persistent relational data.

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        A[Local Dev] --> B[Wrangler Dev]
    end
    
    subgraph "Production"
        C[GitHub Push] --> D[CI/CD]
        D --> E[Workers Deploy]
        E --> F[Edge Network]
    end
    
    B --> C
```

## Best Practices

1. **Keep Controllers thin** - Delegate business logic to services
2. **Use Models for data** - Encapsulate database operations
3. **Leverage Durable Objects** - For stateful workloads
4. **Use KV for caching** - Reduce database load
5. **Process async with Queues** - Handle background jobs