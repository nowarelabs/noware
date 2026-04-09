import { DurableObjectBaseDelegate } from "../delegate";
import { eq } from "drizzle-orm";

export interface ViewConfig {
  table: any; // Drizzle table
  primaryKey?: string;
}

export class ViewDelegate extends DurableObjectBaseDelegate<ViewConfig> {
  /**
   * Default handle returns all records from the view table.
   * Can be extended or configured to support filtering.
   */
  async handle(
    options: {
      where?: any;
      limit?: number;
      offset?: number;
      orderBy?: any;
    } = {},
  ): Promise<any[]> {
    const { table } = this.config;
    let query: any = this.durableObject.db.select().from(table);

    if (options.where) {
      // Simple where logic for now, can be expanded
      Object.entries(options.where).forEach(([key, value]) => {
        // @ts-ignore - Drizzle typed where support
        query = query.where(eq(table[key], value));
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query.execute();
  }

  /**
   * Find a single record by primary key
   */
  async find(id: any): Promise<any | null> {
    const { table, primaryKey = "id" } = this.config;
    const results = await this.durableObject.db
      .select()
      .from(table)
      // @ts-ignore - Drizzle table index
      .where(eq(table[primaryKey], id))
      .limit(1)
      .execute();

    return results[0] || null;
  }
}
