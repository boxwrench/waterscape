const ORDER = ["russian_river", "sacramento_river", "san_joaquin_river", "eel_river", "tuolumne_river", "american_river"];

export function overviewRiverOrder(entries) {
  const rank = id => ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length;
  return [...entries].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

export function riverDestination(river) {
  // Available Russian River opens its existing immersive scene. Other rivers open their own details.
  if (river.id === "russian_river" && river.status === "available") return "./renderer/hacienda.html";
  return `./river.html?river=${encodeURIComponent(river.id)}`;
}
