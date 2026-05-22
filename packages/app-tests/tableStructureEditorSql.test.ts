import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreateTableSql,
  buildTableStructureChangeSql,
  type EditableStructureColumn,
  type EditableStructureIndex,
} from "../../apps/desktop/src/lib/tableStructureEditorSql.ts";

function column(overrides: Partial<EditableStructureColumn>): EditableStructureColumn {
  return {
    id: overrides.id ?? "col",
    name: overrides.name ?? "name",
    dataType: overrides.dataType ?? "varchar(255)",
    isNullable: overrides.isNullable ?? true,
    defaultValue: overrides.defaultValue ?? "",
    comment: overrides.comment ?? "",
    isPrimaryKey: overrides.isPrimaryKey ?? false,
    original: overrides.original,
    originalPosition: overrides.originalPosition,
    markedForDrop: overrides.markedForDrop ?? false,
  };
}

function index(overrides: Partial<EditableStructureIndex>): EditableStructureIndex {
  return {
    id: overrides.id ?? "idx",
    name: overrides.name ?? "idx_name",
    columns: overrides.columns ?? ["name"],
    isUnique: overrides.isUnique ?? false,
    isPrimary: overrides.isPrimary ?? false,
    filter: overrides.filter ?? "",
    indexType: overrides.indexType ?? "",
    includedColumns: overrides.includedColumns ?? [],
    comment: overrides.comment ?? "",
    original: overrides.original,
    markedForDrop: overrides.markedForDrop ?? false,
  };
}

test("builds MySQL column and index change statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "mysql",
    tableName: "users",
    columns: [
      column({
        id: "name",
        name: "display_name",
        dataType: "varchar(120)",
        isNullable: false,
        defaultValue: "'guest'",
        comment: "Shown name",
        original: {
          name: "name",
          data_type: "varchar(80)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
          comment: "",
        },
      }),
      column({ id: "email", name: "email", dataType: "varchar(255)", isNullable: false }),
      column({
        id: "legacy",
        name: "legacy",
        markedForDrop: true,
        original: {
          name: "legacy",
          data_type: "text",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
    ],
    indexes: [
      index({
        id: "old",
        name: "idx_old",
        markedForDrop: true,
        original: { name: "idx_old", columns: ["name"], is_unique: false, is_primary: false },
      }),
      index({ id: "email_idx", name: "uniq_users_email", columns: ["email"], isUnique: true }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "ALTER TABLE `users` CHANGE COLUMN `name` `display_name` varchar(120) NOT NULL DEFAULT 'guest' COMMENT 'Shown name';",
    "ALTER TABLE `users` ADD COLUMN `email` varchar(255) NOT NULL;",
    "ALTER TABLE `users` DROP COLUMN `legacy`;",
    "DROP INDEX `idx_old` ON `users`;",
    "CREATE UNIQUE INDEX `uniq_users_email` ON `users` (`email`);",
  ]);
});

test("builds MySQL column reorder statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "mysql",
    tableName: "users",
    columns: [
      column({
        id: "id",
        name: "id",
        dataType: "int",
        isNullable: false,
        isPrimaryKey: true,
        originalPosition: 0,
        original: {
          name: "id",
          data_type: "int",
          is_nullable: false,
          column_default: null,
          is_primary_key: true,
          extra: null,
        },
      }),
      column({
        id: "email",
        name: "email",
        dataType: "varchar(255)",
        originalPosition: 2,
        original: {
          name: "email",
          data_type: "varchar(255)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
      column({
        id: "name",
        name: "display_name",
        dataType: "varchar(120)",
        originalPosition: 1,
        original: {
          name: "name",
          data_type: "varchar(80)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
    ],
    indexes: [],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "ALTER TABLE `users` MODIFY COLUMN `email` varchar(255) AFTER `id`;",
    "ALTER TABLE `users` CHANGE COLUMN `name` `display_name` varchar(120) AFTER `email`;",
  ]);
});

test("builds PostgreSQL rename, type, default, comment, and index statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "accounts",
    columns: [
      column({
        id: "status",
        name: "account_status",
        dataType: "text",
        isNullable: false,
        defaultValue: "'active'",
        comment: "Current status",
        original: {
          name: "status",
          data_type: "varchar",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
          comment: "",
        },
      }),
    ],
    indexes: [index({ id: "new", name: "idx_accounts_status", columns: ["account_status"] })],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'ALTER TABLE "public"."accounts" RENAME COLUMN "status" TO "account_status";',
    'ALTER TABLE "public"."accounts" ALTER COLUMN "account_status" TYPE text;',
    'ALTER TABLE "public"."accounts" ALTER COLUMN "account_status" SET NOT NULL;',
    'ALTER TABLE "public"."accounts" ALTER COLUMN "account_status" SET DEFAULT \'active\';',
    'COMMENT ON COLUMN "public"."accounts"."account_status" IS \'Current status\';',
    'CREATE INDEX "idx_accounts_status" ON "public"."accounts" ("account_status");',
  ]);
});

test("warns when SQLite cannot safely alter existing column attributes", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "sqlite",
    tableName: "notes",
    columns: [
      column({
        id: "title",
        name: "title",
        dataType: "text",
        isNullable: false,
        original: {
          name: "title",
          data_type: "varchar(100)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
      column({ id: "body", name: "body", dataType: "text", isNullable: true }),
    ],
    indexes: [],
  });

  assert.deepEqual(result.statements, ['ALTER TABLE "notes" ADD COLUMN "body" text;']);
  assert.deepEqual(result.warnings, [
    'SQLite cannot safely alter existing column "title" without rebuilding the table.',
  ]);
});

test("quotes SQL Server table, column, and index names with brackets", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "sqlserver",
    schema: "dbo",
    tableName: "users",
    columns: [column({ id: "email", name: "email", dataType: "nvarchar(255)", isNullable: false })],
    indexes: [index({ id: "idx", name: "idx_users_email", columns: ["email"] })],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "ALTER TABLE [dbo].[users] ADD [email] nvarchar(255) NOT NULL;",
    "CREATE INDEX [idx_users_email] ON [dbo].[users] ([email]);",
  ]);
});

