// Map inset: the water body's NAIP aerial photograph (pipeline/aerial.py), which covers exactly
// the terrain grid, with a marker for the camera and the way it faces. Used by the explorer and
// the journey card; no external imports, styles included.

// Scene metres (x east, z south) to fractions of the image (0-1 across, 0-1 down).
export function mapPoint(meta, x, z) {
  const [x0, z0] = meta.gridOrigin,
    [sx, sy] = meta.cell;
  return [(x - x0 + sx / 2) / (meta.width * sx), (z - z0 + sy / 2) / (meta.height * sy)];
}

const STYLE = `
.minimap { margin: 0; }
.minimap-frame { position: relative; line-height: 0; border: 1px solid #ffffff33; border-radius: 3px; overflow: hidden; }
.minimap-frame img { width: 100%; height: auto; display: block; }
.minimap-camera { position: absolute; width: 34px; height: 34px; pointer-events: none; }
.minimap-camera::before { content: ""; position: absolute; left: 50%; bottom: 50%; width: 34px; height: 17px;
  transform: translateX(-50%); background: #fff6; clip-path: polygon(50% 100%, 12% 0, 88% 0); }
.minimap-camera::after { content: ""; position: absolute; left: 50%; top: 50%; width: 8px; height: 8px;
  transform: translate(-50%, -50%); border-radius: 50%; background: #ffd24a; box-shadow: 0 0 0 2px #0008; }
.minimap figcaption { margin-top: 4px; font-size: 10px; line-height: 1.3; opacity: .75; }
.minimap figcaption a { color: inherit; }
`;

// Adds the inset to `parent`, or returns null when the body has no aerial.json.
export async function createMinimap(parent, base, meta) {
  const response = await fetch(new URL("aerial.json", base)).catch(() => null);
  if (!response?.ok) return null;
  const info = await response.json();
  if (!document.getElementById("minimapStyle")) {
    const style = document.createElement("style");
    style.id = "minimapStyle";
    style.textContent = STYLE;
    document.head.append(style);
  }
  const figure = document.createElement("figure"),
    frame = document.createElement("div"),
    image = new Image(),
    marker = document.createElement("div"),
    caption = document.createElement("figcaption"),
    link = document.createElement("a");
  figure.className = "minimap";
  frame.className = "minimap-frame";
  marker.className = "minimap-camera";
  image.src = new URL(info.file, base).href;
  image.alt = "Aerial photograph of the area, with the camera marked";
  link.href = info.source;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "USGS NAIP orthoimagery";
  caption.append("Aerial: ", link, " (public domain)");
  frame.append(image, marker);
  figure.append(frame, caption);
  parent.append(figure);
  return {
    element: figure,
    // Camera at (x, z), facing yaw (0 north, clockwise, as camera.js).
    update(x, z, yaw) {
      const [u, v] = mapPoint(meta, x, z);
      marker.hidden = !(u >= 0 && u <= 1 && v >= 0 && v <= 1);
      marker.style.left = `${u * 100}%`;
      marker.style.top = `${v * 100}%`;
      marker.style.transform = `translate(-50%, -50%) rotate(${yaw}rad)`;
    },
    remove() {
      figure.remove();
    },
  };
}
