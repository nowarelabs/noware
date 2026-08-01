import type { ModelContext } from "@nowarelabs/shared";

export interface Transaction {
  readonly id: string;
  callbacks: Array<() => Promise<void>>;
}

export function getTransaction(ctx: ModelContext): Transaction | undefined {
  return ctx.transaction as Transaction | undefined;
}

async function exec(db: any, sql: string): Promise<void> {
  if (db.prepare) {
    await db.prepare(sql).bind().all();
    return;
  }
  if (db.exec) db.exec(sql);
  if (db.execSql) await db.execSql(sql);
}

export async function withTransaction<T>(
  ctx: ModelContext,
  db: any,
  fn: (txCtx: ModelContext) => Promise<T>,
): Promise<T> {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    callbacks: [],
  };

  const txCtx: ModelContext = { ...ctx, transaction: tx };

  await exec(db, "BEGIN");
  try {
    const result = await fn(txCtx);
    await exec(db, "COMMIT");
    for (const cb of tx.callbacks) {
      await cb();
    }
    return result;
  } catch (err) {
    await exec(db, "ROLLBACK");
    throw err;
  }
}
