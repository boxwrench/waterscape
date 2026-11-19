// Credits line for the BlueMap web map (loaded through webapp.conf "scripts").
// OpenStreetMap's licence (ODbL) asks for visible attribution wherever the roads and buildings show.
(function () {
  var box = document.createElement("div");
  box.id = "waterscape-credits";
  box.innerHTML =
    "Hetch Hetchy in Minecraft, built by " +
    "<a href=\"https://github.com/boxwrench/waterscape\" target=\"_blank\" rel=\"noopener\">Waterscape</a>. " +
    "Elevation: USGS 3DEP. Roads and buildings: &copy; " +
    "<a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a> contributors (ODbL). " +
    "Lake bed, trees, boat ramp and dock are illustrative. " +
    "Map viewer: <a href=\"https://bluemap.bluecolored.de/\" target=\"_blank\" rel=\"noopener\">BlueMap</a>. " +
    "Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.";
  var css = document.createElement("style");
  css.textContent =
    "#waterscape-credits{position:fixed;left:8px;bottom:8px;max-width:min(640px,calc(100vw - 72px));" +
    "padding:4px 8px;border-radius:4px;background:rgba(20,24,28,.72);color:#e8e8e8;" +
    "font:12px/1.4 sans-serif;z-index:1000;pointer-events:auto}" +
    "#waterscape-credits a{color:#9cd0ff}";
  document.head.appendChild(css);
  document.body.appendChild(box);
})();