test("builds DuckDB create table statements", () => {
  const result = buildCreateTableSql({
    databaseType: "duckdb",
    tableName: "events",
    columns: [
      column({ id: "name", name: "name", dataType: "VARCHAR", isNullable: false }),
      column({ id: "created_at", name: "created_at", dataType: "TIMESTAMP", defaultValue: "current_timestamp" }),
    ],
    indexes: [index({ id: "idx_name", name: "idx_events_name", columns: ["name"] })],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE TABLE "events" (\n  "name" VARCHAR NOT NULL,\n  "created_at" TIMESTAMP DEFAULT current_timestamp\n);',
    'CREATE INDEX "idx_events_name" ON "events" ("name");',
  ]);
});

test("PostgreSQL index with INCLUDE clause", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "orders",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_orders_status",
        columns: ["status"],
        includedColumns: ["total", "created_at"],
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE INDEX "idx_orders_status" ON "public"."orders" ("status") INCLUDE ("total", "created_at");',
  ]);
});

test("PostgreSQL index with USING clause (index type)", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "docs",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_docs_body",
        columns: ["body"],
        indexType: "GIN",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, ['CREATE INDEX "idx_docs_body" ON "public"."docs" USING GIN ("body");']);
});

test("PostgreSQL index with WHERE filter", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "users",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_users_active",
        columns: ["email"],
        filter: "deleted_at IS NULL",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE INDEX "idx_users_active" ON "public"."users" ("email") WHERE deleted_at IS NULL;',
  ]);
});

test("PostgreSQL index with COMMENT", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "users",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_users_email",
        columns: ["email"],
        comment: "Fast lookup by email",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE INDEX "idx_users_email" ON "public"."users" ("email");',
    "COMMENT ON INDEX \"idx_users_email\" IS 'Fast lookup by email';",
  ]);
});

test("PostgreSQL index with single quote in comment is escaped", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "users",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_users_email",
        columns: ["email"],
        comment: "User's primary email",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE INDEX "idx_users_email" ON "public"."users" ("email");',
    "COMMENT ON INDEX \"idx_users_email\" IS 'User''s primary email';",
  ]);
});

