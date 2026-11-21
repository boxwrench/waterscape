// HetchyCraft front page effects (make_front.py copies this to <site>/front/front.js).
//
// - Voxel models drawn from each reservoir's columns (front/<id>.json, written by voxel_art.py
//   from its elevation data): they build up block by block when they scroll into view, turn in
//   quarter steps (drag sideways or the arrow buttons), lose a block when clicked (it grows back),
//   and their water shimmers.
// - Day, sunset and night skies; a bird, drifting leaves (fireflies at night) and a splash line.
//
// Kept light: each model is drawn twice (two water shades) and then only cross-faded by CSS;
// nothing redraws unless someone builds, turns or breaks. Animations pause off screen and stop
// entirely for visitors who ask for reduced motion. Without JavaScript the page shows the
// pictures (front/<id>.png).
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }

  function hash(a, b, s) {
    var v = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(s | 0, 83492791);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) & 0xffff) / 65535;
  }

  function rgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  var FACE = [0.78, 0.6, 1.0];               // left, right, top
  var JIT = [0.93, 0.98, 1.03, 1.07];         // block-to-block texture
  var WAVE = [0.97, 1.03, 1.09, 1.0];         // water top, per shimmer phase

  function Model(el, data) {
    this.el = el;
    this.d = data;
    this.k0 = data.k.slice();
    this.k = data.k.slice();
    this.kind0 = data.kind.split("");
    this.kind = data.kind.split("");
    this.trees0 = data.trees.split("").map(Number);
    this.trees = this.trees0.slice();
    this.species = data.species.split("").map(Number);
    this.rot = data.rotation || 0;
    this.colours = {};
    var p = data.pal, self = this;
    var mats = {
      grass: rgb(p.grass), dirt: rgb(p.dirt), stone: rgb(p.stone), rock: rgb(p.rock), dam: rgb(p.dam),
      water: rgb(p.water), bare: rgb(p.dirt).map(function (v) { return v * 1.08; })
    };
    mats.rock2 = mats.rock.map(function (v) { return v * 0.9; });
    mats.waterTop = mats.water.map(function (v) { return v * 1.15; });
    p.leaves.forEach(function (h, n) {
      mats["leaf" + n] = rgb(h);
      mats["leafTop" + n] = rgb(h).map(function (v) { return v * 1.08; });
    });
    this.mats = mats;

    el.classList.add("live-model");
    this.a = document.createElement("canvas");
    this.b = document.createElement("canvas");
    this.b.className = "shade";
    [this.a, this.b].forEach(function (c) {
      c.setAttribute("aria-hidden", "true");
      el.appendChild(c);
    });
    var turn = document.createElement("div");
    turn.className = "turn";
    turn.innerHTML = '<button type="button" aria-label="Turn left">&#8634;</button>' +
      '<button type="button" aria-label="Turn right">&#8635;</button>';
    el.appendChild(turn);
    turn.children[0].addEventListener("click", function () { self.turn(1); });
    turn.children[1].addEventListener("click", function () { self.turn(-1); });
    this.listen();
    this.layout();
  }

  Model.prototype.dims = function () {
    var R = this.d.nr, C = this.d.nc;
    return this.rot % 2 ? [C, R] : [R, C];
  };

  // Index into the stored (unturned) grid for row i, column j of the turned view.
  Model.prototype.at = function (i, j) {
    var nr = this.d.nr, nc = this.d.nc, r = this.rot;
    var oi = r === 0 ? i : r === 1 ? nr - 1 - j : r === 2 ? nr - 1 - i : j;
    var oj = r === 0 ? j : r === 1 ? i : r === 2 ? nc - 1 - j : nc - 1 - i;
    return oi * nc + oj;
  };

  Model.prototype.layout = function () {
    var d = this.d, rc = d.nr + d.nc;
    this.cssW = this.el.clientWidth || 600;
    this.W = Math.round(this.cssW * DPR);
    this.tw = this.W / (rc / 2 + 1);
    this.th = this.tw / 2;
    this.vh = this.tw * 0.58;
    this.H = Math.round(rc * this.th / 2 + (d.top - d.base + 1) * this.vh + this.th * 2);
    this.oy = (d.top + 1) * this.vh + this.th / 2;
    var self = this;
    [this.a, this.b].forEach(function (c) {
      c.width = self.W; c.height = self.H;
      c.style.width = self.cssW + "px";
      c.style.height = self.H / DPR + "px";
    });
    this.el.style.height = this.H / DPR + "px";
  };

  Model.prototype.colour = function (name, face, jit) {
    var key = name + face + "|" + jit;
    var c = this.colours[key];
    if (!c) {
      var f = FACE[face] * jit, m = this.mats[name];
      c = "rgb(" + Math.min(255, m[0] * f | 0) + "," + Math.min(255, m[1] * f | 0) + "," + Math.min(255, m[2] * f | 0) + ")";
      this.colours[key] = c;
    }
    return c;
  };

  Model.prototype.cube = function (ctx, cx, cy, side, top, left, right, jit, topJit) {
    var tw2 = this.tw / 2 + 0.6, th2 = this.th / 2 + 0.4, vh = this.vh + 0.6;
    if (left) {
      ctx.fillStyle = this.colour(side, 0, jit);
      ctx.beginPath(); ctx.moveTo(cx - tw2, cy); ctx.lineTo(cx, cy + th2); ctx.lineTo(cx, cy + th2 + vh);
      ctx.lineTo(cx - tw2, cy + vh); ctx.fill();
    }
    if (right) {
      ctx.fillStyle = this.colour(side, 1, jit);
      ctx.beginPath(); ctx.moveTo(cx, cy + th2); ctx.lineTo(cx + tw2, cy); ctx.lineTo(cx + tw2, cy + vh);
      ctx.lineTo(cx, cy + th2 + vh); ctx.fill();
    }
    if (top) {
      ctx.fillStyle = this.colour(top, 2, topJit);
      ctx.beginPath(); ctx.moveTo(cx, cy - th2); ctx.lineTo(cx + tw2, cy); ctx.lineTo(cx, cy + th2);
      ctx.lineTo(cx - tw2, cy); ctx.fill();
    }
  };

  // Paint back to front. level: draw only blocks up to this height (the build-up); phase: water shade.
  Model.prototype.paint = function (canvas, level, phase) {
    var ctx = canvas.getContext("2d"), d = this.d, base = d.base, nc = d.nc;
    var dm = this.dims(), R = dm[0], C = dm[1], tw = this.tw, th = this.th, vh = this.vh;
    var ox = R * tw / 2 + tw / 2, oy = this.oy, self = this, lim = level == null ? 1e9 : level;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    function height(i, j) {
      if (i >= R || j >= C) return base - 1;
      return Math.min(self.k[self.at(i, j)], lim);
    }
    for (var s = 0; s < R + C - 1; s++) {
      for (var i = Math.max(0, s - C + 1); i <= Math.min(R - 1, s); i++) {
        var j = s - i, o = this.at(i, j), h = Math.min(this.k[o], lim);
        if (h < base) continue;
        var fl = height(i + 1, j), fr = height(i, j + 1), kind = this.kind[o];
        var oi = (o / nc) | 0, oj = o % nc;
        var cx = ox + (j - i) * tw / 2, cy0 = oy + (i + j) * th / 2;
        var top = kind === "w" ? "waterTop" : kind === "r" ? "rock" : kind === "d" ? "dam" : kind === "b" ? "bare" : "grass";
        for (var y = Math.min(h, Math.max(base, Math.min(fl, fr))); y <= h; y++) {
          var depth = h - y, side;
          if (kind === "w") side = depth === 0 ? "water" : "stone";
          else if (kind === "d") side = "dam";
          else if (depth === 0) side = kind === "r" ? "rock" : "dirt";
          else if (depth < 3 && kind !== "r") side = "dirt";
          else side = kind === "r" ? "rock2" : "stone";
          var jit = JIT[(hash(oi * 131 + y, oj * 71 - y, 3) * 3.999) | 0];
          var topJit = kind === "w" ? WAVE[((hash(oi, oj, 21) * 3.999 | 0) + phase) % 4] * 0.96 : jit;
          this.cube(ctx, cx, cy0 - y * vh, side, y === h ? top : null, y > fl, y > fr, jit, topJit);
        }
        var t = this.trees[o];
        for (var n = 0; n < t && h + 1 + n <= lim; n++) {
          var sp = this.species[o] % this.d.pal.leaves.length;
          var lj = JIT[(hash(oi * 7 + n, oj * 13, 5) * 3.999) | 0];
          this.cube(ctx, cx, cy0 - (h + 1 + n) * vh, "leaf" + sp, "leafTop" + sp, true, true, lj, lj);
        }
      }
    }
  };

  Model.prototype.draw = function () {
    this.paint(this.a, null, 0);
    this.paint(this.b, null, 2);
    this.el.classList.add("drawn");
  };

  Model.prototype.build = function () {
    var self = this, d = this.d;
    if (reduce) { this.draw(); return; }
    var start = performance.now(), dur = 1500;
    this.b.style.visibility = "hidden";
    this.el.classList.add("drawn");
    function step(now) {
      var f = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - f, 2);
      self.paint(self.a, Math.floor(d.base + e * (d.top - d.base + 1)), 0);
      if (f < 1) requestAnimationFrame(step);
      else { self.b.style.visibility = ""; self.draw(); }
    }
    requestAnimationFrame(step);
  };

  Model.prototype.turn = function (by) {
    this.rot = (this.rot + by + 4) % 4;
    this.draw();
  };

  // The top block under a point (canvas pixels), searching front to back.
  Model.prototype.pick = function (px, py) {
    var dm = this.dims(), R = dm[0], C = dm[1], tw = this.tw, th = this.th, vh = this.vh;
    var ox = R * tw / 2 + tw / 2;
    for (var s = R + C - 2; s >= 0; s--) {
      for (var i = Math.min(R - 1, s); i >= Math.max(0, s - C + 1); i--) {
        var j = s - i, o = this.at(i, j), ht = this.k[o] + this.trees[o];
        var cx = ox + (j - i) * tw / 2, cy = this.oy + (i + j) * th / 2 - ht * vh;
        var dx = Math.abs(px - cx);
        if (dx > tw / 2) continue;
        var topEdge = cy - th / 2 + dx * th / tw, bottomEdge = cy + vh + th / 2 - dx * th / tw;
        if (py >= topEdge && py <= bottomEdge) return { o: o, x: cx, y: cy };
      }
    }
    return null;
  };

  Model.prototype.smash = function (px, py) {
    var hit = this.pick(px, py), self = this;
    if (!hit) return;
    var o = hit.o, colour;
    if (this.trees[o] > 0) {
      this.trees[o] -= 1;
      colour = this.colour("leaf" + (this.species[o] % this.d.pal.leaves.length), 2, 1);
    } else if (this.kind[o] === "w") {
      colour = this.colour("waterTop", 2, 1.05);
    } else if (this.k[o] > this.d.base + 1) {
      var was = this.kind[o];
      colour = this.colour(was === "g" ? "grass" : was === "r" ? "rock" : was === "d" ? "dam" : "bare", 2, 1);
      this.k[o] -= 1;
      if (was === "g") this.kind[o] = "b";
    } else {
      return;
    }
    this.draw();
    if (!reduce) burst(this, hit.x, hit.y, colour, this.kind[o] === "w" && this.trees[o] === 0);
    clearTimeout(this["regrow" + o]);
    this["regrow" + o] = setTimeout(function () {
      self.k[o] = self.k0[o]; self.trees[o] = self.trees0[o]; self.kind[o] = self.kind0[o];
      self.draw();
    }, 20000);
  };

  Model.prototype.listen = function () {
    var self = this, down = null;
    this.el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      down = { x: e.clientX, y: e.clientY, t: Date.now() };
    });
    this.el.addEventListener("pointerup", function (e) {
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) self.turn(dx < 0 ? 1 : -1);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        var r = self.a.getBoundingClientRect();
        self.smash((e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR);
      }
      down = null;
    });
  };

  // A small shower of square bits (or a splash), on a canvas that exists only while they fly.
  function burst(model, x, y, colour, splash) {
    var c = document.createElement("canvas");
    c.width = model.W; c.height = model.H;
    c.className = "bits";
    c.style.width = model.cssW + "px"; c.style.height = model.H / DPR + "px";
    model.el.appendChild(c);
    var ctx = c.getContext("2d"), bits = [], size = Math.max(2, model.tw / 4);
    for (var n = 0; n < 14; n++) {
      bits.push({ x: x + (Math.random() - 0.5) * model.tw * 0.6, y: y + (Math.random() - 0.3) * model.th,
        vx: (Math.random() - 0.5) * model.tw * 0.12, vy: -(0.5 + Math.random()) * model.tw * (splash ? 0.16 : 0.1) });
    }
    var start = performance.now();
    function step(now) {
      var t = now - start;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = colour;
      ctx.globalAlpha = Math.max(0, 1 - t / 700);
      bits.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.vy += model.tw * 0.012;
        ctx.fillRect(b.x, b.y, size, size);
      });
      if (t < 700) requestAnimationFrame(step); else c.remove();
    }
    requestAnimationFrame(step);
  }

  // Start each model when it first scrolls into view; let its water shimmer only while visible.
  var models = [];
  function start(el) {
    fetch(el.getAttribute("data-src")).then(function (r) { return r.json(); }).then(function (data) {
      var m = new Model(el, data);
      models.push(m);
      var built = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          el.classList.toggle("on-screen", en.isIntersecting);
          if (en.isIntersecting && !built) { built = true; m.build(); }
        });
      }, { threshold: 0.2 });
      io.observe(el);
    }, function () {});
  }
  if (window.fetch && window.IntersectionObserver && document.createElement("canvas").getContext) {
    Array.prototype.forEach.call(document.querySelectorAll(".model[data-src]"), start);
    var lastW = window.innerWidth, timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        models.forEach(function (m) { m.layout(); m.draw(); });
      }, 250);
    });
  }

  // Sky: day, sunset, night (remembered on this device).
  var TIMES = ["day", "sunset", "night"], LABEL = { day: "Sunset", sunset: "Night", night: "Day" };
  var button = document.querySelector(".time");
  function setTime(t) {
    document.documentElement.setAttribute("data-time", t);
    if (button) {
      button.setAttribute("aria-label", "Change the sky to " + LABEL[t].toLowerCase());
      button.querySelector("span").textContent = LABEL[t];
    }
  }
  // The page's head script already applied the remembered sky (or ?sky=); label the button to match.
  setTime(document.documentElement.getAttribute("data-time") || "day");
  if (button) {
    button.addEventListener("click", function () {
      var now = document.documentElement.getAttribute("data-time");
      var next = TIMES[(TIMES.indexOf(now) + 1) % TIMES.length];
      setTime(next);
      store("hc-time", next);
    });
  }

  // Stars, drawn once as box-shadows on one element.
  var stars = document.querySelector(".stars");
  if (stars) {
    var dots = [];
    for (var n = 0; n < 60; n++) {
      var sx = Math.round(hash(n, 1, 9) * 1600), sy = Math.round(hash(n, 2, 9) * 520);
      dots.push(sx + "px " + sy + "px 0 " + (hash(n, 3, 9) > 0.8 ? "1px" : "0") + " #fff");
    }
    stars.style.boxShadow = dots.join(",");
  }

  // Splash line: a different one each visit.
  var splash = document.querySelector(".splash");
  if (splash) {
    var lines = JSON.parse(splash.getAttribute("data-lines") || "[]");
    if (lines.length) splash.textContent = lines[Math.floor(Math.random() * lines.length)];
  }
})();
