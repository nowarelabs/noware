import { BaseModel } from "@nowarelabs/models";
import { postsTable, type PostRow } from "../schema.js";

export class Post extends BaseModel<
  any,
  any,
  any,
  any,
  typeof postsTable,
  PostRow,
  Partial<PostRow>
> {
  static tableName = "posts";
  static columnTypes = Object.fromEntries(Object.entries(postsTable).map(([k, v]) => [k, v.type]));

  protected persistence: any = null;

  constructor(init: any) {
    super({ ...init, table: init.table ?? postsTable });

    this.belongsTo("author", { model: "User", foreignKey: "user_id" });
  }

  protected getPersistence() {
    return { db: this.db };
  }
}

BaseModel.register("Post", Post);
