import assert from "node:assert/strict";
import { test } from "node:test";
import { isMongoConfigured } from "@/lib/db/mongodb-config";

test("MongoDB configuration is optional and whitespace is treated as missing", () => {
  assert.equal(isMongoConfigured(undefined), false);
  assert.equal(isMongoConfigured(""), false);
  assert.equal(isMongoConfigured("   "), false);
  assert.equal(isMongoConfigured("mongodb://localhost:27017"), true);
});
