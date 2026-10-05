const ORDER = ["russian_river", "sacramento_river", "san_joaquin_river", "eel_river", "tuolumne_river", "american_river"];

export function overviewRiverOrder(entries) {
  const rank = id => ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length;
  return [...entries].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

export function riverDestination(river) {
  // Every river has a home; its home lists the scenes and their viewpoints.
  return `./river.html?river=${encodeURIComponent(river.id)}`;
}
