# Normalizers

Data transformation and sanitization.

## BaseNormalizer

```typescript
import { BaseNormalizer } from 'nomo/normalizers';

export class PostsNormalizer extends BaseNormalizer {
  normalize() {
    return {
      ...this.data,
      title: this.data.title?.trim(),
      slug: this.data.title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      content: this.data.content?.trim()
    };
  }
}
```

## Usage

```typescript
// Automatic via controller hooks
export class PostsController extends BaseResourceController {
  static beforeActions = [
    { normalize: PostsNormalizer, only: ['create', 'update'] }
  ];
}
```