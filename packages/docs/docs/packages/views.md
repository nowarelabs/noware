# Views

JSX-based view rendering for server-rendered HTML responses.

## BaseView

```typescript
import { BaseView } from 'nomo/views';

export class PostView extends BaseView<{ post: Post }> {
  render() {
    const { post } = this.props;
    return (
      <article class="post">
        <h1>{post.title}</h1>
        <div class="content">{post.content}</div>
        <p class="meta">By {post.authorName} on {post.createdAt}</p>
      </article>
    );
  }
}
```

## BaseLayout

```typescript
import { BaseLayout } from 'nomo/views';

export class ApplicationLayout extends BaseLayout {
  render(content: string, data: any) {
    return (
      <html>
        <head>
          <title>{data.title || 'My App'}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/posts">Posts</a>
          </nav>
          <main>{content}</main>
          <footer>&copy; 2024</footer>
        </body>
      </html>
    );
  }
}
```

## Usage in Controller

```typescript
async show() {
  const post = await this.service.getPost(this.params.id);
  
  return this.render({
    view: PostView,
    layout: ApplicationLayout,
    data: { title: post.title, post }
  });
}
```

## BaseDtoView (JSON/XML)

```typescript
import { BaseDtoView } from 'nomo/views';

export class PostDtoView extends BaseDtoView {
  static renderJson(post: Post) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      author: { id: post.authorId },
      createdAt: post.createdAt?.toISOString()
    };
  }

  static renderXml(post: Post) {
    return `<post><id>${post.id}</id><title>${post.title}</title></post>`;
  }
}
```