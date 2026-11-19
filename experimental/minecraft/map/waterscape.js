// Waterscape panel for the BlueMap web map (loaded through webapp.conf "scripts"):
// a short description, a button into first-person (BlueMap's free-flight view) with how-to,
// and the credits line (OpenStreetMap's licence, ODbL, asks for visible attribution).
// Facts come from data/hetch_hetchy/story.json, with the sources listed there.
(function () {
  var FIRST_PERSON = "#hetch_hetchy:580:92:1350:0:1.57:1.45:0:0:free";  // dam crest, looking up the reservoir
  var OVERVIEW = "#hetch_hetchy:1296:0:1000:1700:0:0.7:0:0:perspective";
  var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  var css = document.createElement("style");
  css.textContent = [
    // Leaves room on the right for BlueMap's zoom buttons on narrow screens.
    "#ws-panel{position:fixed;left:8px;bottom:8px;width:min(380px,calc(100vw - 76px));box-sizing:border-box;",
    "padding:12px 14px;border-radius:6px;background:rgba(20,24,28,.84);color:#ececec;",
    "font:13px/1.45 sans-serif;z-index:1000}",
    "#ws-panel .ws-title{display:block;font:600 16px/1.3 sans-serif;margin:0 28px 6px 0;padding:0;border:0;text-align:left;color:#fff}",
    "#ws-panel p{margin:0 0 8px}",
    "#ws-panel a{color:#9cd0ff}",
    "#ws-panel .ws-facts{color:#c8c8c8}",
    "#ws-panel .ws-go{display:block;width:100%;margin:4px 0 6px;padding:9px 10px;border:0;border-radius:5px;",
    "background:#2e86c1;color:#fff;font:600 14px sans-serif;cursor:pointer}",
    "#ws-panel .ws-go:hover{background:#3a97d6}",
    "#ws-panel .ws-how{color:#d6d6d6;font-size:12px}",
    "#ws-panel .ws-credits{color:#a9a9a9;font-size:11px;margin:0}",
    "#ws-panel .ws-hide{position:absolute;top:6px;right:8px;border:0;background:none;color:#ccc;",
    "font:18px sans-serif;cursor:pointer;padding:2px 6px;z-index:1}",
    "#ws-panel .ws-osm{display:none;color:#a9a9a9;font-size:11px;margin:0}",
    // Minimised: title, the first-person button and the OpenStreetMap credit stay visible.
    "#ws-panel.ws-min{padding:8px 10px}",
    "#ws-panel.ws-min .ws-body,#ws-panel.ws-min .ws-how,#ws-panel.ws-min .ws-credits{display:none}",
    "#ws-panel.ws-min .ws-osm{display:block}",
    "#ws-panel.ws-min .ws-title{font-size:14px;margin-bottom:4px}"
  ].join("");
  document.head.appendChild(css);

  var panel = document.createElement("div");
  panel.id = "ws-panel";
  panel.innerHTML =
    "<button class=\"ws-hide\" title=\"Hide or show\" aria-label=\"Hide or show\">&minus;</button>" +
    "<div class=\"ws-title\" role=\"heading\" aria-level=\"1\">Hetch Hetchy Reservoir</div>" +
    "<div class=\"ws-body\">" +
    "<p>O'Shaughnessy Dam holds the Tuolumne River in Yosemite's Hetch Hetchy Valley, where the Bay " +
    "Area's water begins. This is the valley rebuilt in Minecraft from public elevation and map data.</p>" +
    "<p class=\"ws-facts\">Dam: 312 ft tall, completed 1923. Listed capacity: 360,000 acre-feet " +
    "(<a href=\"https://github.com/boxwrench/waterscape/blob/main/data/hetch_hetchy/story.json\" target=\"_blank\" rel=\"noopener\">sources</a>).</p>" +
    "</div>" +
    "<button class=\"ws-go\"></button>" +
    "<p class=\"ws-how\"></p>" +
    "<p class=\"ws-credits\">Built by <a href=\"https://github.com/boxwrench/waterscape\" target=\"_blank\" rel=\"noopener\">Waterscape</a>. " +
    "Elevation: USGS 3DEP. Roads and buildings: &copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a> " +
    "contributors (ODbL). Lake bed, trees, boat ramp and dock are illustrative. " +
    "Viewer: <a href=\"https://bluemap.bluecolored.de/\" target=\"_blank\" rel=\"noopener\">BlueMap</a>. " +
    "Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.</p>" +
    "<p class=\"ws-osm\">&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a> contributors</p>";
  document.body.appendChild(panel);

  var go = panel.querySelector(".ws-go"), how = panel.querySelector(".ws-how");
  var HOW_OVERVIEW = touch
    ? "Or drag to look around the valley; pinch to zoom."
    : "Or drag to look around the valley; scroll to zoom.";
  var HOW_FREE = touch
    ? "Drag to look. Use the on-screen arrows to move forward and to climb or drop."
    : "Click once to steer with the mouse (Esc to stop). W A S D to move, Space and Shift to go up and down, mouse wheel to change speed.";

  function mode() {
    try { return window.bluemap.appState.controls.state; } catch (e) { return ""; }
  }
  function refresh() {
    var free = mode() === "free";
    go.textContent = free ? "Back to the overview" : "Walk around in first person";
    how.textContent = free ? HOW_FREE : HOW_OVERVIEW;
  }
  go.addEventListener("click", function () {
    // The address positions the first-person camera; going back uses BlueMap's own switch,
    // because in free flight BlueMap keeps rewriting the address with the camera position.
    if (mode() === "free") {
      try { window.bluemap.setPerspectiveView(800, 400); } catch (e) { location.hash = OVERVIEW; }
    } else {
      location.hash = FIRST_PERSON;
    }
    setTimeout(refresh, 300);
  });
  panel.querySelector(".ws-hide").addEventListener("click", function () {
    var min = panel.classList.toggle("ws-min");
    this.innerHTML = min ? "+" : "&minus;";
  });
  if (window.innerWidth < 600) { panel.classList.add("ws-min"); panel.querySelector(".ws-hide").innerHTML = "+"; }
  refresh();
  setInterval(refresh, 500);
  // A plain link opens on the angled overview of the whole valley rather than BlueMap's flat start.
  // BlueMap has already written its default address (straight down from 1500 blocks) by now,
  // so check the address the page was opened with.
  var opened = "";
  try { opened = performance.getEntriesByType("navigation")[0].name; } catch (e) { opened = ""; }
  var openedHash = opened.indexOf("#") >= 0 ? opened.slice(opened.indexOf("#")) : "";
  if (openedHash.length < 2) {
    location.hash = OVERVIEW;
  }
})();