test("PostgreSQL index with all options combined (unique + type + include + filter + comment)", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "orders",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_orders_covering",
        columns: ["user_id", "status"],
        isUnique: true,
        indexType: "BTREE",
        includedColumns: ["total"],
        filter: "status = 'active'",
        comment: "Covering index for active orders",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE UNIQUE INDEX "idx_orders_covering" ON "public"."orders" USING BTREE ("user_id", "status") INCLUDE ("total") WHERE status = \'active\';',
    "COMMENT ON INDEX \"idx_orders_covering\" IS 'Covering index for active orders';",
  ]);
});

test("SQL Server index with type prefix", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "sqlserver",
    schema: "dbo",
    tableName: "logs",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_logs_message",
        columns: ["message"],
        indexType: "CLUSTERED",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, ["CREATE CLUSTERED INDEX [idx_logs_message] ON [dbo].[logs] ([message]);"]);
});

test("SQL Server index with INCLUDE clause", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "sqlserver",
    schema: "dbo",
    tableName: "orders",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_orders_status",
        columns: ["status"],
        includedColumns: ["total", "created_at"],
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "CREATE INDEX [idx_orders_status] ON [dbo].[orders] ([status]) INCLUDE ([total], [created_at]);",
  ]);
});

test("SQL Server index with type + include combined", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "sqlserver",
    schema: "dbo",
    tableName: "orders",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_orders_covering",
        columns: ["user_id"],
        indexType: "NONCLUSTERED",
        includedColumns: ["total", "status"],
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "CREATE NONCLUSTERED INDEX [idx_orders_covering] ON [dbo].[orders] ([user_id]) INCLUDE ([total], [status]);",
  ]);
});

test("MySQL index uses BTREE/HASH with USING and still omits unsupported INCLUDE and WHERE", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "mysql",
    tableName: "orders",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_orders_status",
        columns: ["status"],
        indexType: "BTREE",
        includedColumns: ["total"],
        filter: "deleted = 0",
        comment: "Some comment",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, ["CREATE INDEX `idx_orders_status` USING BTREE ON `orders` (`status`);"]);
});

test("MySQL fulltext and spatial index types are emitted as index prefixes", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "mysql",
    tableName: "docs",
    columns: [],
    indexes: [
      index({
        id: "fulltext",
        name: "idx_docs_body",
        columns: ["body"],
        indexType: "FULLTEXT",
      }),
      index({
        id: "spatial",
        name: "idx_docs_location",
        columns: ["location"],
        indexType: "SPATIAL",
      }),
      index({
        id: "rtree",
        name: "idx_docs_shape",
        columns: ["shape"],
        indexType: "RTREE",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "CREATE FULLTEXT INDEX `idx_docs_body` ON `docs` (`body`);",
    "CREATE SPATIAL INDEX `idx_docs_location` ON `docs` (`location`);",
    "CREATE SPATIAL INDEX `idx_docs_shape` ON `docs` (`shape`);",
  ]);
});

test("changed existing indexes are rebuilt with drop and create when supported", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "users",
    columns: [],
    indexes: [
      index({
        id: "existing",
        name: "uniq_users_email",
        columns: ["email"],
        isUnique: true,
        indexType: "BTREE",
        original: {
          name: "idx_users_name",
          columns: ["name"],
          is_unique: false,
          is_primary: false,
          index_type: "BTREE",
        },
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'DROP INDEX "public"."idx_users_name";',
    'CREATE UNIQUE INDEX "uniq_users_email" ON "public"."users" USING BTREE ("email");',
  ]);
});

test("changed existing MySQL indexes are rebuilt with MySQL index type syntax", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "mysql",
    tableName: "docs",
    columns: [],
    indexes: [
      index({
        id: "existing",
        name: "idx_docs_body",
        columns: ["body"],
        indexType: "FULLTEXT",
        original: {
          name: "idx_docs_title",
          columns: ["title"],
          is_unique: false,
          is_primary: false,
          index_type: "BTREE",
        },
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    "DROP INDEX `idx_docs_title` ON `docs`;",
    "CREATE FULLTEXT INDEX `idx_docs_body` ON `docs` (`body`);",
  ]);
});

