# Tuolumne eye camera composition

The native source terrain, source aerial, mapped linework, and other camera positions remain unchanged. This is a review-camera composition update only; neither camera point represents a surveyed access point.

The v3 eye view used camera `[540, 1010]` with 1.8 m ground clearance and target `[680, 1100]` with 1.8 m target clearance. It looked across the broad valley floor, where the river was distant and hidden by intervening dry terrain.

The v4 eye view uses camera `[693.04, 1045.08]` with 1.8 m ground clearance and target `[671.73, 1079.33]` with 0.32 m target clearance; FOV remains 58 degrees. The target is within 0.002 m of a vertex on mapped layout part 26's source segment 4. The camera is 36.08 m from the nearest mapped centerline point, outside the 20 m illustrative water half-width plus the 14.66 m one-cell contact transition. The scene therefore frames the river from a nearby dry DEM bank without placing the camera inside the modeled channel.

Using the bundled DEM and the same triangle interpolation as the rendered terrain, the camera site's ground is 1012.057 m. The runtime's bilinear camera-ground sampler returns 1012.047 m, so its 1.8 m clearance places the eye at 1013.847 m, about 1.79 m above the rendered facet. At the target, triangle ground is 1010.423 m and the illustrative water surface is 1010.773 m; the 0.32 m target clearance resolves to 1010.774 m under the runtime sampler. A 1 m-step sightline check from camera to target found no terrain samples above the ray. These values describe the authored composition and modeled water only; they do not establish present river stage, bank access, or hydraulic conditions.

Sources and method: [mapped 3DHP layout](../data/layout.json) defines the geographic line in local EPSG:32611 coordinates; [terrain metadata](../data/terrain.json) identifies the 14.66 m 3DEP grid and NAVD88 elevations; `renderer/terrain-mesh.js` defines the rendered cell diagonal used by the LOS check. The original v3 and current v4 settings are recorded in [review-cameras.json](../data/review-cameras.json).
