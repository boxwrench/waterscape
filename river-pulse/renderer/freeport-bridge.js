import * as THREE from "../../vendor/three/three.webgpu.js";
import { color, mix, positionLocal, smoothstep, texture, vec2 } from "../../vendor/three/three.tsl.js";
import { FREEPORT_BRIDGE as B } from "./freeport-bridge-layout.js";

// One shared, fully three-dimensional closed bridge for every viewpoint.
// Horizontal envelope follows archived NBI; unsourced sections/heights are photo fits.
export function createFreeportBridge() {
  const group = new THREE.Group(), batches = new Map(), boxGeometry = new THREE.BoxGeometry(1, 1, 1),
    cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12), identity = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0), steel = new THREE.MeshStandardNodeMaterial({
      color: 0x467e69, metalness: 0.22, roughness: 0.72 }),
    darkSteel = new THREE.MeshStandardNodeMaterial({ color: 0x285241, metalness: 0.25, roughness: 0.8 }),
    concrete = new THREE.MeshStandardNodeMaterial({ roughness: 0.97 }),
    wood = new THREE.MeshStandardNodeMaterial({ roughness: 1 }),
    deck = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0.25 }),
    asphalt = new THREE.MeshStandardNodeMaterial({ roughness: 0.98 }),
    siding = new THREE.MeshStandardNodeMaterial({ roughness: 0.98 }),
    roof = new THREE.MeshStandardNodeMaterial({ roughness: 0.96 }),
    pale = new THREE.MeshStandardNodeMaterial({ color: 0xc4c3b4, roughness: 0.92 }),
    yellow = new THREE.MeshStandardNodeMaterial({ color: 0xc9b267, roughness: 0.85 }),
    red = new THREE.MeshStandardNodeMaterial({ color: 0x94483b, roughness: 0.8 }),
    black = new THREE.MeshStandardNodeMaterial({ color: 0x202b25, roughness: 0.82 }),
    glass = new THREE.MeshStandardNodeMaterial({ color: 0x527271, metalness: 0.45, roughness: 0.24 });
  const p = positionLocal, weather = bridgeWeatherTexture();
  concrete.colorNode = mix(color(0x696b61), color(0xb3b1a3), texture(weather, p.xy.div(8)).r)
    .mul(mix(0.65, 1, smoothstep(0.1, 1.5, p.y)))
    .mul(mix(0.96, 1, p.y.mul(23).sin().abs()));
  steel.colorNode = mix(color(0x396d56), color(0x548873), texture(weather, p.xy.div(4)).r);
  wood.colorNode = mix(color(0x282e26), color(0x595447), texture(weather, p.xy.mul(vec2(3, 0.12))).r);
  // Orthotropic/grated deck impression: fine, restrained crossing metal slots.
  deck.colorNode = mix(color(0x303a33), color(0x6f7364),
    p.x.mul(44).sin().abs().mul(p.z.mul(58).sin().abs()));
  asphalt.colorNode = mix(color(0x4d514d), color(0x787b72), texture(weather, p.xz.div(5)).r)
    .mul(mix(0.8, 1, texture(weather, p.xz.div(0.1)).g));
  siding.colorNode = mix(color(0xa5a99a), color(0xc2c3b4), texture(weather, p.xy.div(6)).r)
    .mul(mix(0.88, 1, p.y.mul(27).sin().abs()));
  roof.colorNode = mix(color(0x495249), color(0x727568), texture(weather, p.xz.mul(2)).r)
    .mul(mix(0.8, 1, p.y.mul(60).sin().abs()));
  group.position.set(B.x, 0, B.z); group.rotation.y = B.yaw;
  group.name = "Freeport Bridge · reference reconstruction";
  group.userData = { bindingClass: "setting", surveyed: false, dimensions: B };

  function shape(geometry, position, scale, quaternion, material) {
    let batch = batches.get(material);
    if (!batch) { batch = { positions: [], normals: [], indices: [] }; batches.set(material, batch); }
    const base = batch.positions.length / 3, matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale)),
      normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), pos = geometry.attributes.position,
      norm = geometry.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix); batch.positions.push(v.x, v.y, v.z);
      v.fromBufferAttribute(norm, i).applyNormalMatrix(normalMatrix); batch.normals.push(v.x, v.y, v.z);
    }
    for (const index of geometry.index.array) batch.indices.push(base + index);
  }
  function box(x, y, z, sx, sy, sz, material = steel) {
    shape(boxGeometry, [x, y, z], [sx, sy, sz], identity, material);
  }
  function beam(a, b, width = 0.12, depth = width, material = steel) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    shape(boxGeometry, start.add(end).multiplyScalar(0.5).toArray(), [width, delta.length(), depth],
      new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()), material);
  }
  function pin(x, y, z, radius, length, material = darkSteel) {
    shape(cylinderGeometry, [x, y, z], [radius, length, radius],
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), material);
  }
  // Two channels joined by visible diagonal lacing, rather than solid rectangular bars.
  function laced(a, b, width = 0.38, depth = 0.24, pitch = 0.55, roll = 0) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), length = delta.length(),
      q = new THREE.Quaternion().setFromUnitVectors(up, delta.normalize())
        .multiply(new THREE.Quaternion().setFromAxisAngle(up, roll)),
      point = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(start).toArray();
    for (const sign of [-1, 1]) {
      beam(point(sign * width / 2, 0, 0), point(sign * width / 2, length, 0), 0.075, depth);
      for (const face of [-1, 1]) {
        beam(point(sign * width / 2, 0, face * depth / 2), point(sign * width / 2, length, face * depth / 2), 0.12, 0.035);
      }
    }
    const n = Math.ceil(length / pitch);
    for (let i = 0; i < n; i++) for (const face of [-1, 1]) {
      beam(point((i % 2 ? 1 : -1) * width / 2, length * i / n, face * depth / 2),
        point((i % 2 ? -1 : 1) * width / 2, length * (i + 1) / n, face * depth / 2), 0.05, 0.03);
    }
  }
  function girder(a, b, height = 0.48, depth = 0.27) {
    beam(a, b, height, depth);
    for (const s of [-1, 1]) beam([a[0], a[1], a[2] + s * depth / 2],
      [b[0], b[1], b[2] + s * depth / 2], height + 0.08, 0.045);
  }
  function gusset(x, y, z, size = 0.58) {
    box(x, y, z, size, size, 0.055);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      pin(x + i * size * 0.31, y + j * size * 0.31, z + 0.034, 0.023, 0.025);
  }
  function crossBracing(x0, x1, y0, y1) {
    const normal = new THREE.Vector3(y0 - y1, x1 - x0, 0).normalize(),
      along = new THREE.Vector3(x1 - x0, y1 - y0, 0).normalize(),
      middle = [(x0 + x1) / 2, (y0 + y1) / 2, 0];
    // Photo 02997: paired open members with short cross ties, a center plate
    // and transverse strut. The X lies in the roof plane, including upper links.
    function paired(a, b) {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b),
        direction = end.clone().sub(start), length = direction.length(),
        across = new THREE.Vector3().crossVectors(normal, direction.clone().normalize()).multiplyScalar(0.11),
        point = (t, side) => start.clone().lerp(end, t).addScaledVector(across, side).toArray();
      for (const side of [-1, 1]) beam(point(0, side), point(1, side), 0.065, 0.075);
      const ties = Math.ceil(length / 0.9);
      for (let i = 0; i <= ties; i++) beam(point(i / ties, -1), point(i / ties, 1), 0.055, 0.055);
    }
    paired([x0, y0, -B.trussZ], [x1, y1, B.trussZ]);
    paired([x0, y0, B.trussZ], [x1, y1, -B.trussZ]);
    beam([middle[0], middle[1], -B.trussZ], [middle[0], middle[1], B.trussZ], 0.11, 0.13);
    shape(boxGeometry, middle, [0.62, 0.065, 0.62],
      new THREE.Quaternion().setFromUnitVectors(up, normal), steel);
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2])
      shape(cylinderGeometry, new THREE.Vector3(...middle).addScaledVector(along, x)
        .addScaledVector(normal, 0.05).add(new THREE.Vector3(0, 0, z)).toArray(), [0.027, 0.035, 0.027],
        new THREE.Quaternion().setFromUnitVectors(up, normal), darkSteel);
    laced([x0, y0, -B.trussZ], [x0, y0, B.trussZ], 0.34, 0.18, 0.55, Math.PI / 2);
  }
  function rail(x0, x1, z, material = steel) {
    for (const y of [B.deckY + 0.32, B.deckY + 1.23]) beam([x0, y, z], [x1, y, z], 0.065, 0.065, material);
    const n = Math.ceil((x1 - x0) / 1.15);
    for (let i = 0; i < n; i++) {
      const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n;
      beam([a, B.deckY + 0.33, z], [b, B.deckY + 1.21, z], 0.042, 0.042, material);
      beam([a, B.deckY + 1.21, z], [b, B.deckY + 0.33, z], 0.042, 0.042, material);
    }
  }

  const hinge = B.mainSpan / 2, fixedEnd = hinge + B.fixedSpan, eastEnd = fixedEnd + B.eastPony,
    westEnd = eastEnd - B.length;
  const spans = [[westEnd, -fixedEnd], [-fixedEnd, -hinge], [-hinge, -0.045], [0.045, hinge], [hinge, fixedEnd], [fixedEnd, eastEnd]];
  for (const [x0, x1] of spans) {
    const surface = Math.abs(x0) <= hinge && Math.abs(x1) <= hinge ? deck : asphalt;
    box((x0 + x1) / 2, B.deckY - 0.15, 0, x1 - x0, 0.24, B.deckWidth, surface);
    if (surface === asphalt) for (const z of [-0.095, 0.095]) box((x0 + x1) / 2, B.deckY - 0.024, z, x1 - x0, 0.009, 0.085, yellow);
    for (const z of [-3.34, 3.34]) box((x0 + x1) / 2, B.deckY + 0.11, z, x1 - x0, 0.24, 0.2, pale);
    for (const z of [-B.trussZ, B.trussZ]) {
      girder([x0, B.deckY - 0.48, z], [x1, B.deckY - 0.48, z], 0.6, 0.28);
      if (x1 > -fixedEnd) rail(x0, x1, z - Math.sign(z) * 0.25);
      else for (const y of [B.deckY + 0.6, B.deckY + 1.2]) beam([x0, y, z], [x1, y, z], 0.14, 0.2, pale);
    }
    const panels = Math.ceil((x1 - x0) / 5);
    for (let i = 0; i <= panels; i++) {
      const x = x0 + (x1 - x0) * i / panels;
      beam([x, B.deckY - 0.45, -3.85], [x, B.deckY - 0.45, 3.85], 0.26, 0.17, darkSteel);
      if (i < panels) crossBracing(x, x0 + (x1 - x0) * (i + 1) / panels, B.deckY - 0.63, B.deckY - 0.63);
    }
    for (const z of [-2.4, -1.2, 0, 1.2, 2.4]) beam([x0, B.deckY - 0.35, z], [x1, B.deckY - 0.35, z], 0.13, 0.14, darkSteel);
  }

  for (const side of [-1, 1]) {
    const h = side * hinge, outer = side * fixedEnd, n = 6,
      xAt = i => h + side * B.fixedSpan * i / n,
      // Sloping portal posts at each end; the counterweight frame rises above this.
      topAt = i => i === 0 || i === n ? B.deckY : B.fixedTop;
    for (const z of [-B.trussZ, B.trussZ]) {
      for (let i = 0; i < n; i++) {
        const x0 = xAt(i), x1 = xAt(i + 1);
        laced([x0, topAt(i), z], [x1, topAt(i + 1), z], 0.5, 0.28);
        if (i > 0) laced([x0, B.deckY, z], [x0, B.fixedTop, z], 0.28, 0.25);
        if (i > 0 && i < n - 1) {
          const a = i < n / 2 ? [x0, B.fixedTop, z] : [x0, B.deckY, z],
            b = i < n / 2 ? [x1, B.deckY, z] : [x1, B.fixedTop, z];
          laced(a, b, 0.3, 0.22);
        }
        gusset(x0, B.deckY, z + Math.sign(z) * 0.15);
        if (i > 0) gusset(x0, B.fixedTop, z + Math.sign(z) * 0.15);
      }
      // Each leaf is a separate tapered Pratt cantilever, low at the center joint.
      const leafPanels = 6, leafTop = i => B.deckY + 4.5 - 2.7 * i / leafPanels;
      for (let i = 0; i < leafPanels; i++) {
        const a = h * (1 - i / leafPanels), b = h * (1 - (i + 1) / leafPanels);
        girder([a, leafTop(i), z], [b, leafTop(i + 1), z], 0.35, 0.22);
        laced([a, B.deckY, z], [a, leafTop(i), z], 0.25, 0.18);
        laced([a, leafTop(i), z], [b, B.deckY, z], 0.3, 0.18);
        gusset(a, leafTop(i), z + Math.sign(z) * 0.12, 0.47);
      }
      laced([side * 0.045, B.deckY, z], [side * 0.045, leafTop(leafPanels), z], 0.22, 0.2);
      // Triangular fixed tower and articulated heel-trunnion upper links.
      const toe = h + side * 1.1, peak = h + side * 8.6, tail = h + side * 22.4,
        weightPin = h + side * 20.5;
      laced([toe, B.deckY, z], [peak, B.towerTop, z], 0.68, 0.36, 0.65);
      laced([tail, B.deckY, z], [peak, B.towerTop, z], 0.54, 0.32, 0.65);
      laced([toe, B.deckY + 4.5, z], [weightPin, 15.2, z], 0.55, 0.33);
      laced([peak, B.towerTop, z], [weightPin, 15.2, z], 0.58, 0.34);
      for (const [x, y, r] of [[h, B.deckY + 0.2, 0.53], [toe, B.deckY + 4.5, 0.42], [peak, B.towerTop, 0.4], [weightPin, 15.2, 0.5]]) {
        pin(x, y, z, r, 0.65); pin(x, y, z + Math.sign(z) * 0.4, r * 0.68, 0.08, steel);
      }
      // The rack strut rises from machinery beside the main hinge.
      girder([h + side * 1.7, B.deckY + 0.7, z - Math.sign(z) * 0.3],
        [h + side * 6.4, B.deckY + 7.2, z - Math.sign(z) * 0.3], 0.18, 0.2);
      box(h + side * 3, B.deckY + 0.9, z, 2.3, 1.5, 0.72, darkSteel);
      // Catwalk steps, handrails and maintenance ladder follow the upper link.
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, x = toe + side * 19.4 * t, y = B.deckY + 4.5 + 4.5 * t;
        box(x, y, z + Math.sign(z) * 0.5, 0.45, 0.06, 0.65, darkSteel);
      }
      beam([toe, B.deckY + 5.5, z + Math.sign(z) * 0.72], [weightPin, 16.2, z + Math.sign(z) * 0.72], 0.055);
      for (let i = 0; i < 9; i++) {
        const t = i / 8; beam([toe + side * 19.4 * t, B.deckY + 4.5 + 4.5 * t, z + Math.sign(z) * 0.72],
          [toe + side * 19.4 * t, B.deckY + 5.5 + 4.5 * t, z + Math.sign(z) * 0.72], 0.045);
      }
    }
    for (let i = 1; i < n - 1; i++) {
      // Leave the counterweight bay open: fixed roof braces cannot pass through it.
      const a = B.fixedSpan * i / n, b = B.fixedSpan * (i + 1) / n;
      if (b < 17.5 || a > 23.5) crossBracing(xAt(i), xAt(i + 1), B.fixedTop, B.fixedTop);
    }
    for (const i of [1, n - 1]) {
      const x = xAt(i); laced([x, B.fixedTop, -B.trussZ], [x, B.fixedTop, B.trussZ], 0.38, 0.22, 0.55, Math.PI / 2);
      const lower = B.deckY + 4.5;
      laced([x, lower, -B.trussZ], [x, lower, B.trussZ], 0.3, 0.2, 0.55, Math.PI / 2);
      for (const z of [-B.trussZ, 0]) {
        // Portal sway frames use angle struts, not diagonally laced columns.
        beam([x, lower, z], [x, B.fixedTop, z + B.trussZ], 0.13, 0.16);
        beam([x, B.fixedTop, z], [x, lower, z + B.trussZ], 0.13, 0.16);
        box(x, (lower + B.fixedTop) / 2, z + B.trussZ / 2, 0.07, 0.46, 0.46);
      }
    }
    const peak = h + side * 8.6, weightX = h + side * 20.5;
    crossBracing(peak, weightX, B.towerTop, 15.2);
    laced([peak, B.towerTop, -B.trussZ], [peak, B.towerTop, B.trussZ], 0.38, 0.3, 0.55, Math.PI / 2);
    // Massive exposed concrete weight suspended above the narrow road.
    box(weightX, 12.9, 0, 5.7, 4.6, 6.5, concrete);
    for (const z of [-3.32, 3.32]) box(weightX, 14.95, z, 6.0, 0.4, 0.17);
    box(peak, B.towerTop + 0.12, 0, 3.6, 0.09, 7.8, darkSteel);
    for (const x of [peak - side * 1.8, peak + side * 1.8]) {
      for (const y of [B.towerTop + 0.55, B.towerTop + 1]) beam([x, y, -3.9], [x, y, 3.9], 0.05);
      for (const z of [-3.9, 0, 3.9]) beam([x, B.towerTop + 0.1, z], [x, B.towerTop + 1, z], 0.045);
    }
    for (const z of [-3.9, 3.9]) for (const y of [B.towerTop + 0.55, B.towerTop + 1])
      beam([peak - side * 1.8, y, z], [peak + side * 1.8, y, z], 0.05);
    addPier(h, true); addPier(outer, false);
  }

  // A single east Warren pony approach; the west uses shorter stringer spans.
  for (const z of [-B.trussZ, B.trussZ]) {
    const n = 10, step = B.eastPony / n;
    for (let i = 0; i < n; i++) {
      const x0 = fixedEnd + i * step, x1 = x0 + step, top = B.deckY + 2.4;
      if (i > 0 && i < n - 1) girder([x0, top, z], [x1, top, z], 0.24, 0.22);
      laced([x0, i % 2 ? top : B.deckY, z], [x1, i % 2 ? B.deckY : top, z], 0.28, 0.24);
      if (i > 0 && i < n) laced([x0, B.deckY, z], [x0, top, z], 0.18, 0.16);
      gusset(x0, i % 2 ? top : B.deckY, z + Math.sign(z) * 0.13, 0.4);
    }
    girder([fixedEnd, B.deckY, z], [fixedEnd + step, B.deckY + 2.4, z], 0.3, 0.25);
    girder([eastEnd - step, B.deckY + 2.4, z], [eastEnd, B.deckY, z], 0.3, 0.25);
  }
  addPier((westEnd - fixedEnd) / 2, false);
  for (const x of [westEnd, eastEnd]) {
    box(x, 3, 0, 3.6, 5.8, 9.8, concrete);
    for (const sign of [-1, 1]) {
      box(x + Math.sign(x) * 7, B.deckY - 0.18, sign * 4.3, 15, 0.6, 0.65, concrete);
      box(x + Math.sign(x) * 7, B.deckY + 0.58, sign * 4.3, 15, 0.12, 0.3, pale);
      for (let i = 0; i < 5; i++) box(x + Math.sign(x) * i * 3, B.deckY + 0.24, sign * 4.3, 0.3, 0.8, 0.4, pale);
    }
    box(x + Math.sign(x) * 10, B.deckY - 0.25, 0, 20, 0.28, 8.2, asphalt);
    for (const z of [-0.095, 0.095]) box(x + Math.sign(x) * 10, B.deckY - 0.104, z, 20, 0.009, 0.085, yellow);
  }
  addTenderHouse();
  // Stop lights and raised traffic gates at both portals.
  for (const x of [-fixedEnd, fixedEnd]) for (const side of [-1, 1]) {
    const z = side * 4.3;
    box(x, B.deckY + 2.3, z, 0.13, 4.6, 0.13, pale);
    box(x, B.deckY + 2.65, z, 0.35, 2.0, 0.68, black);
    for (let i = 0; i < 2; i++) {
      // Signal lenses face road traffic along x, not sideways toward the bank.
      shape(cylinderGeometry, [x + Math.sign(x) * 0.21, B.deckY + 3.25 - i * 1.35, z], [0.2, 0.15, 0.2],
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), black);
    }
    box(x + Math.sign(x) * 0.22, B.deckY + 2.65, z, 0.05, 0.74, 0.65, pale);
    box(x - Math.sign(x) * 1.2, B.deckY + 2.45, side * 3.7, 0.12, 4.7, 0.17, pale);
    for (let i = 0; i < 9; i++) box(x - Math.sign(x) * 1.2, B.deckY + 0.55 + i * 0.5, side * 3.7, 0.15, 0.2, 0.19, red);
    box(x, B.deckY + 0.5, side * 3.7, 0.55, 1, 0.7, darkSteel);
  }
  // Yellow clearance bars on the fixed portal frame (no invented sign wording).
  for (const side of [-1, 1]) box(side * (fixedEnd - 6.25), B.deckY + 4.5, -1.8, 0.15, 0.3, 3.4, yellow);
  if (typeof document !== "undefined") addSigns();

  function addSigns() {
    // Wording copied from the original portal photographs, not live clearance data.
    function sign(width, height, background, draw) {
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); context.fillStyle = background; context.fillRect(0, 0, width, height); draw(context);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      return new THREE.MeshStandardNodeMaterial({ map, roughness: 0.85 });
    }
    const stop = sign(256, 320, "#c7c8b9", ctx => {
      ctx.fillStyle = "#202d25"; ctx.textAlign = "center"; ctx.font = "38px Arial";
      ctx.fillText("STOP", 128, 60); ctx.font = "25px Arial"; ctx.fillText("HERE ON", 128, 118);
      ctx.font = "bold 40px Arial"; ctx.fillText("RED", 128, 180);
      ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(85, 225); ctx.lineTo(173, 276);
      ctx.moveTo(130, 279); ctx.lineTo(175, 279); ctx.lineTo(175, 239); ctx.strokeStyle = "#202d25"; ctx.stroke();
    }), clearance = sign(1024, 110, "#c5ab56", ctx => {
      ctx.fillStyle = "#283527"; ctx.textAlign = "center"; ctx.font = "58px Arial";
      ctx.fillText("VERTICAL CLEARANCE 13'-8\"", 512, 78);
    });
    const plane = (x, y, z, width, height, side, material) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      mesh.position.set(x, y, z); mesh.rotation.y = side * Math.PI / 2; group.add(mesh);
    };
    for (const x of [-fixedEnd, fixedEnd]) for (const side of [-1, 1])
      plane(x + Math.sign(x) * 0.251, B.deckY + 2.65, side * 4.3, 0.65, 0.74, Math.sign(x), stop);
    for (const side of [-1, 1]) {
      const x = side * (fixedEnd - 6.25);
      plane(x + side * 0.08, B.deckY + 4.5, -1.8, 3.4, 0.3, side, clearance);
    }
  }

  function addPier(x, fender) {
    // Rounded oblong concrete pier, with cap, staining and visible bearing blocks.
    box(x, 2.15, 0, 3.9, 6.4, 7.8, concrete);
    for (const z of [-3.9, 3.9]) shape(cylinderGeometry, [x, 2.15, z], [1.95, 6.4, 1.95], identity, concrete);
    box(x, 5.3, 0, 4.6, 0.48, 11.5, concrete);
    for (const z of [-B.trussZ, B.trussZ]) {
      box(x, 5.64, z, 1.3, 0.25, 1.0, darkSteel);
      pin(x, 5.8, z, 0.25, 0.8);
    }
    if (!fender) return;
    // Long timber protection walls on both sides of each bascule pier.
    for (const side of [-1, 1]) {
      const z0 = side * 6, z1 = side * 21;
      for (const dx of [-4.8, 4.8]) {
        for (let i = 0; i <= 10; i++) {
          const z = z0 + (z1 - z0) * i / 10;
          shape(cylinderGeometry, [x + dx, 1.45, z], [0.23, 6.4, 0.23], identity, wood);
          if (i < 10) beam([x + dx, -0.1, z], [x + dx, 4.35, z + (z1 - z0) / 10], 0.18, 0.18, wood);
        }
        for (const y of [0.9, 2.4, 3.9, 4.4]) beam([x + dx, y, z0], [x + dx, y, z1], 0.26, 0.22, wood);
        beam([x + dx, 4.6, z0], [x + dx, 4.6, z1], 0.08, 0.08, pale);
      }
      for (let i = 0; i < 7; i++) {
        const dx = -4.8 + i * 1.6;
        shape(cylinderGeometry, [x + dx, 1.45, z1], [0.23, 6.4, 0.23], identity, wood);
      }
      for (const y of [0.9, 2.4, 3.9, 4.4]) beam([x - 4.8, y, z1], [x + 4.8, y, z1], 0.26, 0.22, wood);
      // White access ladder on the channel-facing end of each fender.
      for (const dx of [-0.36, 0.36]) beam([x + dx, -0.4, z1 + side * 0.25], [x + dx, 4.8, z1 + side * 0.25], 0.055, 0.055, pale);
      for (let i = 0; i < 17; i++) beam([x - 0.36, i * 0.3, z1 + side * 0.25], [x + 0.36, i * 0.3, z1 + side * 0.25], 0.04, 0.04, pale);
    }
  }
  function addTenderHouse() {
    const x = hinge + 24, z = -6.2, y = B.deckY;
    box(x, y - 0.3, z, 6, 0.45, 5, darkSteel);
    box(x, y + 1.4, z, 4.7, 2.8, 3.5, siding);
    for (const dx of [-1.45, 0, 1.45]) {
      box(x + dx, y + 1.9, z - 1.77, 1.08, 1.15, 0.05, glass);
      box(x + dx, y + 1.9, z + 1.77, 1.08, 1.15, 0.05, glass);
    }
    for (const side of [-1, 1]) box(x + side * 2.38, y + 1.9, z, 0.05, 1.15, 2.4, glass);
    const roofGeometry = new THREE.BufferGeometry(), ridge = [x, y + 4, z],
      corners = [[x - 2.7, y + 2.9, z - 2.1], [x - 2.7, y + 2.9, z + 2.1],
        [x + 2.7, y + 2.9, z + 2.1], [x + 2.7, y + 2.9, z - 2.1]], points = [];
    for (let i = 0; i < 4; i++) points.push(...corners[i], ...corners[(i + 1) % 4], ...ridge);
    roofGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    roofGeometry.setIndex(Array.from({ length: 12 }, (_, i) => i)); roofGeometry.computeVertexNormals();
    shape(roofGeometry, [0, 0, 0], [1, 1, 1], identity, roof); roofGeometry.dispose();
    for (const side of [-1, 1]) {
      box(x, y + 2.84, z + side * 2.1, 5.5, 0.18, 0.15, pale);
      box(x + side * 2.7, y + 2.84, z, 0.15, 0.18, 4.2, pale);
    }
    box(x + 1.75, y + 0.9, z + 1.8, 0.65, 1.8, 0.07, darkSteel);
    for (const side of [-1, 1]) {
      beam([x - 3, y + 1, z + side * 2.4], [x + 3, y + 1, z + side * 2.4], 0.07);
      for (let i = 0; i <= 6; i++) beam([x - 3 + i, y, z + side * 2.4], [x - 3 + i, y + 1, z + side * 2.4], 0.06);
    }
  }

  for (const [material, batch] of batches) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(batch.normals, 3));
    geometry.setIndex(batch.indices); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  boxGeometry.dispose(); cylinderGeometry.dispose();
  return group;
}

function bridgeWeatherTexture() {
  // Original procedural mottling, independent of the water's periodic wave noise.
  const size = 512, data = new Uint8Array(size * size * 4),
    hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); },
    sample = (x, y, f) => {
      const u = x * f / size, v = y * f / size, ix = Math.floor(u), iy = Math.floor(v),
        a = u - ix, b = v - iy, sx = a * a * (3 - 2 * a), sy = b * b * (3 - 2 * b),
        top = hash(ix, iy) * (1 - sx) + hash((ix + 1) % f, iy) * sx,
        bottom = hash(ix, (iy + 1) % f) * (1 - sx) + hash((ix + 1) % f, (iy + 1) % f) * sx;
      return top * (1 - sy) + bottom * sy;
    };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = 0.5 * sample(x, y, 4) + 0.26 * sample(x, y, 16) + 0.16 * sample(x, y, 64) + 0.08 * hash(x, y), i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(n * 255); data[i + 3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
  return map;
}