test("SQLite index with filter (partial index)", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "sqlite",
    tableName: "users",
    columns: [],
    indexes: [
      index({
        id: "new",
        name: "idx_users_active",
        columns: ["email"],
        filter: "deleted_at IS NULL",
      }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'CREATE INDEX "idx_users_active" ON "users" ("email") WHERE deleted_at IS NULL;',
  ]);
});

test("index with empty name and columns produces warnings and no statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "postgres",
    schema: "public",
    tableName: "users",
    columns: [],
    indexes: [index({ id: "empty", name: "", columns: [] })],
  });

  assert.deepEqual(result.warnings, ["Index name cannot be empty.", 'Index "(new)" needs at least one column.']);
  assert.deepEqual(result.statements, []);
});

test("builds Oracle column, comment, and index change statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "oracle",
    schema: "HR",
    tableName: "EMPLOYEES",
    columns: [
      column({
        id: "status",
        name: "EMP_STATUS",
        dataType: "VARCHAR2(20)",
        isNullable: false,
        defaultValue: "'ACTIVE'",
        comment: "Employment status",
        original: {
          name: "STATUS",
          data_type: "VARCHAR2(10)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
          comment: "",
        },
      }),
      column({ id: "email", name: "EMAIL", dataType: "VARCHAR2(255)", isNullable: true, comment: "Work email" }),
      column({
        id: "legacy",
        name: "LEGACY_CODE",
        markedForDrop: true,
        original: {
          name: "LEGACY_CODE",
          data_type: "VARCHAR2(20)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
    ],
    indexes: [
      index({
        id: "old",
        name: "IDX_EMP_OLD",
        markedForDrop: true,
        original: { name: "IDX_EMP_OLD", columns: ["STATUS"], is_unique: false, is_primary: false },
      }),
      index({ id: "new", name: "IDX_EMP_STATUS", columns: ["EMP_STATUS"], isUnique: true }),
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'ALTER TABLE "HR"."EMPLOYEES" RENAME COLUMN "STATUS" TO "EMP_STATUS";',
    'ALTER TABLE "HR"."EMPLOYEES" MODIFY ("EMP_STATUS" VARCHAR2(20));',
    'ALTER TABLE "HR"."EMPLOYEES" MODIFY ("EMP_STATUS" NOT NULL);',
    'ALTER TABLE "HR"."EMPLOYEES" MODIFY ("EMP_STATUS" DEFAULT \'ACTIVE\');',
    'COMMENT ON COLUMN "HR"."EMPLOYEES"."EMP_STATUS" IS \'Employment status\';',
    'ALTER TABLE "HR"."EMPLOYEES" ADD ("EMAIL" VARCHAR2(255));',
    'COMMENT ON COLUMN "HR"."EMPLOYEES"."EMAIL" IS \'Work email\';',
    'ALTER TABLE "HR"."EMPLOYEES" DROP COLUMN "LEGACY_CODE";',
    'DROP INDEX "HR"."IDX_EMP_OLD";',
    'CREATE UNIQUE INDEX "IDX_EMP_STATUS" ON "HR"."EMPLOYEES" ("EMP_STATUS");',
  ]);
});

test("builds Dameng existing column and create table statements", () => {
  const change = buildTableStructureChangeSql({
    databaseType: "dameng",
    schema: "SYSDBA",
    tableName: "USERS",
    columns: [
      column({
        id: "name",
        name: "DISPLAY_NAME",
        dataType: "VARCHAR(120)",
        isNullable: true,
        defaultValue: "",
        comment: "",
        original: {
          name: "NAME",
          data_type: "VARCHAR(80)",
          is_nullable: false,
          column_default: "'guest'",
          is_primary_key: false,
          extra: null,
          comment: "Old name",
        },
      }),
    ],
    indexes: [],
  });

  assert.deepEqual(change.warnings, []);
  assert.deepEqual(change.statements, [
    'ALTER TABLE "SYSDBA"."USERS" RENAME COLUMN "NAME" TO "DISPLAY_NAME";',
    'ALTER TABLE "SYSDBA"."USERS" MODIFY ("DISPLAY_NAME" VARCHAR(120));',
    'ALTER TABLE "SYSDBA"."USERS" MODIFY ("DISPLAY_NAME" NULL);',
    'ALTER TABLE "SYSDBA"."USERS" MODIFY ("DISPLAY_NAME" DEFAULT NULL);',
    'COMMENT ON COLUMN "SYSDBA"."USERS"."DISPLAY_NAME" IS NULL;',
  ]);

  const create = buildCreateTableSql({
    databaseType: "dameng",
    schema: "SYSDBA",
    tableName: "USERS",
    columns: [
      column({ id: "id", name: "ID", dataType: "NUMBER", isNullable: false, isPrimaryKey: true }),
      column({ id: "name", name: "NAME", dataType: "VARCHAR(120)", isNullable: false, comment: "Display name" }),
    ],
    indexes: [index({ id: "idx", name: "IDX_USERS_NAME", columns: ["NAME"] })],
  });

  assert.deepEqual(create.warnings, []);
  assert.deepEqual(create.statements, [
    'CREATE TABLE "SYSDBA"."USERS" (\n  "ID" NUMBER,\n  "NAME" VARCHAR(120) NOT NULL,\n  PRIMARY KEY ("ID")\n);',
    'COMMENT ON COLUMN "SYSDBA"."USERS"."NAME" IS \'Display name\';',
    'CREATE INDEX "IDX_USERS_NAME" ON "SYSDBA"."USERS" ("NAME");',
  ]);
});

test("builds GaussDB statements with PostgreSQL-compatible DDL", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "gaussdb",
    schema: "public",
    tableName: "accounts",
    columns: [
      column({
        id: "status",
        name: "account_status",
        dataType: "text",
        isNullable: false,
        defaultValue: "'active'",
        comment: "Current status",
        original: {
          name: "status",
          data_type: "varchar",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
          comment: "",
        },
      }),
    ],
    indexes: [index({ id: "idx", name: "idx_accounts_status", columns: ["account_status"] })],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'ALTER TABLE "public"."accounts" RENAME COLUMN "status" TO "account_status";',
    'ALTER TABLE "public"."accounts" ALTER COLUMN "account_status" TYPE text;',
    'ALTER TABLE "public"."accounts" ALTER COLUMN "account_status" SET NOT NULL;',
    'ALTER TABLE "public"."accounts" ALTER COLUMN "account_status" SET DEFAULT \'active\';',
    'COMMENT ON COLUMN "public"."accounts"."account_status" IS \'Current status\';',
    'CREATE INDEX "idx_accounts_status" ON "public"."accounts" ("account_status");',
  ]);
});

