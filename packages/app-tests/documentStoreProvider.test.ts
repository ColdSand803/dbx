import { strict as assert } from "node:assert";
import { test } from "vitest";
import {
  buildDocumentFilterCondition,
  combineDocumentFilterConditions,
  currentDocumentFilterJson,
  documentFieldPathOptionsFromDocuments,
  documentFieldPathTreeFromDocuments,
  documentStoreProviderFor,
  elasticsearchSearchBodyFromDocumentQuery,
  flattenDocumentFieldPathTree,
  formatDocumentQueryInput,
  searchDocumentFieldPathTree,
  type DocumentFilterRule,
} from "../../apps/desktop/src/lib/app/documentStoreProvider.ts";

function rule(patch: Partial<DocumentFilterRule>): DocumentFilterRule {
  return {
    id: "rule-1",
    fieldName: "city",
    mode: "equals",
    rawValue: "长治",
    conjunction: "AND",
    ...patch,
  };
}

test("selects MongoDB and Elasticsearch document store providers", () => {
  assert.equal(documentStoreProviderFor("mongodb").kind, "mongodb");
  assert.equal(documentStoreProviderFor("elasticsearch").kind, "elasticsearch");
});

test("providers build store-specific query previews", () => {
  const t = ((key: string, params?: Record<string, unknown>) => `${key}:${params?.count ?? ""}`) as never;
  const mongo = documentStoreProviderFor("mongodb");
  const elasticsearch = documentStoreProviderFor("elasticsearch");

  assert.equal(mongo.documentsLabel({ total: 7, t }), "mongo.documents:7");
  assert.equal(mongo.queryPreview({ collection: "orders", filterJson: '{"city":"长治"}', sortJson: '{"createdAt":-1}', skip: 20, limit: 10 }), 'db.getCollection("orders").find({"city":"长治"}).sort({"createdAt":-1}).skip(20).limit(10)');
  assert.equal(mongo.queryPreview({ collection: "order-events", filterJson: '{"city":"长治"}', sortJson: undefined, skip: 0, limit: 100 }), 'db.getCollection("order-events").find({"city":"长治"}).skip(0).limit(100)');
  assert.equal(mongo.queryPreview({ collection: "orders", filterJson: '{"snowflake":{"$numberLong":"9007199254740993"}}', sortJson: undefined, skip: 0, limit: 100 }), 'db.getCollection("orders").find({"snowflake":NumberLong("9007199254740993")}).skip(0).limit(100)');
  assert.equal(elasticsearch.documentsLabel({ total: 7, t }), "Documents");
  assert.equal(elasticsearch.filterInputLabel, "filter");
  assert.equal(
    elasticsearch.queryPreview({ collection: "orders", filterJson: '{"city":"长治"}', sortJson: '{"createdAt":-1}', skip: 20, limit: 10 }),
    ["POST /orders/_search", "{", '  "from": 20,', '  "size": 10,', '  "query": {', '    "term": {', '      "city": "长治"', "    }", "  },", '  "sort": [', "    {", '      "createdAt": {', '        "order": "desc"', "      }", "    }", "  ]", "}"].join("\n"),
  );
});

test("builds reusable document filter conditions", () => {
  assert.deepEqual(buildDocumentFilterCondition(rule({})), { city: "长治" });
  assert.deepEqual(buildDocumentFilterCondition(rule({ mode: "not-like", rawValue: "test" })), {
    city: { $not: { $regex: "test", $options: "i" } },
  });
  assert.deepEqual(buildDocumentFilterCondition(rule({ mode: "is-not-null", rawValue: "" })), { city: { $ne: null } });
});

test("extracts nested document field paths for structured filters", () => {
  assert.deepEqual(
    documentFieldPathOptionsFromDocuments([
      { _id: "1", profile: { city: "上海", address: { zip: 200000 } }, tags: ["a"] },
      { _id: "2", status: "active", profile: { city: "北京" }, audit: [{ by: "ops" }] },
    ]),
    ["_id", "profile", "profile.city", "profile.address", "profile.address.zip", "tags", "status", "audit", "audit.by"],
  );
});

