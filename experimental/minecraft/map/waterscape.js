// Waterscape panel for a BlueMap web map (loaded through webapp.conf "scripts"):
// a short description, a button into first-person (BlueMap's free-flight view) with how-to,
// and the credits line (OpenStreetMap's licence, ODbL, asks for visible attribution).
// The text and viewpoints come from waterscape-site.json, which make_site.py writes from the
// reservoir's data/<id>/story.json (where every fact's source is recorded) and sites/<id>.json.
(function () {
  // BlueMap rewrites the address with its default view before this runs, so remember how the
  // page was opened: a plain link should land on the angled overview.
  var opened = "";
  try { opened = performance.getEntriesByType("navigation")[0].name; } catch (e) { opened = ""; }
  var plainLink = opened.indexOf("#") < 0 || opened.slice(opened.indexOf("#")).length < 2;
  var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function link(href, text) {
    var a = el("a", "", text);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  var css = el("style");
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

  fetch("waterscape-site.json").then(function (r) { return r.json(); }).then(build, function () {});

  function build(site) {
    var FIRST_PERSON = "#" + site.id + ":" + site.first_person;
    var OVERVIEW = "#" + site.id + ":" + site.overview;

    var panel = el("div"); panel.id = "ws-panel";
    var hide = el("button", "ws-hide"); hide.title = "Hide or show"; hide.setAttribute("aria-label", "Hide or show");
    hide.innerHTML = "&minus;";
    var title = el("div", "ws-title", site.name); title.setAttribute("role", "heading"); title.setAttribute("aria-level", "1");
    var body = el("div", "ws-body");
    body.appendChild(el("p", "", site.headline + " Here it is rebuilt in Minecraft from public elevation and map data."));
    var facts = el("p", "ws-facts", site.facts.join(". ") + ". (");
    facts.appendChild(link(site.sources, "sources")); facts.appendChild(document.createTextNode(")"));
    body.appendChild(facts);
    var go = el("button", "ws-go"), how = el("p", "ws-how");
    var credits = el("p", "ws-credits", "Built by ");
    credits.appendChild(link("https://github.com/boxwrench/waterscape", "Waterscape"));
    credits.appendChild(document.createTextNode(". Elevation: USGS 3DEP. Roads and buildings: © "));
    credits.appendChild(link("https://www.openstreetmap.org/copyright", "OpenStreetMap"));
    credits.appendChild(document.createTextNode(" contributors (ODbL). " + (site.illustrative ? site.illustrative + " " : "") + "Viewer: "));
    credits.appendChild(link("https://bluemap.bluecolored.de/", "BlueMap"));
    credits.appendChild(document.createTextNode(". Not an official Minecraft product; not approved by or associated with Mojang or Microsoft."));
    var osm = el("p", "ws-osm", "© ");
    osm.appendChild(link("https://www.openstreetmap.org/copyright", "OpenStreetMap")); osm.appendChild(document.createTextNode(" contributors"));
    [hide, title, body, go, how, credits, osm].forEach(function (c) { panel.appendChild(c); });
    document.body.appendChild(panel);

    var HOW_OVERVIEW = touch ? "Or drag to look around; pinch to zoom." : "Or drag to look around; scroll to zoom.";
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
    hide.addEventListener("click", function () {
      var min = panel.classList.toggle("ws-min");
      hide.innerHTML = min ? "+" : "&minus;";
    });
    if (window.innerWidth < 600) { panel.classList.add("ws-min"); hide.innerHTML = "+"; }
    refresh();
    setInterval(refresh, 500);
    if (plainLink) location.hash = OVERVIEW;
  }
})();