test("builds openGauss statements with PostgreSQL-compatible DDL", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "opengauss",
    schema: "public",
    tableName: "accounts",
    columns: [column({ id: "email", name: "email", dataType: "text", isNullable: true })],
    indexes: [],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, ['ALTER TABLE "public"."accounts" ADD COLUMN "email" text;']);
});

test("Redshift skips unsupported index operations while keeping column DDL", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "redshift",
    schema: "public",
    tableName: "events",
    columns: [column({ id: "email", name: "email", dataType: "varchar(255)", isNullable: true })],
    indexes: [index({ id: "idx", name: "idx_events_email", columns: ["email"], filter: "email IS NOT NULL" })],
  });

  assert.deepEqual(result.statements, ['ALTER TABLE "public"."events" ADD COLUMN "email" varchar(255);']);
  assert.deepEqual(result.warnings, ["Creating indexes is not supported for redshift from this editor."]);
});

test("builds ClickHouse column DDL and skips indexes", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "clickhouse",
    tableName: "events",
    columns: [
      column({ id: "new", name: "name", dataType: "String", isNullable: false }),
      column({
        id: "legacy",
        name: "legacy",
        markedForDrop: true,
        original: {
          name: "legacy",
          data_type: "String",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
      column({
        id: "kind",
        name: "event_kind",
        dataType: "LowCardinality(String)",
        isNullable: false,
        defaultValue: "'view'",
        original: {
          name: "kind",
          data_type: "String",
          is_nullable: false,
          column_default: "'click'",
          is_primary_key: false,
          extra: null,
        },
      }),
    ],
    indexes: [index({ id: "idx", name: "idx_events_name", columns: ["name"] })],
  });

  assert.deepEqual(result.statements, [
    'ALTER TABLE "events" ADD COLUMN "name" String;',
    'ALTER TABLE "events" DROP COLUMN "legacy";',
    'ALTER TABLE "events" RENAME COLUMN "kind" TO "event_kind";',
    'ALTER TABLE "events" MODIFY COLUMN "event_kind" LowCardinality(String) DEFAULT \'view\';',
  ]);
  assert.deepEqual(result.warnings, ["Creating indexes is not supported for clickhouse from this editor."]);
});

