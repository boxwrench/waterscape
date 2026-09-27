// Copies the three.js WebGPU build into vendor/three/ (the site allows no bare imports).
// Usage: node scripts/vendor-three.mjs   (after npm install; pins the version in package.json)
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const from = "node_modules/three",
  to = "vendor/three";
await mkdir(to, { recursive: true });
for (const f of ["three.core.js", "three.webgpu.js"]) await copyFile(`${from}/build/${f}`, `${to}/${f}`);
// three.tsl.js re-exports from the bare specifier 'three/webgpu'.
const tsl = await readFile(`${from}/build/three.tsl.js`, "utf8");
await writeFile(`${to}/three.tsl.js`, tsl.replaceAll("from 'three/webgpu'", "from './three.webgpu.js'"));
await copyFile(`${from}/LICENSE`, `${to}/LICENSE`);
console.log("Vendored three.js into vendor/three/.");
