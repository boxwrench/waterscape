// Waterscape journey: one stop per reservoir bundle in data/<id>/. Every stop works from
// its poster and flyover video alone; the journey never waits on 3D.
const $ = (id) => document.getElementById(id);
const state = { stops: [], index: 0 };
window.waterscapeJourney = state;
const dataUrl = (id, file) => `./data/${id}/${file}`;

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function loadJourney() {
  const journey = await json("./journey.json");
  state.stops = await Promise.all(
    journey.stops.map(async (stop) => {
      const [story, cameras] = await Promise.all([
        json(dataUrl(stop.id, "story.json")).catch(() => null),
        json(dataUrl(stop.id, "cameras.json")).catch(() => null),
      ]);
      return { ...stop, story, cameras };
    }),
  );
}

function renderMap() {
  $("systemMap")
    .querySelector("ol")
    .replaceChildren(
      ...state.stops.map((stop, i) => {
        const li = document.createElement("li"),
          b = document.createElement("button");
        b.textContent = stop.story?.name ?? stop.id;
        b.onclick = () => show(i);
        li.append(b);
        return li;
      }),
    );
}

function renderCard(stop, i) {
  $("stopIndex").textContent = `Stop ${i + 1} of ${state.stops.length} · ${stop.caption}`;
  $("stopName").textContent = stop.story?.name ?? stop.id;
  $("operator").textContent = stop.story?.operator ?? "";
  $("headline").textContent =
    stop.story?.headline ?? "Details for this stop are unavailable right now.";
  $("facts").replaceChildren(
    ...(stop.story?.facts ?? []).flatMap((fact) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd"),
        a = document.createElement("a");
      dt.textContent = fact.label;
      a.textContent = fact.value;
      a.href = fact.source;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Source";
      dd.append(a);
      return [dt, dd];
    }),
  );
}

function showMedia(stop) {
  const video = $("flyover");
  $("stage").classList.remove("playing", "video-failed");
  $("poster").src = dataUrl(stop.id, "poster.jpg");
  $("poster").alt = `${stop.story?.name ?? stop.id} from the air`;
  video.src = dataUrl(stop.id, "flyover.mp4");
  video.play().catch(() => {}); // autoplay can be refused; the poster stays up
}

function prefetch(i) {
  document.querySelectorAll("link[data-prefetch]").forEach((l) => l.remove());
  const next = state.stops[i + 1];
  if (!next) return;
  for (const file of ["poster.jpg", "flyover.mp4"]) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = dataUrl(next.id, file);
    link.dataset.prefetch = "";
    document.head.append(link);
  }
}

function show(i) {
  i = Math.max(0, Math.min(state.stops.length - 1, i));
  state.index = i;
  const stop = state.stops[i];
  renderCard(stop, i);
  showMedia(stop);
  prefetch(i);
  $("prev").disabled = i === 0;
  $("next").disabled = i === state.stops.length - 1;
  $("systemMap")
    .querySelectorAll("li")
    .forEach((li, j) => li.classList.toggle("active", j === i));
  history.replaceState(null, "", `${location.search}#stop=${stop.id}`);
}

$("flyover").addEventListener("playing", () => $("stage").classList.add("playing"));
$("flyover").addEventListener("error", () => $("stage").classList.add("video-failed"));
$("prev").onclick = () => show(state.index - 1);
$("next").onclick = () => show(state.index + 1);
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "PageDown") show(state.index + 1);
  if (e.key === "ArrowLeft" || e.key === "PageUp") show(state.index - 1);
});
let wheelLock = 0;
addEventListener(
  "wheel",
  (e) => {
    if (Math.abs(e.deltaY) < 30 || performance.now() < wheelLock) return;
    wheelLock = performance.now() + 900;
    show(state.index + Math.sign(e.deltaY));
  },
  { passive: true },
);

function showFromHash() {
  const wanted = new URLSearchParams(location.hash.slice(1)).get("stop");
  const i = state.stops.findIndex((s) => s.id === wanted);
  show(i >= 0 ? i : 0);
}
addEventListener("hashchange", showFromHash);

await loadJourney();
renderMap();
showFromHash();
