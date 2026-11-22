// Automatic quality for the live renderer. A level is a shader tier (0 low, 1 medium,
// 2 high — see render_water in water.cu) at a render width in pixels, cheapest first.
export const LEVELS = [
  { tier: 0, width: 768 },
  { tier: 0, width: 1152 },
  { tier: 1, width: 1152 },
  { tier: 2, width: 1152 },
];
export const TIER_NAMES = ["low", "medium", "high"];

const BUDGET_MS = 33, // over this (median) we step down
  FAST_MS = 16, // under this for UP_WINDOW_MS we may step up once
  STRUGGLE_MS = 60, // over this at the cheapest level the device is struggling
  SETTLE_MS = 1000, // ignore frames right after start or a change (shader warm-up, resize)
  DOWN_WINDOW_MS = 2000,
  UP_WINDOW_MS = 4000;

// Browsers do not say whether a GPU is discrete: NVIDIA starts at high, everything else at medium.
export function startingLevel(vendor) {
  return vendor === "nvidia" ? 3 : 2;
}

export function forcedTier(param) {
  const i = TIER_NAMES.indexOf(param);
  return i < 0 ? null : i;
}

export function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

// The explorer's Quality choices: shader tier and render width ("full": the window's own
// resolution in device pixels, up to 4K wide). It opens at full; the visitor may pick less.
export const CHOICES = {
  full: { tier: 2, width: null },
  1536: { tier: 2, width: 1536 },
  1152: { tier: 1, width: 1152 },
  768: { tier: 0, width: 768 },
};
export function choiceWidth(value, cssWidth, pixelRatio) {
  return CHOICES[value]?.width ?? Math.min(3840, Math.round(cssWidth * pixelRatio));
}

// Without automatic quality, watch for frames slow enough to suggest a lower choice: median
// over STRUGGLE_MS for DOWN_WINDOW_MS, after SETTLE_MS from the start or the last reset.
export class SlowWatch {
  constructor() {
    this.reset();
  }

  reset() {
    this.samples = [];
    this.since = null;
    this.struggling = false;
  }

  sample(ms, now) {
    if (this.since === null) this.since = now;
    if (now - this.since < SETTLE_MS) return this.struggling;
    this.samples.push({ ms, now });
    this.samples = this.samples.filter((s) => now - s.now <= DOWN_WINDOW_MS);
    if (now - this.samples[0].now >= DOWN_WINDOW_MS - 1)
      this.struggling = medianOf(this.samples.map((s) => s.ms)) > STRUGGLE_MS;
    return this.struggling;
  }
}

export class QualityGovernor {
  constructor(level) {
    this.level = level;
    this.struggling = false;
    this.steppedUp = false;
    this.samples = [];
    this.since = null;
  }

  get current() {
    return LEVELS[this.level];
  }

  // Feed one frame time (ms) at time `now` (ms); returns the new level when it changes.
  sample(ms, now) {
    if (this.since === null) this.since = now;
    if (now - this.since < SETTLE_MS) return null;
    this.samples.push({ ms, now });
    this.samples = this.samples.filter((s) => now - s.now <= UP_WINDOW_MS);
    const span = now - this.samples[0].now,
      median = medianOf(this.samples.map((s) => s.ms));
    this.struggling = this.level === 0 && span >= DOWN_WINDOW_MS && median > STRUGGLE_MS;
    if (span >= DOWN_WINDOW_MS && median > BUDGET_MS && this.level > 0) return this.#move(-1, now);
    if (span >= UP_WINDOW_MS - 1 && median < FAST_MS && !this.steppedUp && this.level < LEVELS.length - 1) {
      this.steppedUp = true;
      return this.#move(1, now);
    }
    return null;
  }

  #move(step, now) {
    this.level += step;
    this.samples = [];
    this.since = now;
    this.struggling = false;
    return this.current;
  }
}
