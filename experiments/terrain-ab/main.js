import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTerrain } from 'procedural-terrains';

// A/B study uses real, checked-in Waterscape Hetch Hetchy data. Do not
// generate or guess elevation for the real reservoir.
const SIZE=2048,N=257, CX=-4100,CZ=-250;
const file='/data/hetch_hetchy/';
const mode=document.querySelector('#mode');
const status=document.querySelector('#status');
const stats={a:document.querySelector('#stat-a'),b:document.querySelector('#stat-b')};
async function json(name){const r=await fetch(file+name);if(!r.ok)throw Error(name+' HTTP '+r.status);return r.json();}
async function load() {
  const [meta,structures,response]=await Promise.all([json('terrain.json'),json('structures.json'),fetch(file+'terrain.bin.gz')]);
  if(!response.ok)throw Error('Terrain binary HTTP '+response.status);
  let bytes=await response.arrayBuffer();
  const magic=new Uint8Array(bytes,0,2);
  if(magic[0]===31&&magic[1]===139){
    bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  const w=meta.width,h=meta.height,n=w*h,channels=Object.entries(meta.channels),data={},dv=new DataView(bytes);
  if(bytes.byteLength!==n*2*channels.length)throw Error('Invalid packed terrain bytes');
  channels.forEach(([key,codec],c)=>{
    const row=new Uint16Array(w),arr=new Float32Array(n);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      row[i]=(row[i]+dv.getUint16((c*n+j*w+i)*2,true))&65535;
      arr[j*w+i]=row[i]*codec.scale+codec.offset;
    }
    data[key]=arr;
  });
  function sample(x,z,key){
    const a=data[key],u=Math.max(0,Math.min(w-1.0001,(x-meta.gridOrigin[0])/meta.cell[0])),
          v=Math.max(0,Math.min(h-1.0001,(z-meta.gridOrigin[1])/meta.cell[1]));
    const i=Math.floor(u),j=Math.floor(v),tx=u-i,tz=v-j;
    const p=a[j*w+i],q=a[j*w+i+1],r=a[(j+1)*w+i],s=a[(j+1)*w+i+1];
    return (p+(q-p)*tx)*(1-tz)+(r+(s-r)*tx)*tz;
  }
  const heights=new Float32Array(N*N),shore=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=CX-SIZE/2+i*SIZE/(N-1),z=CZ-SIZE/2+j*SIZE/(N-1),idx=j*N+i;
    shore[idx]=sample(x,z,'shoreDistance');
    // No measured bathymetry: reproduce existing Waterscape artificial
    // under-lake bank slope, capped at 30m below water surface.
    heights[idx]=shore[idx]<0?-Math.min(30,-shore[idx]/3):sample(x,z,'height');
  }
  return {meta,structures,sample,heights,shore};
}
function baseline(t){
  const g=new THREE.PlaneGeometry(SIZE,SIZE,N-1,N-1);
  g.rotateX(-Math.PI/2);
  const a=g.getAttribute('position');
  for(let i=0;i<t.heights.length;i++)a.setY(i,t.heights[i]);
  a.needsUpdate=true;g.computeVertexNormals();
  const norm=g.getAttribute('normal'),col=new Float32Array(N*N*3);
  const green=new THREE.Color('#526653'),rock=new THREE.Color('#878b88'),tmp=new THREE.Color();
  for(let i=0;i<N*N;i++){
    const slope=1-Math.max(0,norm.getY(i));
    tmp.copy(green).lerp(rock,Math.max(
      THREE.MathUtils.smoothstep(slope,0.06,0.3),
      THREE.MathUtils.smoothstep(t.heights[i],250,500)));
    col[i*3]=tmp.r;col[i*3+1]=tmp.g;col[i*3+2]=tmp.b;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  return new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
}
function water(t){
  const coords=[],step=SIZE/(N-1);
  const corner=(i,j)=>({x:-SIZE/2+i*step,z:-SIZE/2+j*step,d:t.shore[j*N+i]});
  function triangle(verts){
    const out=[];
    for(let k=0;k<3;k++){
      const a=verts[k],b=verts[(k+1)%3],wa=a.d<=0,wb=b.d<=0;
      if(wa)out.push(a);
      if(wa!==wb){const q=a.d/(a.d-b.d);out.push({x:a.x+(b.x-a.x)*q,z:a.z+(b.z-a.z)*q});}
    }
    for(let k=1;k+1<out.length;k++)for(const p of [out[0],out[k],out[k+1]])coords.push(p.x,0.2,p.z);
  }
  for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){
    const a=corner(i,j),b=corner(i+1,j),c=corner(i,j+1),d=corner(i+1,j+1);
    triangle([a,c,b]);triangle([b,c,d]);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({
    color:'#32747f',roughness:0.24,metalness:0.08,transparent:true,opacity:0.82,
    depthWrite:false,side:THREE.DoubleSide}));
  mesh.renderOrder=2;return mesh;
}
function local(point,meta){return [point[0]-meta.originUTM[0]-CX,meta.originUTM[1]-point[1]-CZ];}
function dam(t){
  const dam=t.structures.dams[0],meta=t.meta;
  const ctr=dam.crestUTM.map(p=>{const [x,z]=local(p,meta);return new THREE.Vector3(x,0,z);});
  const path=new THREE.CatmullRomCurve3(ctr),
        points=path.getSpacedPoints(Math.max(2,Math.round(path.getLength()/4)));
  const q0=ctr[0],q1=ctr.at(-1),tx=q1.x-q0.x,tz=q1.z-q0.z,sl=Math.hypot(tx,tz);
  const nx=-tz/sl,nz=tx/sl,mid=ctr[Math.floor(ctr.length/2)];
  const dry=t.sample(mid.x+CX+nx*40,mid.z+CZ+nz*40,'shoreDistance')>
            t.sample(mid.x+CX-nx*40,mid.z+CZ-nz*40,'shoreDistance')?1:-1;
  const top=dam.crestElevation-meta.waterLevel,depth=dam.height+12;
  const p=[[0,-depth],[0,1.2],[0.45,1.2],[0.45,0],[7.05,0],
           [7.05,1.2],[7.5,1.2],[7.5,-6],[7.5+0.75*(depth-6),-depth]];
  let distance=0;
  const frames=points.map((pt,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],
      tang=b.clone().sub(a).normalize();
    if(i)distance+=pt.distanceTo(points[i-1]);
    return {pt,n:new THREE.Vector3(-tang.z,0,tang.x).multiplyScalar(dry),distance};
  });
  const xyz=[],index=[],uv=[];
  for(let k=0;k<p.length;k++){
    const a=p[k],b=p[(k+1)%p.length],edge=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const start=xyz.length/3;
    for(const f of frames)for(const [u,y,v] of [[a[0],a[1],0],[b[0],b[1],edge]]){
      xyz.push(f.pt.x+f.n.x*u,top+y,f.pt.z+f.n.z*u);uv.push(f.distance/11,v/11);
    }
    for(let i=0;i+1<frames.length;i++){const s=start+i*2;index.push(s,s+1,s+2,s+1,s+3,s+2);}
  }
  for(const f of [frames[0],frames.at(-1)]){
    const start=xyz.length/3;
    for(const [u,y] of p){xyz.push(f.pt.x+f.n.x*u,top+y,f.pt.z+f.n.z*u);uv.push(u/11,y/11);}
    for(let k=1;k+1<p.length;k++)index.push(start,start+k,start+k+1);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(index);geom.computeVertexNormals();
  const group=new THREE.Group();
  group.name="O'Shaughnessy Dam — sourced crest, approximate gravity cross-section";
  group.add(new THREE.Mesh(geom,new THREE.MeshStandardMaterial({
    color:'#b7b4a7',roughness:0.85,side:THREE.DoubleSide})));
  // Simplified markers, not the full existing WebGPU dam spillway.
  const spill=dam.spillway;
  if(spill){
    const [a,b]=spill.gatesUTM.map(q=>local(q,meta)),dx=b[0]-a[0],dz=b[1]-a[1];
    for(let i=0;i<spill.gates;i++){
      const v=(i+0.5)/spill.gates,gate=new THREE.Mesh(
        new THREE.BoxGeometry(spill.gateWidth,spill.gateHeight,2.8),
        new THREE.MeshStandardMaterial({color:'#7b8b90',metalness:0.38,roughness:0.65}));
      gate.position.set(a[0]+v*dx,top-spill.gateTopBelowCrest-1.5,a[1]+v*dz);
      gate.rotation.y=-Math.atan2(dz,dx);group.add(gate);
    }
  }
  return group;
}
function view(key){
  const canvas=document.querySelector('#canvas-'+key);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#bbcbcc');scene.fog=new THREE.FogExp2('#bbcbcc',0.00013);
  scene.add(new THREE.HemisphereLight('#e6f2ff','#5b5144',2.0));
  const sun=new THREE.DirectionalLight('#fff2d9',2.2);sun.position.set(-600,900,250);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(50,1,1,8500),orbit=new OrbitControls(camera,canvas);
  orbit.enableDamping=true;orbit.minDistance=50;orbit.maxDistance=4000;
  const reset=()=>{camera.position.set(-850,530,850);orbit.target.set(-330,-10,0);orbit.update();};
  reset();
  return {key,canvas,renderer,scene,camera,orbit,reset};
}
async function go(){
  const t=await load();
  const a=view('a'),b=view('b'),views=[a,b];
  for(const v of views){v.scene.add(water(t));v.scene.add(dam(t));}
  a.scene.add(baseline(t));
  stats.a.textContent='Raw terrain mesh ready';
  const terrain=await createTerrain({renderer:b.renderer,configuration:{
    layout:{chunkCount:8,chunkSize:256},
    heightScale:900,seaLevel:0,
    source:{kind:'heightmap',width:N,height:N,data:t.heights,strength:0,detail:0,warp:0,falloff:0},
    quality:{lodSegments:[64,32,16,8],morphEnabled:true,mergeEnabled:true,cullingEnabled:true}
  }});
  b.scene.add(terrain.object);await terrain.prepare(b.camera);b.terrain=terrain;
  stats.b.textContent='Procedural Terrains runtime ready';
  let lock=false;
  views.forEach((v,i)=>v.orbit.addEventListener('change',()=>{
    if(lock)return;lock=true;
    const other=views[1-i];other.camera.position.copy(v.camera.position);
    other.orbit.target.copy(v.orbit.target);other.orbit.update();lock=false;
  }));
  function resize(v){
    const w=v.canvas.clientWidth,h=v.canvas.clientHeight;
    if(!w||!h)return;
    v.renderer.setSize(w,h,false);v.camera.aspect=w/h;v.camera.updateProjectionMatrix();
  }
  mode.addEventListener('change',()=>{document.body.dataset.mode=mode.value;views.forEach(resize);});
  document.querySelector('#reset').addEventListener('click',()=>views.forEach(v=>v.reset()));
  window.addEventListener('resize',()=>views.forEach(resize));views.forEach(resize);
  status.textContent='Real Hetch Hetchy 3DEP | 2.048km crop | 257² shared elevation | '+t.structures.dams[0].height+'m dam. Isolate one mode for GPU benchmarks.';
  let previous=performance.now(),last=0;
  function frame(now){
    const dt=Math.min(0.1,(now-previous)/1000);previous=now;
    for(const v of views){
      if(mode.value!=='split'&&mode.value!==v.key)continue;
      resize(v);v.orbit.update();if(v.terrain)v.terrain.update(dt,{camera:v.camera});
      v.renderer.render(v.scene,v.camera);
    }
    if(now-last>750){for(const v of views){
      const r=v.renderer.info.render;
      stats[v.key].textContent=r.calls+' draws · '+r.triangles.toLocaleString()+' triangles';
    }last=now;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
go().catch(e=>{status.textContent='A/B could not start: '+e.message;console.error(e);});
