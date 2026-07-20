// @ts-nocheck — bun:sqlite types are provided by Bun at runtime
/**
 * End-to-end demo of @nowarelabs/models with a real SQLite database
 * via a D1-compatible wrapper (bun:sqlite).
 *
 * Run:  bun run examples/d1-orm-demo/main.ts
 */
import { Database } from "bun:sqlite";
import { createD1 } from "./d1-sqlite.js";
import { User } from "./models/User.js";
import { Post } from "./models/Post.js";

// ─── Setup ──────────────────────────────────────────────────────────
const sqlite = new Database(":memory:");
sqlite.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT,
    trashed_at TEXT
  );
  CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    published_at TEXT
  );
`);

const db = createD1(sqlite);
const users = new User({ db, table: "users" });
const posts = new Post({ db, table: "posts" });

const log = (label: string) => console.log(`\n── ${label} ──`);

// ─── 1. CREATE ─────────────────────────────────────────────────────
log("1. CREATE");
const alice = await users.create({ name: "Alice", email: "alice@example.com" });
console.log("Created:", alice);

const bob = await users.create({ name: "Bob", email: "bob@example.com" });
console.log("Created:", bob);

// ─── 2. FIND ───────────────────────────────────────────────────────
log("2. FIND by ID");
const found = await users.find(alice.id);
console.log("Found:", found);

log("2b. FIND by conditions");
const byEmail = await users.findBy({ email: "bob@example.com" });
console.log("findBy email:", byEmail);

// ─── 3. UPDATE ─────────────────────────────────────────────────────
log("3. UPDATE");
const updated = await users.update(alice.id, { name: "Alice Smith" });
console.log("Updated:", updated);

// ─── 4. QUERIES ────────────────────────────────────────────────────
log("4. SELECT specific columns");
const names = await users.select("id", "name").all();
console.log("Names:", names);

log("4b. WHERE with operators");
const result = await users.where({ name: { like: "%Alice%" } }).all();
console.log("LIKE query:", result);

log("4c. ORDER BY + LIMIT");
const limited = await users.orderBy("name", "ASC").limit(1).all();
console.log("First by name:", limited);

log("4d. COUNT");
const count = await users.count();
console.log("Total users:", count);

log("4e. PLUCK");
const emails = await users.pluck("email");
console.log("Emails:", emails);

// ─── 5. CREATE RELATED RECORDS ──────────────────────────────────────
log("5. CREATE related records");
const post1 = await posts.create({
  user_id: alice.id,
  title: "Hello World",
  body: "My first post",
});
console.log("Post 1:", post1.title);

const post2 = await posts.create({
  user_id: alice.id,
  title: "Second Post",
  body: "Another one",
});
console.log("Post 2:", post2.title);

const post3 = await posts.create({
  user_id: bob.id,
  title: "Bob's Post",
  body: "Hi from Bob",
});
console.log("Post 3:", post3.title);

// ─── 6. EAGER LOADING: separate queries (safe default) ──────────────
log("6. EAGER LOADING with()");
const usersWithPosts = await users.with("posts").all();
for (const u of usersWithPosts) {
  const p = u as any;
  console.log(`  ${p.name}: ${(p.posts ?? []).length} post(s)`);
}

// ─── 7. EAGER LOADING: JOINs (belongs_to) ───────────────────────────
log("7. EAGER LOADING withJoins()");
const postsWithAuthor = await posts.withJoins("author").all();
for (const p of postsWithAuthor) {
  const post = p as any;
  const authorName = post.author?.[0]?.name ?? "unknown";
  console.log(`  "${post.title}" by ${authorName}`);
}

// ─── 8. PAGINATION ─────────────────────────────────────────────────
log("8. PAGINATION");
const page = await users.paginate({ page: 1, perPage: 2 });
console.log(
  `  Page ${page.page}: ${page.items.length} items, ${page.total} total, ${page.totalPages} pages`,
);
for (const item of page.items) {
  console.log(`    - ${(item as any).name}`);
}

// ─── 9. TRANSACTION ────────────────────────────────────────────────
log("9. TRANSACTION (success)");
await users.transaction(async (tx) => {
  const charlie = await tx.create({ name: "Charlie", email: "charlie@example.com" });
  console.log("  Created Charlie:", charlie.id);
  await posts.create({ user_id: charlie.id, title: "Charlie's Post", body: "Hello!" });
  console.log("  Created Charlie's post");
});
const charlie = await users.findBy({ email: "charlie@example.com" });
console.log("  Charlie persists after commit:", !!charlie);

log("9b. TRANSACTION (rollback)");
try {
  await users.transaction(async (tx) => {
    await tx.create({ name: "Dave", email: "dave@example.com" });
    console.log("  Created Dave (will be rolled back)");
    throw new Error("Intentional error");
  });
} catch (e: any) {
  console.log("  Caught:", e.message);
}
const dave = await users.findBy({ email: "dave@example.com" });
console.log("  Dave exists after rollback:", !!dave);

// ─── 10. LIFECYCLE STATES ──────────────────────────────────────────
log("10. SOFT DELETE");
await users.trash(alice.id);
const trashed = await users.trashed().all();
console.log("  Trashed users:", trashed.length);

const active = await users.active().all();
console.log("  Active users:", active.length);

await users.restore(alice.id);
const restored = await users.active().all();
console.log("  Active after restore:", restored.length);

// ─── 11. RAW SQL INSPECTION ────────────────────────────────────────
log("11. SQL INSPECTION");
const sql = users
  .select("id", "name")
  .where({ name: { like: "%Alice%" } })
  .orderBy("name", "ASC")
  .toSql();
console.log("  Generated SQL:", sql);

// ─── 12. RELATIONSHIP TRAVERSAL ────────────────────────────────────
log("12. RELATIONSHIP TRAVERSAL");
const alicePostIds = await users.listChildIds("posts", alice.id);
console.log("  Alice's post IDs:", alicePostIds);

const postAuthorIds = await posts.listParentIds("author", post1.id);
console.log("  Post 1's author IDs:", postAuthorIds);

// ─── Done ──────────────────────────────────────────────────────────
console.log("\n✓ All demos completed successfully.");
