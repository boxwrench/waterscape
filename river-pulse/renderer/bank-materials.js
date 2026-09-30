import * as THREE from "../../vendor/three/three.webgpu.js";

export const SETTING_BASE = new URL("../data/russian_river/places/hacienda_bridge/setting/", import.meta.url);

export async function loadBankMaterials() {
  const response = await fetch(new URL("materials.json", SETTING_BASE));
  if (!response.ok) throw new Error(`Bank material manifest: ${response.status}`);
  const manifest = await response.json(), loader = new THREE.TextureLoader(), materials = {};
  await Promise.all(manifest.materials.map(async (definition) => {
    const maps = {};
    await Promise.all(Object.entries(definition.maps).map(async ([kind, map]) => {
      const value = await loader.loadAsync(new URL(map.file, SETTING_BASE).href);
      value.wrapS = value.wrapT = THREE.RepeatWrapping;
      value.anisotropy = 4;
      if (kind === "color") value.colorSpace = THREE.SRGBColorSpace;
      maps[kind] = value;
    }));
    materials[definition.id] = { ...maps, tileMetres: definition.tileMetres };
  }));
  return materials;
}
