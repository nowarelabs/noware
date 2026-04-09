# Migration-Based Scaffolding

The nomo framework uses migration files as the **single source of truth** for generating the entire project structure. From files in `src/db/migrate/`, the scaffold system generates:

- **Routes** - HTTP resource routes and RPC endpoints
- **Schema** - Drizzle ORM table definitions
- **Models** - BaseModel extensions with relationships
- **Controllers** - BaseResourceController extensions
- **Controller RPCs** - RPC controller wrappers
- **Controller RPC Instances** - Instance-level RPC targets
- **Services** - BaseService extensions
- **RPCs** - BaseResourceRpcTarget extensions
- **RPC Instances** - BaseResourceInstanceRpcTarget extensions
- **Durable Objects** - BaseDurableObject extensions (for DO tables)
- **DO RPC Views** - RPC controllers for durable object views
- **Views** - Server-side JSX views
- **Assets** - CSS stylesheets
- **Frontend Components** - NofoElement web components
- **Types** - Zod schemas and TypeScript type definitions

## Quick Start

```bash
# Generate a new D1 migration
pnpm db:generate create_users_table

# Generate a new Durable Object view migration
pnpm db:generate create_match_details_view --do --doType view --populateFrom matches,sets,participants,umpires

# Scaffold the entire project from all migrations
pnpm db:scaffold --all

# Scaffold a single resource from the latest migration
pnpm db:scaffold
```

## Migration DSL

### D1 Tables (Standard CRUD Resources)

```typescript
import { Migration } from "nomo/migrations";

export default class CreateTournaments extends Migration {
  readonly version = "20260313001702";

  async change() {
    const options = { location: 'd1' as const };

    await this.createTable('tournaments', options, (t) => {
      t.text('id', { primaryKey: true, notNull: true });
      t.text('name', { notNull: true });
      t.text('type', { notNull: true });
      t.text('status', { notNull: true, default: 'draft' });
      t.integer('total_participants', { notNull: true });
      t.timestamps();
      t.lifecycle();

      // Indexes
      t.index('type');
      t.index('status');

      // Foreign keys
      t.foreignKey('phase_id', 'phases', 'id', { onDelete: 'cascade' });

      // Relationships (used for model generation)
      t.hasMany('participants', { name: 'participants', foreignKey: 'tournament_id' });
      t.hasMany('brackets', { name: 'brackets', foreignKey: 'tournament_id' });
      t.belongsTo('phases', { name: 'phase', foreignKey: 'phase_id' });
    });
  }
}
```

### Durable Object Views

```typescript
import { Migration } from "nomo/migrations";

export default class CreateSingleEliminationViewDurableObject extends Migration {
  readonly version = "20260313002014";
  readonly durableObjectClass = 'SingleEliminationViewDurableObject';

  async change() {
    const options = { location: 'do' as const };

    await this.createTable('single_elimination_view', options, (t) => {
      t.id({ autoincrement: true });
      t.text('tournament_id', { notNull: true });
      t.text('tournament_name', { notNull: true });
      t.text('match_id', { notNull: true });
      t.integer('round', { notNull: true });
      t.text('match_status', { notNull: true });
      t.text('player1_name');
      t.text('player2_name');
      t.timestamps();

      t.index('tournament_id');
      t.index('match_id');
      t.index('match_status');

      // DO metadata - tells the scaffold what kind of DO this is
      t.doType('view');

      // Tells the scaffold which RPC clients to import in the populate method
      t.populateFrom('tournaments', 'brackets', 'matches', 'participants');
    });
  }
}
```

## DSL Methods

### Column Types
- `t.text(name, options)` - TEXT column
- `t.integer(name, options)` - INTEGER column
- `t.boolean(name, options)` - BOOLEAN column
- `t.timestamp(name, options)` - TIMESTAMP column
- `t.json(name, options)` - JSON column
- `t.id(options)` - Auto-incrementing integer primary key

### Column Options
- `primaryKey: true` - Primary key
- `notNull: true` - NOT NULL constraint
- `default: value` - Default value
- `unique: true` - Unique constraint
- `index: true` - Create an index

### Table Methods
- `t.timestamps()` - Adds created_at and updated_at
- `t.lifecycle()` - Adds trashed_at, hidden_at, flagged_at, retired_at
- `t.index(column)` - Single column index
- `t.foreignKey(column, toTable, toColumn, options)` - Foreign key constraint
- `t.belongsTo(table, options)` - BelongsTo relationship
- `t.hasMany(table, options)` - HasMany relationship
- `t.hasOne(table, options)` - HasOne relationship

### Durable Object Methods
- `t.doType(type)` - Sets the DO type: `view`, `queue`, `search`, `lock`, `logic`, `cache`, `session`, `state`
- `t.populateFrom(...tables)` - Lists tables this DO populates from (generates RPC imports)
- `t.doModel(model)` - Specifies which model populates this DO

## Generate Command

```bash
# Basic D1 migration
pnpm db:generate create_posts

# Durable Object view migration
pnpm db:generate create_leaderboard_view --do

# With DO type and populate sources
pnpm db:generate create_match_details_view \
  --do \
  --doType view \
  --populateFrom matches,sets,participants,umpires

# Custom DO class name
pnpm db:generate create_tournament_summary --do --doClass TournamentSummaryDO
```

## Scaffold Command

```bash
# Scaffold entire project from all migrations
pnpm db:scaffold --all

# Scaffold single resource from latest migration
pnpm db:scaffold

# Scaffold from specific migration
pnpm db:scaffold 20260313001702_create_tournament_tables

# Force overwrite existing files
pnpm db:scaffold --all --force

# Skip running db:migrate:full after generation
pnpm db:scaffold --all --skip-migrate
```

## Project Structure Generated

From a single migration file like `create_tournaments.ts`, the scaffold generates:

```
src/
├── db/schema/schema.ts          # Drizzle table definition (appended)
├── models/
│   ├── types/
│   │   ├── index.ts             # Re-exports all types
│   │   └── tournament.ts        # Zod schemas + TypeScript types
│   └── tournament.ts            # TournamentModel
├── controllers/
│   ├── tournaments_controller.ts # HTTP controller
│   └── rpcs/
│       ├── tournaments.ts        # RPC controller
│       └── views/                # (for DO migrations only)
│           └── single_elimination_view.ts
├── services/
│   └── tournaments.ts           # Service class
├── rpc/
│   ├── tournaments.ts           # RPC target
│   └── tournaments_instance.ts  # Instance RPC target
├── durable_objects/              # (for DO migrations only)
│   └── SingleEliminationViewDurableObject.ts
├── views/
│   └── tournaments/
│       └── index.tsx            # Server-side JSX view
└── routes.ts                    # Auto-updated with routes

public/components/
├── tournaments-table.js         # NofoElement web component
└── tournaments-table.css        # Styles
```

## How It Works

1. **Write migrations** in `src/db/migrate/` using the DSL
2. **Run `pnpm db:scaffold --all`** to parse all migrations and generate the full project
3. **Customize** the generated files as needed (especially DO populate methods)
4. **Run `pnpm db:migrate:full`** to apply migrations to the database

The scaffold parser reads the migration files and extracts:
- Table names and column definitions
- Foreign key relationships
- hasMany/belongsTo/hasOne relationships
- Location (d1 vs do)
- Durable Object class names
- DO types (view, queue, etc.)
- Populate source tables

This information is used to generate all the boilerplate code, leaving you to focus on the business logic in populate methods and custom controllers.
