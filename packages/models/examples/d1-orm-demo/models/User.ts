import { BaseModel } from "@nowarelabs/models";
import { usersTable, type UserRow } from "../schema.js";

export class User extends BaseModel<
  any,
  any,
  any,
  any,
  typeof usersTable,
  UserRow,
  Partial<UserRow>
> {
  static tableName = "users";
  static columnTypes = Object.fromEntries(Object.entries(usersTable).map(([k, v]) => [k, v.type]));

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? usersTable });

    this.hasMany("posts", { model: "Post", foreignKey: "user_id" });

    this.beforeCreate((data: any) => {
      if (!data.created_at) data.created_at = new Date().toISOString();
    });

    this.afterCreate((record: any) => {
      console.log(`  [hook] afterCreate: user ${record.id} created`);
    });

    this.afterRollback((data: any, context?: string) => {
      console.log(`  [hook] afterRollback: ${context}`, data.error);
    });
  }

  protected getPersistence() {
    return { db: this.db };
  }
}

BaseModel.register("User", User);
