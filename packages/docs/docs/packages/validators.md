# Validators

Input validation using Zod schemas.

## BaseValidator

```typescript
import { BaseValidator } from 'nomo/validators';
import { z } from 'zod';

export class PostsValidator extends BaseValidator {
  protected schema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    published: z.boolean().optional(),
    authorId: z.string().uuid()
  });
}
```

## Usage in Controller

```typescript
export class PostsController extends BaseResourceController {
  static beforeActions = [
    { validate: PostsValidator, only: ['create', 'update'] }
  ];
}
```