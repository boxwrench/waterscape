import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const modules=new Set();
async function moduleGraph(file){
 file=path.resolve(file);if(modules.has(file))return;modules.add(file);
 const source=await readFile(file,'utf8');
 // Specifiers never contain spaces or commas (keeps words like 'from' in string lists out).
 for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"\s,]+)['"]/g)){
  if(!match[1].startsWith('.'))throw Error(`External browser import: ${match[1]}`);
  await moduleGraph(path.resolve(path.dirname(file),match[1]));
 }
}
for(const entry of ['renderer/explore.js','site/journey.js'])await moduleGraph(path.join(root,entry));
for(const file of [...modules,...['site/journey.css','index.html','renderer/explore.html','renderer/explore.css','renderer/water.cu','renderer/assets/seabed.jpg','LICENSE','THIRD_PARTY_NOTICES.md','vendor/cuda-webshader/LICENSE','vendor/three/LICENSE'].map(f=>path.join(root,f))]){
 const relative=path.relative(root,file);if(relative.startsWith('..'))throw Error('Asset outside project');
 await mkdir(path.dirname(path.join(out,relative)),{recursive:true});await cp(file,path.join(out,relative));
}
// Reservoir bundles ship whole; the uncompressed native twin never does.
await cp(path.join(root,'data'),path.join(out,'data'),{recursive:true,filter:(src)=>!src.endsWith('terrain.bin')});
await writeFile(path.join(out,'.nojekyll'),'');
console.log(`Built Pages with ${modules.size} browser modules, shared CUDA source and licensed assets.`);