test("builds ClickHouse nullable and comment column changes", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "clickhouse",
    tableName: "events",
    columns: [
      column({
        id: "new",
        name: "source",
        dataType: "String",
        isNullable: true,
        comment: "traffic source",
      }),
      column({
        id: "status",
        name: "status",
        dataType: "Nullable(String)",
        isNullable: false,
        defaultValue: "",
        comment: "current status",
        original: {
          name: "status",
          data_type: "Nullable(String)",
          is_nullable: true,
          column_default: "'pending'",
          is_primary_key: false,
          extra: null,
          comment: "old status",
        },
      }),
    ],
    indexes: [],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'ALTER TABLE "events" ADD COLUMN "source" Nullable(String);',
    'ALTER TABLE "events" COMMENT COLUMN "source" \'traffic source\';',
    'ALTER TABLE "events" MODIFY COLUMN "status" REMOVE DEFAULT;',
    'ALTER TABLE "events" MODIFY COLUMN "status" String;',
    'ALTER TABLE "events" COMMENT COLUMN "status" \'current status\';',
  ]);
});

test("builds ClickHouse column reorder statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "clickhouse",
    tableName: "events",
    columns: [
      column({
        id: "event_type",
        name: "event_type",
        dataType: "String",
        isNullable: false,
        originalPosition: 1,
        original: {
          name: "event_type",
          data_type: "String",
          is_nullable: false,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
      column({
        id: "ts",
        name: "ts",
        dataType: "DateTime",
        isNullable: false,
        originalPosition: 0,
        original: {
          name: "ts",
          data_type: "DateTime",
          is_nullable: false,
          column_default: null,
          is_primary_key: false,
          extra: null,
        },
      }),
    ],
    indexes: [],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'ALTER TABLE "events" MODIFY COLUMN "event_type" String FIRST;',
    'ALTER TABLE "events" MODIFY COLUMN "ts" DateTime AFTER "event_type";',
  ]);
});

test("builds H2 schema-qualified existing column statements", () => {
  const result = buildTableStructureChangeSql({
    databaseType: "h2",
    schema: "PUBLIC",
    tableName: "USERS",
    columns: [
      column({
        id: "name",
        name: "DISPLAY_NAME",
        dataType: "VARCHAR(120)",
        isNullable: false,
        defaultValue: "'guest'",
        comment: "Display name",
        original: {
          name: "NAME",
          data_type: "VARCHAR(80)",
          is_nullable: true,
          column_default: null,
          is_primary_key: false,
          extra: null,
          comment: "",
        },
      }),
    ],
    indexes: [index({ id: "idx", name: "IDX_USERS_DISPLAY_NAME", columns: ["DISPLAY_NAME"] })],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.statements, [
    'ALTER TABLE "PUBLIC"."USERS" ALTER COLUMN "NAME" RENAME TO "DISPLAY_NAME";',
    'ALTER TABLE "PUBLIC"."USERS" ALTER COLUMN "DISPLAY_NAME" SET DATA TYPE VARCHAR(120);',
    'ALTER TABLE "PUBLIC"."USERS" ALTER COLUMN "DISPLAY_NAME" SET NOT NULL;',
    'ALTER TABLE "PUBLIC"."USERS" ALTER COLUMN "DISPLAY_NAME" SET DEFAULT \'guest\';',
    'COMMENT ON COLUMN "PUBLIC"."USERS"."DISPLAY_NAME" IS \'Display name\';',
    'CREATE INDEX "IDX_USERS_DISPLAY_NAME" ON "PUBLIC"."USERS" ("DISPLAY_NAME");',
  ]);
});
