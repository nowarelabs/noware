import { DurableObjectBaseDelegate } from "../delegate";

export interface SearchConfig {
  table: any; // Drizzle table
  searchColumns: string[];
}

export class SearchDelegate extends DurableObjectBaseDelegate<SearchConfig> {
  /**
   * Search for records matching a query.
   */
  async handle(
    queryText: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<any[]> {
    const { table, searchColumns } = this.config;
    const { limit = 20, offset = 0 } = options;

    if (!queryText) return [];

    // Simple search using LIKE
    const conditions = searchColumns.map((col) => `"${col}" LIKE ?`).join(" OR ");
    const searchVal = `%${queryText}%`;
    const values = searchColumns.map(() => searchVal);

    // Using simple SQL for search for now
    const results = await this.durableObject.storage.sql
      .exec(`SELECT * FROM ${table?.name || table} WHERE ${conditions} LIMIT ? OFFSET ?`, [
        ...values,
        limit,
        offset,
      ])
      .toArray();

    return results;
  }

  /**
   * Paginated results
   */
  async paginate(page: number = 1, perPage: number = 20): Promise<{ data: any[]; total: number }> {
    const { table } = this.config;
    const offset = (page - 1) * perPage;

    const results = await this.durableObject.storage.sql
      .exec(`SELECT * FROM ${table?.name || table} LIMIT ? OFFSET ?`, [perPage, offset])
      .toArray();

    const countRes = await this.durableObject.storage.sql
      .exec(`SELECT COUNT(*) as count FROM ${table?.name || table}`)
      .toArray();

    return { data: results, total: Number(countRes[0]?.count || 0) };
  }
}
