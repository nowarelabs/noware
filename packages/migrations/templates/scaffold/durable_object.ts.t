import { BaseDurableObject } from 'nomo/durable-objects';
import { drizzle, type DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { Logger } from 'nomo/logger';
import { migrateDO } from 'nomo/migrations';

import { {{tableName}} } from '../db/schema/schema';
import { migrations } from '../db/migrations/migrations';
import type { New{{typeName}} } from '../models/types/{{modelFileName}}';
{{#if populateFrom}}
{{#each populateFrom}}
import { {{pascalCase this}}Rpc } from '../rpc/{{this}}';
{{/each}}
{{/if}}

const schema = { {{tableName}} };

export class {{doClassName}} extends BaseDurableObject {
	storage: DurableObjectStorage;
	db: DrizzleSqliteDODatabase<typeof schema>;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.storage = ctx.storage;
		this.db = drizzle(this.storage, { schema, logger: false });

		ctx.blockConcurrencyWhile(async () => {
			await this._migrate();
		});
	}

	async _migrate() {
		const res = await migrateDO(
			this.storage.sql as any,
			migrations,
			{ className: '{{doClassName}}' }
		);

		if (!res.success) {
			const logger = new Logger({ service: '{{doClassName}}' });
			logger.error('Migrations failed', {}, new Error(res.message));
		}
	}

	async clear(): Promise<void> {
		await this.db.delete({{tableName}}).execute();
	}

	async insert(record: New{{typeName}}): Promise<void> {
		await this.db.insert({{tableName}}).values(record).execute();
	}

	async all(): Promise<any[]> {
		return this.db.select().from({{tableName}}).all();
	}
{{#if populateFrom}}

	async populate(
		tournamentId: string,
		request: Request,
		env: Env,
		ctx: any,
	): Promise<any> {
		const logger = new Logger({ service: '{{doClassName}}' });

{{#each populateFrom}}
		const {{camelCase this}}Rpc = new {{pascalCase this}}Rpc(request, env, ctx);
{{/each}}

		await this.clear();

		// TODO: Implement populate logic for {{doClassName}}
		// This DO is a {{doType}} view that should be populated from: {{populateFrom}}
		// Use the RPC clients above to fetch data and insert denormalized records

		logger.info('[POPULATE] Completed', { tournamentId });
		return { status: 'populated' };
	}
{{/if}}
}
