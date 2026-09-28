// Waterscape journey: one stop per reservoir bundle in data/<id>/. Every stop works from
// its poster and flyover video alone; the journey never waits on 3D.
import { liveCapable } from "./device.js";
import { poseAt } from "./flyover-path.js";
const $ = (id) => document.getElementById(id);
const state = { stops: [], index: 0, live: null };
window.waterscapeJourney = state;
const dataUrl = (id, file) => `./data/${id}/${file}`;

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function loadJourney() {
  try {
    const tourId = new URLSearchParams(location.search).get("tour") || "hetch-hetchy";
    if (!/^[a-z0-9-]+$/.test(tourId)) throw new Error(`Invalid tour: ${tourId}`);
    const journey = await json(`./data/tours/${tourId}.json`);
    state.stops = await Promise.all(
      journey.stops.map(async (stop) => {
        const [story, cameras] = await Promise.all([
          json(dataUrl(stop.id, "story.json")).catch(() => null),
          json(dataUrl(stop.id, "cameras.json")).catch(() => null),
        ]);
        return { ...stop, story, cameras };
      }),
    );
  } catch (e) {
    console.error(e);
    $("headline").textContent = "The journey could not be loaded.";
  }
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


function enterLive() {
  const stop = state.stops[state.index],
    video = $("flyover");
  if (!stop.cameras?.flyover) return;
  // Live 3D opens at the shoreline (the explorer's default) when the bundle has one, else where
  // the video is.
  const shore = stop.cameras.viewpoints?.shore,
    pose = shore ?? poseAt(stop.cameras.flyover, video.currentTime || 0),
    frame = document.createElement("iframe");
  frame.id = "liveFrame";
  frame.title = `${stop.story?.name ?? stop.id}, live 3D`;
  const forcedQuality = new URLSearchParams(location.search).get("quality");
  frame.src =
    `./renderer/explore.html?reservoir=${encodeURIComponent(stop.id)}&embed=1` +
    (shore ? "" : "&pose=" + [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => v.toFixed(3)).join(",")) +
    (forcedQuality ? `&quality=${encodeURIComponent(forcedQuality)}` : "") +
    `&preset=${encodeURIComponent($("livePreset").value)}`;
  state.live = { id: stop.id, pose, frameTimes: [], firstFrame: false };
  $("stage").append(frame);
  video.pause();
  $("explore").textContent = "Back to video";
  $("slowNotice").hidden = true;
  $("livePreset").hidden = false;
}

function leaveLive() {
  if (!state.live) return;
  $("liveFrame")?.remove(); // frees the GPU work
  state.live = null;
  $("stage").classList.remove("live");
  $("slowNotice").hidden = true;
  $("livePreset").hidden = true;
  $("explore").textContent = "Explore in 3D";
  $("flyover").play().catch(() => {});
}

addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.source !== $("liveFrame")?.contentWindow || !state.live)
    return;
  if (e.data?.type === "waterscape:failed") {
    leaveLive();
    return;
  }
  if (e.data?.type !== "waterscape:frame") return;
  if (!state.live.firstFrame) {
    state.live.firstFrame = true;
    $("stage").classList.add("live");
  }
  state.live.frameTimes.push(e.data.ms);
  // The renderer already adapts its quality; it says "struggling" only when its cheapest
  // level is still too slow.
  if (e.data.struggling === true) $("slowNotice").hidden = false;
});

function show(i) {
  i = Math.max(0, Math.min(state.stops.length - 1, i));
  if (i === state.index && !state.live && $("flyover").src) return;
  leaveLive();
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
$("explore").onclick = () => (state.live ? leaveLive() : enterLive());
$("slowBack").onclick = leaveLive;
$("livePreset").value = new URLSearchParams(location.search).get("preset") || "golden";
$("livePreset").onchange = () =>
  $("liveFrame")?.contentWindow.postMessage(
    { type: "waterscape:preset", name: $("livePreset").value },
    location.origin,
  );
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
liveCapable().then((ok) => ($("explore").hidden = !ok));
