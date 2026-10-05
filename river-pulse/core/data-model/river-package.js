// Load a river and its scenes from the rivers/<river>/ package. Scenes are listed in river.json
// by slot and id; each scene's details live in rivers/<river>/scenes/<slot>/<id>/scene.json.
export const SLOT_ORDER = ["start", "middle", "end", "extra"];
export const SLOT_LABELS = { start: "Start", middle: "Middle", end: "End", extra: "Extra" };

export async function loadRiver(riverUrl, fetchJson) {
  const url = new URL(riverUrl, typeof location !== "undefined" ? location.href : undefined),
    river = await fetchJson(url),
    scenes = await Promise.all(river.scenes.map(async ({ slot, id }) => {
      const sceneUrl = new URL(`scenes/${slot}/${id}/scene.json`, url), scene = await fetchJson(sceneUrl);
      return { ...scene, url: sceneUrl,
        entryUrl: scene.entry ? new URL(scene.entry, sceneUrl) : null,
        thumbUrl: scene.thumb ? new URL(scene.thumb, sceneUrl) : null };
    }));
  scenes.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return { ...river, url, scenes };
}
