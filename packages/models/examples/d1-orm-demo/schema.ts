export const usersTable = {
  id: { type: "text", primaryKey: true },
  name: { type: "text" },
  email: { type: "text" },
  created_at: { type: "text" },
} as const;

export const postsTable = {
  id: { type: "text", primaryKey: true },
  user_id: { type: "text" },
  title: { type: "text" },
  body: { type: "text" },
  published_at: { type: "text" },
} as const;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type PostRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  published_at: string | null;
};
