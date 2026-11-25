import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
export default defineConfig({
  root, publicDir:false, server:{host:'127.0.0.1',port:5176,fs:{allow:[root]}},
  resolve:{alias:{three:resolve(here,'node_modules/three')},dedupe:['three']}
});