test("builds hierarchical document field path tree for array objects", () => {
  const tree = documentFieldPathTreeFromDocuments([{ _id: "1", orders: [{ sku: "A", qty: 2 }], tags: ["a"], profile: { address: { zip: 1 } } }]);
  const flattened = flattenDocumentFieldPathTree(tree);
  const orders = tree.find((node) => node.path === "orders");
  const sku = flattened.find((node) => node.path === "orders.sku");

  assert.equal(orders?.kind, "array-object");
  assert.equal(orders?.label, "orders[]");
  assert.equal(sku?.path, "orders.sku");
  assert.equal(sku?.displayPath, "orders[] > sku");
  assert.deepEqual(
    flattened.map((node) => node.path),
    ["_id", "orders", "orders.sku", "orders.qty", "tags", "profile", "profile.address", "profile.address.zip"],
  );
});

test("searches nested document field paths", () => {
  const tree = documentFieldPathTreeFromDocuments([{ profile: { address: { zip: 200000 }, city: "Shanghai" }, orders: [{ sku: "A" }] }]);

  assert.deepEqual(
    searchDocumentFieldPathTree(tree, "address").map((node) => node.path),
    ["profile.address", "profile.address.zip"],
  );
  assert.deepEqual(
    searchDocumentFieldPathTree(tree, "orders[] > sku").map((node) => node.path),
    ["orders.sku"],
  );
});

test("formats document query object input", () => {
  assert.equal(formatDocumentQueryInput('{profile:{city:"上海"},status:"active"}', "mongodb"), ['{', '  "profile": {', '    "city": "上海"', '  },', '  "status": "active"', '}'].join("\n"));
});
test("preserves MongoDB int64 document filter values", () => {
  const id = "2048938405781032962";
  const firstUnsafeInteger = "9007199254740993";
  assert.deepEqual(buildDocumentFilterCondition(rule({ fieldName: "processInfoId", rawValue: id }), { kind: "mongodb" }), {
    processInfoId: { $numberLong: id },
  });
  assert.deepEqual(buildDocumentFilterCondition(rule({ fieldName: "snowflake", rawValue: firstUnsafeInteger }), { kind: "mongodb" }), {
    snowflake: { $numberLong: firstUnsafeInteger },
  });
  assert.deepEqual(buildDocumentFilterCondition(rule({ fieldName: "processInfoId", mode: "greater-than", rawValue: id }), { kind: "mongodb" }), {
    processInfoId: { $gt: { $numberLong: id } },
  });
  assert.deepEqual(buildDocumentFilterCondition(rule({ fieldName: "processInfoId", mode: "like", rawValue: id }), { kind: "mongodb" }), {
    processInfoId: { $regex: id, $options: "i" },
  });
  assert.deepEqual(buildDocumentFilterCondition(rule({ fieldName: "processInfoId", rawValue: `"${id}"` }), { kind: "mongodb" }), {
    processInfoId: id,
  });
  assert.equal(currentDocumentFilterJson(`{processInfoId:${id}}`, null, "mongodb"), JSON.stringify({ processInfoId: { $numberLong: id } }));
  assert.equal(currentDocumentFilterJson("", { processInfoId: { $numberLong: id } }, "mongodb"), JSON.stringify({ processInfoId: { $numberLong: id } }));
});

test("keeps unsafe standalone document filter integers precise outside MongoDB", () => {
  assert.deepEqual(buildDocumentFilterCondition(rule({ fieldName: "processInfoId", rawValue: "2048938405781032962" })), {
    processInfoId: "2048938405781032962",
  });
});

test("combines manual and structured document filters", () => {
  const structured = combineDocumentFilterConditions([{ city: "长治" }, { status: "active" }], [rule({}), rule({ fieldName: "status", rawValue: "active", conjunction: "OR" })]);

  assert.deepEqual(structured, { $or: [{ city: "长治" }, { status: "active" }] });
  assert.equal(currentDocumentFilterJson('{"tenant":"a"}', structured), JSON.stringify({ $and: [{ tenant: "a" }, structured] }));
});

test("translates document filters to Elasticsearch search body previews", () => {
  assert.deepEqual(
    elasticsearchSearchBodyFromDocumentQuery({
      filterJson: JSON.stringify({ $and: [{ city: { $ne: "上海" } }, { age: { $gt: 18, $lte: 60 } }] }),
      sortJson: '{"createdAt":-1}',
      skip: 0,
      limit: 50,
    }),
    {
      from: 0,
      size: 50,
      query: {
        bool: {
          filter: [{ bool: { must_not: [{ term: { city: "上海" } }] } }, { range: { age: { gt: 18, lte: 60 } } }],
        },
      },
      sort: [{ createdAt: { order: "desc" } }],
    },
  );
});
