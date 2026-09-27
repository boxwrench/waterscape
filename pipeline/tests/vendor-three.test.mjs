import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = ["three.core.js", "three.webgpu.js", "three.tsl.js"];

test("vendored three.js r186 has only relative imports", async () => {
  for (const f of files) {
    const src = await readFile(new URL(`../../vendor/three/${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"\s,]+)['"]/g))
      assert.ok(m[1].startsWith("."), `${f} imports ${m[1]}`);
  }
  const core = await readFile(new URL("../../vendor/three/three.core.js", import.meta.url), "utf8");
  assert.match(core, /const REVISION = '186'/);
  await readFile(new URL("../../vendor/three/LICENSE", import.meta.url), "utf8");
});
