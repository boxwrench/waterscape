// SPDX-License-Identifier: MIT
// Clearwater CUDA reimplementation. Original optical design: Lumaris (2026).
// All spectrum generation, FFT, ripples, ray projection, optics and post are CUDA.
// The browser host only supplies inputs, resources and dispatches.
__device__ float sat(float x) { return fminf(1.0f, fmaxf(0.0f, x)); }
__device__ float frac(float x) { return x - floorf(x); }
__device__ float lerp(float a, float b, float t) { return a + (b - a) * t; }
__device__ float smooth(float a, float b, float x) {
  float t = sat((x - a) / (b - a));
  return t * t * (3.0f - 2.0f * t);
}
__device__ float3 v3(float x, float y, float z) { return make_float3(x, y, z); }
__device__ float3 add(float3 a, float3 b) { return v3(a.x + b.x, a.y + b.y, a.z + b.z); }
__device__ float3 sub(float3 a, float3 b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
__device__ float3 mul(float3 a, float b) { return v3(a.x * b, a.y * b, a.z * b); }
__device__ float3 prod(float3 a, float3 b) { return v3(a.x * b.x, a.y * b.y, a.z * b.z); }
__device__ float dot3(float3 a, float3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
__device__ float3 norm(float3 a) { return mul(a, rsqrtf(fmaxf(dot3(a, a), 0.00000001f))); }
__device__ float3 mix3(float3 a, float3 b, float t) { return add(mul(a, 1 - t), mul(b, t)); }
__device__ float3 exp3(float3 a) { return v3(expf(a.x), expf(a.y), expf(a.z)); }
__device__ float3 refract3(float3 d, float3 n, float eta) {
  float c = dot3(n, d);
  return sub(mul(d, eta), mul(n, eta * c + sqrtf(fmaxf(0, 1 - eta * eta * (1 - c * c)))));
}
__device__ float4 mix4(float4 a, float4 b, float t) {
  return make_float4(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t), lerp(a.w, b.w, t));
}
__device__ unsigned hashU(unsigned x) {
  x ^= x >> 16;
  x *= 2146121005u;
  x ^= x >> 15;
  x *= 2221713035u;
  x ^= x >> 16;
  return x;
}
__device__ float random(unsigned x) { return ((float)(hashU(x) & 16777215u) + 1.0f) / 16777217.0f; }
__device__ float hash(float x, float z) {
  return random((unsigned)((int)x * 1973 + (int)z * 9277 + 89173));
}
__device__ float noise(float x, float z) {
  float ix = floorf(x), iz = floorf(z), u = frac(x), w = frac(z);
  u = u * u * (3 - 2 * u);
  w = w * w * (3 - 2 * w);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u),
              lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), w);
}
__device__ float fbm(float x, float z) {
  return .55f * noise(x, z) + .28f * noise(x * 2.03f + 17.1f, z * 2.03f + 17.1f) +
         .12f * noise(x * 4.12f, z * 4.12f) + .05f * noise(x * 8.36f, z * 8.36f);
}
// One sun for sky, terrain, water and caustics. Late afternoon from the west-southwest
// (+z is south): the overlook, looking north, gets raking side light that reveals the
// ridges and drainages, and the sun stays where it can be at 37 degrees north.
__device__ float3 sunDir() { return v3(-.860f, .450f, .240f); }
__device__ int wrap(int x, int n) { return (x % n + n) % n; }
__device__ float lengthL(int c) { return c == 0 ? 4.6f : (c == 1 ? 37.0f : 293.0f); }
__device__ float4 sample4(const float4 *data, float x, float z, int n, int offset) {
  int ix = (int)floorf(x), iz = (int)floorf(z);
  float fx = frac(x), fz = frac(z);
  return mix4(mix4(data[offset + wrap(iz, n) * n + wrap(ix, n)],
                   data[offset + wrap(iz, n) * n + wrap(ix + 1, n)], fx),
              mix4(data[offset + wrap(iz + 1, n) * n + wrap(ix, n)],
                   data[offset + wrap(iz + 1, n) * n + wrap(ix + 1, n)], fx),
              fz);
}
// Three independent narrow-band spectra: capillary detail, wind waves and swell.
// A GPU reduction normalizes each cascade by expected RMS slope (as upstream).
__global__ void seed_spectrum(float2 *seed, unsigned seedValue) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || z >= 256)
    return;
  int id = c * 65536 + z * 256 + x;
  float L = lengthL(c), kx = 6.283185307f * (float)(x < 128 ? x : x - 256) / L,
        kz = 6.283185307f * (float)(z < 128 ? z : z - 256) / L, k = sqrtf(kx * kx + kz * kz);
  float P = 0;
  if (k > 0.00001f) {
    float peak = c == 0 ? .62f : (c == 1 ? 7.0f : 65.0f), kp = 6.283185307f / peak,
          lk = logf(k / kp), bump = expf(-.5f * lk * lk / (.36f * .36f));
    float tail = .035f * expf(-kp * kp / (k * k)) * expf(-k * k / (kp * kp * 180));
    float swell = .35f * expf(-.5f * powf(logf(k / (kp * .3875f)) / .3f, 2));
    float dir = (kx * .8f + kz * .6f) / k;
    P = (bump + tail + swell) * (.3f + .7f * dir * dir) * (dir < 0 ? .35f : 1.0f) / (k * k * k * k);
  }
  unsigned h = (unsigned)id + seedValue * 19391u;
  float radius = sqrtf(-2 * logf(random(h * 2u + 1u))), angle = 6.283185307f * random(h * 2u + 2u),
        amp = sqrtf(P * .5f);
  seed[id] = make_float2(radius * cosf(angle) * amp, radius * sinf(angle) * amp);
}
__global__ void spectrum_rows(const float2 *seed, float *rows) {
  int z = (int)(blockIdx.x * blockDim.x + threadIdx.x);
  if (z >= 768)
    return;
  int c = z / 256, zz = z % 256;
  float L = lengthL(c), sum = 0;
  for (int x = 0; x < 256; x++) {
    float kx = 6.283185307f * (float)(x < 128 ? x : x - 256) / L,
          kz = 6.283185307f * (float)(zz < 128 ? zz : zz - 256) / L;
    float2 h = seed[z * 256 + x];
    sum += 2 * (kx * kx + kz * kz) * (h.x * h.x + h.y * h.y);
  }
  rows[z] = sum;
}
__global__ void spectrum_norm(const float *rows, float *scales) {
  int c = (int)(blockIdx.x * blockDim.x + threadIdx.x);
  if (c >= 3)
    return;
  float sum = 0;
  for (int j = 0; j < 256; j++)
    sum += rows[c * 256 + j];
  scales[c] = (c == 0 ? .078f : (c == 1 ? .047f : .021f)) / sqrtf(fmaxf(sum, .0000000001f));
}
__global__ void evolve_spectrum(const float2 *seed, const float *scales, float4 *output, float time,
                                float sea, float depth) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || z >= 256)
    return;
  int id = c * 65536 + z * 256 + x, j = c * 65536 + wrap(-z, 256) * 256 + wrap(-x, 256);
  float2 a = seed[id], b = seed[j];
  float L = lengthL(c), kx = 6.283185307f * (float)(x < 128 ? x : x - 256) / L,
        kz = 6.283185307f * (float)(z < 128 ? z : z - 256) / L, k = sqrtf(kx * kx + kz * kz);
  float kd = fminf(20, k * depth), th = (1 - expf(-2 * kd)) / (1 + expf(-2 * kd));
  float omega = sqrtf((9.81f * k + .000074f * k * k * k) * th), co = cosf(omega * time),
        si = sinf(omega * time), scale = scales[c] * sea;
  float re = ((a.x + b.x) * co - (a.y + b.y) * si) * scale,
        im = ((a.x - b.x) * si + (a.y - b.y) * co) * scale;
  // Nyquist derivatives must vanish to keep the packed slopes real.
  if (x == 128)
    kx = 0;
  if (z == 128)
    kz = 0;
  output[id] = make_float4((1 - kx) * re, (1 - kx) * im, -kz * im, kz * re);
}
// Stockham autosort IFFT, two complex fields packed in float4, no CPU FFT.
// The unnormalized inverse matches the slope-normalized Fourier coefficients.
__global__ void fft_pass(const float4 *input, float4 *output, int p, int axis, float sign) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || z >= 256)
    return;
  int j = axis == 0 ? x : z, k = j & (p - 1), i = ((j - (j & (2 * p - 1))) >> 1) + k,
      ia = c * 65536 + (axis == 0 ? z * 256 + i : i * 256 + x), ib = ia + (axis == 0 ? 128 : 32768);
  float4 a = input[ia], b = input[ib];
  float ang = sign * 3.14159265359f * (float)k / (float)p, co = cosf(ang), si = sinf(ang),
        sgn = (j & p) != 0 ? -1.0f : 1.0f;
  output[c * 65536 + z * 256 + x] =
      make_float4(a.x + sgn * (co * b.x - si * b.y), a.y + sgn * (si * b.x + co * b.y),
                  a.z + sgn * (co * b.z - si * b.w), a.w + sgn * (si * b.z + co * b.w));
}
__global__ void resolve_surface(const float4 *input, float4 *surface) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || z >= 256)
    return;
  int id = c * 65536 + z * 256 + x;
  float4 s = input[id];
  surface[id] = make_float4(s.x, s.y, s.z, s.y * s.y + s.z * s.z);
}
__device__ float3 ray(float sx, float sy, float aspect, float yaw, float pitch) {
  float cy = cosf(yaw), syaw = sinf(yaw), cp = cosf(pitch), sp = sinf(pitch);
  return norm(v3(syaw * cp + sx * aspect * .62487f * cy - sy * .62487f * syaw * sp,
                 sp + sy * .62487f * cp,
                 -cy * cp + sx * aspect * .62487f * syaw + sy * .62487f * cy * sp));
}
// Fixed 120 Hz damped wave equation, camera-relative grid with integer recentering.
__global__ void ripple_step(const float4 *previous, float4 *next, int shiftX, int shiftZ,
                            float centerX, float centerZ, float camX, float camZ, float camY,
                            float yaw, float pitch, float aspect, float tapX, float tapY,
                            int drop) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x >= 256 || z >= 256)
    return;
  int sx = x + shiftX, sz = z + shiftZ, id = z * 256 + x;
  float h = 0, vel = 0;
  if (sx > 0 && sx < 255 && sz > 0 && sz < 255) {
    int old = sz * 256 + sx;
    float4 a = previous[old];
    float lap = previous[old - 1].x + previous[old + 1].x + previous[old - 256].x +
                previous[old + 256].x - 4 * a.x;
    vel = (a.y + .21f * lap) * .994f;
    h = (a.x + vel) * .999f;
  }
  if (drop != 0) {
    float3 d = ray(tapX, tapY, aspect, yaw, pitch);
    if (d.y < -.01f) {
      float t = -camY / d.y, px = camX + d.x * t, pz = camZ + d.z * t,
            wx = centerX + ((float)x - 128) * .0625f, wz = centerZ + ((float)z - 128) * .0625f,
            dist = sqrtf((wx - px) * (wx - px) + (wz - pz) * (wz - pz));
      h -= .065f * expf(-dist * dist / 0.0225f);
    }
  }
  float edge = smooth(0, 16, (float)min(min(x, 255 - x), min(z, 255 - z)));
  next[id] = make_float4(h * lerp(.85f, 1, edge), vel * lerp(.85f, 1, edge), 0, 0);
}
__global__ void ripple_normals(const float4 *input, float4 *output) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x >= 256 || z >= 256)
    return;
  int id = z * 256 + x;
  float l = input[z * 256 + max(0, x - 1)].x, r = input[z * 256 + min(255, x + 1)].x,
        b = input[max(0, z - 1) * 256 + x].x, f = input[min(255, z + 1) * 256 + x].x,
        h = input[id].x;
  output[id] = make_float4(h, (r - l) * 8, (f - b) * 8, (r + l + b + f - 4 * h) * 256);
}
__device__ float4 rippleAt(const float4 *rip, float x, float z, float cx, float cz) {
  float u = (x - cx) * 16 + 128, w = (z - cz) * 16 + 128;
  if (u < 1 || u > 254 || w < 1 || w > 254)
    return make_float4(0, 0, 0, 0);
  return sample4(rip, u, w, 256, 0);
}
__device__ float4 water(const float4 *surf, const float4 *rip, float x, float z, float cx, float cz,
                        float distance) {
  float4 a = sample4(surf, x * 256 / 4.6f, z * 256 / 4.6f, 256, 0),
         b = sample4(surf, x * 256 / 37, z * 256 / 37, 256, 65536),
         c = sample4(surf, x * 256 / 293, z * 256 / 293, 256, 131072),
         r = rippleAt(rip, x, z, cx, cz);
  float fade = 1 / (1 + distance * .018f);
  return make_float4(a.x + b.x + c.x + r.x, (a.y * fade + b.y + c.y + r.y),
                     (a.z * fade + b.z + c.z + r.z),
                     fmaxf(0, a.w - a.y * a.y - a.z * a.z) + .006f * (1 - fade));
}
// RGB photon splats. Fixed-point atomics avoid floating-point atomic requirements.
__global__ void clear_caustics(unsigned *photons) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x < 512 && z < 512) {
    int id = (z * 512 + x) * 3;
    photons[id] = 0;
    photons[id + 1] = 0;
    photons[id + 2] = 0;
  }
}
__global__ void trace_caustics(const float4 *surface, unsigned *photons, float depth) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x >= 1024 || z >= 1024)
    return;
  float wx = ((float)x + .5f) * 4.6f / 1024, wz = ((float)z + .5f) * 4.6f / 1024;
  float4 a = sample4(surface, wx * 256 / 4.6f, wz * 256 / 4.6f, 256, 0);
  float3 n = norm(v3(-a.y, 1, -a.z)), sun = sunDir();
  for (int c = 0; c < 3; c++) {
    float ior = c == 0 ? 1.3315f : (c == 1 ? 1.3335f : 1.3365f);
    float3 d = refract3(mul(sun, -1), n, 1 / ior);
    float travel = (-depth - a.x) / d.y, px = (wx + d.x * travel) * 512 / 4.6f,
          pz = (wz + d.z * travel) * 512 / 4.6f;
    int ix = (int)floorf(px), iz = (int)floorf(pz);
    float fx = frac(px), fz = frac(pz);
    atomicAdd(&photons[(wrap(iz, 512) * 512 + wrap(ix, 512)) * 3 + c],
              (unsigned)(256 * (1 - fx) * (1 - fz)));
    atomicAdd(&photons[(wrap(iz, 512) * 512 + wrap(ix + 1, 512)) * 3 + c],
              (unsigned)(256 * fx * (1 - fz)));
    atomicAdd(&photons[(wrap(iz + 1, 512) * 512 + wrap(ix, 512)) * 3 + c],
              (unsigned)(256 * (1 - fx) * fz));
    atomicAdd(&photons[(wrap(iz + 1, 512) * 512 + wrap(ix + 1, 512)) * 3 + c],
              (unsigned)(256 * fx * fz));
  }
}
__global__ void filter_caustics(const unsigned *photons, float4 *caustics) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      z = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x >= 512 || z >= 512)
    return;
  float3 sum = v3(0, 0, 0);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      int id = (wrap(z + j, 512) * 512 + wrap(x + i, 512)) * 3;
      float w = (i == 0 ? 2.0f : 1.0f) * (j == 0 ? 2.0f : 1.0f) / 16384;
      sum = add(sum,
                v3((float)photons[id] * w, (float)photons[id + 1] * w, (float)photons[id + 2] * w));
    }
  caustics[z * 512 + x] = make_float4(sum.x, sum.y, sum.z, 1);
}
__device__ float fresnel(float ci) {
  ci = sat(ci);
  float ct = sqrtf(1 - (1 - ci * ci) / (1.3335f * 1.3335f)),
        rs = (ci - 1.3335f * ct) / (ci + 1.3335f * ct),
        rp = (1.3335f * ci - ct) / (1.3335f * ci + ct);
  return .5f * (rs * rs + rp * rp);
}
__device__ float3 skyHorizon(int season) {
  return season == 0 ? v3(.34f, .50f, .72f) : v3(.40f, .50f, .64f);
}
// Aerial perspective shared by land and water so both recede into the same air.
__device__ float3 aerial(float3 col, float distance, int season) {
  float haze = 1.0f - expf(-distance * .00016f);
  return mix3(col, mul(skyHorizon(season), 1.05f), haze * .82f);
}
__device__ float3 sky(float3 d, int season) {
  float3 sun = sunDir();
  float mu = fmaxf(0, dot3(d, sun)), e = d.y;
  float3 col = mix3(skyHorizon(season), v3(.06f, .20f, .52f), powf(sat(e), .45f));
  col = add(
      col, mul(v3(1, .86f, .66f), .22f * powf(mu, 6) + .3f * powf(mu, 64) + 1.6f * powf(mu, 2400)));
  // Distant, hazy ridgelines behind the traced terrain: two layers at different depths.
  float a = atan2f(d.z, d.x);
  float far = .050f + .018f * sinf(a * 2.0f + .8f) + .012f * sinf(a * 5.0f - .5f) +
              .006f * sinf(a * 11.0f + 2.2f) + .003f * (noise(a * 90.0f, 3.0f) - .5f);
  float nearR = .030f + .014f * sinf(a * 3.0f - 1.3f) + .008f * sinf(a * 8.0f + .4f) +
                .004f * (fbm(a * 40.0f, 1.0f) - .5f);
  float3 hills = mix3(v3(.13f, .20f, .10f), v3(.24f, .20f, .10f), season == 0 ? 0.0f : 1.0f);
  float3 farCol = mix3(hills, skyHorizon(season), .72f),
         nearCol = mix3(hills, skyHorizon(season), .52f);
  col = mix3(col, farCol, smooth(far + .0015f, far - .0015f, e));
  return mix3(col, nearCol, smooth(nearR + .0015f, nearR - .0015f, e));
}
// Real terrain: USGS 3DEP lidar packed by pipeline/build_bundle.py into data/<id>/terrain.*.
// The buffer describes itself: T[0] = (width, height, x0, z0), T[1].x = cell size, and cell
// (row, col) is T[2 + row * width + col] = (height, signed shoreline distance, valley, 0).
// Local metres: x east, z south, y up from the reservoir surface.
__device__ float4 terrainSample(const float4 *T, float x, float z) {
  float4 g = T[0];
  float cell = T[1].x;
  int w = (int)g.x;
  float u = fminf(fmaxf((x - g.z) / cell, 0.0f), g.x - 1.001f),
        v = fminf(fmaxf((z - g.w) / cell, 0.0f), g.y - 1.001f);
  int iu = (int)u, iv = (int)v, i = 2 + iv * w + iu;
  float fu = u - (float)iu, fv = v - (float)iv;
  return mix4(mix4(T[i], T[i + 1], fu), mix4(T[i + w], T[i + w + 1], fu), fv);
}
// Metres outside the surveyed grid (negative inside).
__device__ float terrainOutside(const float4 *T, float x, float z) {
  float4 g = T[0];
  float cell = T[1].x;
  return fmaxf(fmaxf(g.z - x, x - (g.z + (g.x - 1.0f) * cell)),
               fmaxf(g.w - z, z - (g.w + (g.y - 1.0f) * cell)));
}
// Metres to the shoreline: negative over the reservoir, positive on land.
__device__ float shoreDistance(const float4 *T, float x, float z) {
  return terrainSample(T, x, z).y;
}
// Lidar flattens water, so the bed is modelled: the banks keep dropping at about 1:3 until
// the basin floor. `depth` is the interface's basin depth.
__device__ float bedDepth(float offshore, float depth) {
  return fminf(depth, .08f + .35f * offshore);
}
__device__ float terrainHeight(const float4 *T, float x, float z) {
  float4 s = terrainSample(T, x, z);
  if (s.y < 0)
    return -bedDepth(-s.y, 40.0f);
  // Sub-grid relief the 10 m lidar grid cannot hold, faded out at the waterline.
  float detail = 2.2f * (fbm(x * .045f + 5.0f, z * .045f) - .5f) +
                 .5f * (noise(x * .21f, z * .21f) - .5f);
  // Past the edge of the survey the clamped lookup would smear the last row into a plateau;
  // let the land fall away under the haze so the painted far ridges take over instead.
  return s.x + detail * smooth(0.0f, 25.0f, s.y) - .25f * fmaxf(0.0f, terrainOutside(T, x, z));
}
__device__ float terrainTrace(const float4 *T, float3 ro, float3 rd, int steps,
                              float maxDistance) {
  float t = 1.0f, prevStep = 1.0f;
  for (int i = 0; i < 128; i++) {
    if (i >= steps || t >= maxDistance)
      break;
    float3 p = add(ro, mul(rd, t));
    float shore = shoreDistance(T, p.x, p.z);
    if (shore < -4.0f) {
      // Over open water nothing above the surface is land: the water pass owns it, and the
      // shoreline distance is a safe horizontal (so also 3D) step to the nearest bank.
      if (p.y < 0)
        return -1.0f;
      prevStep = fmaxf(2.0f, -shore);
      t += prevStep;
      continue;
    }
    float delta = p.y - terrainHeight(T, p.x, p.z);
    if (delta < .0015f * t + .05f) {
      // Bisect between the last clear sample and this one.
      float lo = t - prevStep, hi = t;
      for (int k = 0; k < 5; k++) {
        float mid = .5f * (lo + hi);
        float3 q = add(ro, mul(rd, mid));
        if (q.y - terrainHeight(T, q.x, q.z) < 0)
          hi = mid;
        else
          lo = mid;
      }
      return hi;
    }
    // Minimum step grows with distance (as the pixel footprint does) so grazing rays reach
    // the far ridges; the bisection above hides the coarser sampling.
    prevStep = fmaxf(.6f + .004f * t, fminf(12.0f + .02f * t, delta * .5f));
    t += prevStep;
  }
  // Out of steps while heading down: a few flat-ground Newton steps land it on the hills
  // instead of letting it fall through to the painted backdrop.
  if (rd.y < -.01f && t < maxDistance) {
    for (int k = 0; k < 4; k++) {
      float3 p = add(ro, mul(rd, t));
      t += (p.y - terrainHeight(T, p.x, p.z)) / -rd.y;
    }
    float3 p = add(ro, mul(rd, t));
    if (shoreDistance(T, p.x, p.z) > 0)
      return t;
  }
  return -1.0f;
}
__device__ float3 terrainNormal(const float4 *T, float x, float z, float distance) {
  float e = fmaxf(3.0f, distance * .003f);
  return norm(v3(terrainHeight(T, x - e, z) - terrainHeight(T, x + e, z), 2.0f * e,
                 terrainHeight(T, x, z - e) - terrainHeight(T, x, z + e)));
}
// Soft sun visibility: march toward the sun and keep the tightest clearance ratio.
__device__ float terrainShadow(const float4 *T, float3 p, int steps) {
  float3 sun = sunDir();
  float vis = 1.0f, t = 6.0f;
  for (int i = 0; i < 16; i++) {
    if (i >= steps)
      break;
    float3 q = add(p, mul(sun, t));
    float h = q.y - terrainHeight(T, q.x, q.z);
    vis = fminf(vis, 8.0f * h / t);
    if (vis < 0)
      break;
    t += fmaxf(8.0f, h * .7f);
  }
  return smooth(0, 1, vis);
}
// Oak crowns scattered one candidate per 9 m cell (Voronoi-style), kept when the cell's
// hash falls under the local density. Each crown is a lumpy sphere sitting on a short trunk;
// (x, z) is sampled on a horizontal slice h metres above the ground. Returns (coverage,
// crown normal xyz): coverage is an antialiased 0..1 cross-section, the normal is the sphere's.
// Valley and blue oaks spread wider than they are tall: crowns are ellipsoids this flat.
#define OAK_FLAT .65f
__device__ float4 oakCrowns(float x, float z, float h, float density, float footprint) {
  const float cell = 9.0f;
  float gx = floorf(x / cell), gz = floorf(z / cell);
  float bestDome = -1.0f, cover = 0.0f, nx = 0.0f, ny = 1.0f, nz = 0.0f;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      float cx = gx + (float)i, cz = gz + (float)j;
      if (hash(cx, cz) > density)
        continue;
      float tx = (cx + .15f + .70f * hash(cx + 71.0f, cz - 19.0f)) * cell,
            tz = (cz + .15f + .70f * hash(cx - 33.0f, cz + 57.0f)) * cell,
            rad = 3.4f + 3.2f * hash(cx + 11.0f, cz + 5.0f);
      // Lumpy silhouette so crowns are not perfect discs.
      float dx = x - tx, dz = z - tz;
      rad *= .88f + .24f * noise(atan2f(dz, dx) * 1.3f + cx, cz);
      float dy = (h - (1.6f + OAK_FLAT * rad)) / (OAK_FLAT * rad), slice2 = 1.0f - dy * dy;
      if (slice2 <= 0.0f)
        continue;
      float sr = rad * sqrtf(slice2);
      float d2 = (dx * dx + dz * dz) / (sr * sr);
      if (d2 >= 1.0f)
        continue;
      float dome = sqrtf(1.0f - d2);
      cover = fmaxf(cover, sat((1.0f - sqrtf(d2)) * sr / (1.5f * footprint + .35f)));
      if (dome > bestDome) {
        bestDome = dome;
        nx = dx / rad;
        nz = dz / rad;
        ny = (dy + dome * sqrtf(slice2)) / OAK_FLAT;
      }
    }
  float3 n = norm(v3(nx, ny, nz));
  return make_float4(cover, n.x, n.y, n.z);
}
// Near oaks: exact ray-sphere tests against the crowns the view ray passes over on its way
// to the ground hit p, walking back along the ray while it is within crown height of the
// local ground plane. Returns (coverage, crown normal xyz); *hitBack is how far before p.
__device__ float4 oakRayHit(float3 p, float3 rd, float3 n, float density, float footprint,
                            float *hitBack) {
  const float cell = 9.0f;
  float facing = fmaxf(-dot3(rd, n), .02f);
  float span = fminf(60.0f, 12.0f * n.y / facing);
  int samples = min(20, (int)(span / 4.5f) + 2);
  float best = -1.0f, cover = 0.0f;
  float3 bestN = v3(0, 1, 0);
  for (int k = 0; k < 20; k++) {
    if (k >= samples)
      break;
    float sb = span * (float)k / (float)(samples - 1);
    float gx = floorf((p.x - rd.x * sb) / cell), gz = floorf((p.z - rd.z * sb) / cell);
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        float cx = gx + (float)i, cz = gz + (float)j;
        if (hash(cx, cz) > density)
          continue;
        float tx = (cx + .15f + .70f * hash(cx + 71.0f, cz - 19.0f)) * cell,
              tz = (cz + .15f + .70f * hash(cx - 33.0f, cz + 57.0f)) * cell,
              rad = 3.4f + 3.2f * hash(cx + 11.0f, cz + 5.0f);
        float groundY = p.y - (n.x * (tx - p.x) + n.z * (tz - p.z)) / n.y;
        // Ray-ellipsoid: squash y so the crown becomes a sphere of radius rad.
        float3 w = sub(p, v3(tx, groundY + 1.6f + OAK_FLAT * rad, tz));
        w.y /= OAK_FLAT;
        float3 d = v3(rd.x, rd.y / OAK_FLAT, rd.z);
        float a = dot3(d, d), b = dot3(d, w) / a, miss2 = dot3(w, w) / a - b * b,
              r2 = rad * rad / a;
        if (miss2 >= r2)
          continue;
        float back = b + sqrtf(r2 - miss2);
        if (back <= 0.0f || back <= best)
          continue;
        best = back;
        cover = sat((sqrtf(r2) - sqrtf(miss2)) * sqrtf(a) / (1.5f * footprint + .25f));
        float3 hit = sub(w, mul(d, back));
        bestN = norm(v3(hit.x, hit.y / OAK_FLAT, hit.z));
      }
  }
  *hitBack = fmaxf(best, 0.0f);
  return make_float4(cover, bestN.x, bestN.y, bestN.z);
}
__device__ float3 terrainShade(const float4 *T, float3 p, float3 rd, float distance, int season,
                               int shadowSteps, float time) {
  float3 sun = sunDir(), n = terrainNormal(T, p.x, p.z, distance);
  float footprint = distance * .0015f;
  float4 cell = terrainSample(T, p.x, p.z);
  // Lidar curvature: 1 in ravine bottoms, 0 on spurs and ridge crests.
  float shore = cell.y, spur = 1.0f - cell.z;
  float tex = fbm(p.x * .024f, p.z * .024f);
  // Spring grass is a saturated yellow-green; summer cures to straw.
  float3 spring = mix3(v3(.13f, .30f, .030f), v3(.30f, .46f, .060f), tex);
  float3 summer = mix3(v3(.30f, .21f, .075f), v3(.50f, .37f, .15f), tex);
  float3 grass = mix3(spring, summer, season == 0 ? 0.0f : 1.0f);
  // Wind in the grass. Instanced-blade grass bends each blade by a scrolling wind texture;
  // seen from a distance that shows up as gusts rolling across the hill as lighter bands,
  // because bent blades turn their paler, glossier sides up. A raymarcher can shade that
  // directly: a gust field travelling downwind brightens and desaturates the sward, and
  // close up, blade-aligned streaks sway with the same field.
  float along = p.x * .94f + p.z * .34f, across = p.z * .94f - p.x * .34f;
  float gust = fbm(along * .010f - time * .075f, across * .022f);
  float flutter = noise(along * .06f - time * .45f, across * .11f);
  float bend = sat(smooth(.40f, .72f, gust) + .45f * (flutter - .5f));
  float3 bent = add(mul(grass, 1.28f), season == 0 ? v3(.035f, .045f, .012f) : v3(.05f, .04f, .02f));
  grass = mix3(grass, bent, bend * (.55f + .35f * fabsf(rd.x * .94f + rd.z * .34f)));
  float sway = .7f * bend * sinf(time * 2.4f + along * .35f + gust * 9.0f);
  float blades = noise(across * 9.0f + sway, along * 2.4f) * .5f +
                 noise(across * 23.0f + 1.6f * sway, along * 5.5f + 3.0f) * .5f;
  float tuft = noise(p.x * .35f, p.z * .35f);
  grass = mul(grass, lerp(.80f + .24f * tuft + .20f * blades, 1.0f,
                          smooth(.02f, .10f, footprint)));
  // Where oaks grow (Sunol/Calaveras): open grass with lone oaks on sunny south-facing
  // slopes and spur tops; dense woodland in ravines, on north-facing and on steep slopes,
  // plus broad grove patches so whole hillsides can be wooded.
  float valley = 1.0f - smooth(.22f, .60f, spur);
  float northFacing = smooth(.0f, -.40f, n.z);
  float steep = smooth(.18f, .45f, 1.0f - n.y);
  float grove = smooth(.46f, .64f, fbm(p.x * .0065f + 13.0f, p.z * .0065f - 4.0f));
  float density = sat(.05f + .85f * valley + .55f * northFacing + .25f * steep + .75f * grove -
                      .70f * smooth(.62f, .88f, spur)) *
                  smooth(10.0f, 35.0f, shore);
  // Individual crowns while they are a few pixels wide, then their average cover.
  float farBlend = smooth(1.6f, 3.2f, footprint);
  // Crowns stand up off the ground: near ones get exact ray-sphere hits; mid-distance ones
  // use slice parallax (step back along the view ray to where it was h metres above the
  // local ground plane, top slice first, so the first crown hit hides the ground behind).
  float4 crown = make_float4(0, 0, 1, 0);
  float crownX = p.x, crownZ = p.z;
  float facing = -dot3(rd, n);
  // The ground-plane extrapolation only holds while the slope faces the camera.
  if (distance < 260.0f && shadowSteps > 0 && facing > .18f) {
    float back;
    crown = oakRayHit(p, rd, n, density, footprint, &back);
    crownX = p.x - rd.x * back;
    crownZ = p.z - rd.z * back;
  } else if (distance < 260.0f) {
    // Near slope seen edge-on: parallax would smear crowns into ribbons; draw their tops.
    float4 c = oakCrowns(p.x, p.z, 7.0f, density, footprint);
    crown = c;
  } else if (farBlend < 1.0f && facing > .02f) {
    for (int k = 0; k < 3; k++) {
      float h = 10.5f - 3.5f * (float)k, back = h * n.y / facing;
      if (back > 45.0f)
        continue;
      float qx = p.x - rd.x * back, qz = p.z - rd.z * back;
      float4 c = oakCrowns(qx, qz, h, density, footprint);
      if (c.x > crown.x) {
        crown = c;
        crownX = qx;
        crownZ = qz;
      }
      if (crown.x > .98f)
        break;
    }
  }
  float canopy = lerp(crown.x, fminf(1.0f, density * .9f), farBlend);
  float3 crownN = norm(mix3(v3(crown.y, crown.z, crown.w), n, farBlend));
  // Cast shadows: a crown ~7 m up shades the ground away from the sun.
  float castShadow = 0.0f;
  if (farBlend < 1.0f && canopy < .99f && shadowSteps > 0) {
    float along = 7.0f / fmaxf(sun.y, .15f);
    float4 caster = oakCrowns(p.x + sun.x * along, p.z + sun.z * along, 7.0f, density, footprint);
    castShadow = caster.x * (1.0f - farBlend);
  }
  castShadow = fmaxf(castShadow, farBlend * density * .45f * (1.0f - canopy));
  // Grey-green sage and coyote brush on steep, open, sunny ground.
  float sage = smooth(.60f, .72f, noise(p.x * .045f + 3.0f, p.z * .045f)) * steep *
               (1.0f - density);
  float3 oak = season == 0 ? v3(.030f, .085f, .030f) : v3(.040f, .075f, .032f);
  // Drawdown ring: pale bare bank just above the waterline, darker where recently wet.
  float ring = 1.0f - smooth(3.0f, 6.0f, p.y);
  float wet = 1.0f - smooth(.2f, .9f, p.y);
  float3 bank = mix3(v3(.34f, .30f, .22f), v3(.48f, .43f, .33f), tex);
  float3 ground = mix3(grass, v3(.15f, .19f, .12f), sage * .8f);
  ground = mix3(ground, bank, ring);
  ground = mix3(ground, mul(bank, .45f), wet);
  // Lighting: sun with terrain shadows, sky dome, warm bounce.
  float shadow = shadowSteps > 0 ? terrainShadow(T, add(p, mul(n, .6f)), shadowSteps) : 1.0f;
  float3 sunC = mul(v3(1.30f, 1.18f, 1.00f), 1.55f), skyC = v3(.36f, .46f, .62f),
         bounce = v3(.20f, .16f, .08f);
  float groundSun = fmaxf(0, dot3(n, sun)) * shadow * (1.0f - .85f * castShadow);
  float3 groundLit = prod(ground, add(mul(sunC, groundSun),
                                      add(mul(skyC, .38f + .30f * n.y),
                                          mul(bounce, .25f * (1.0f - n.y)))));
  // Crowns: lit on the sun side, deep inside the foliage on the other.
  float clumps = .70f + .60f * noise(crownX * 1.1f, crownZ * 1.1f);
  float crownSun = fmaxf(0, dot3(crownN, sun)) * shadow * lerp(clumps, 1.0f, farBlend);
  float3 crownLit = prod(oak, add(mul(sunC, .15f + .85f * crownSun),
                                  mul(skyC, .45f + .25f * crownN.y)));
  float3 lit = mix3(groundLit, crownLit, canopy * (1.0f - ring));
  return aerial(lit, distance, season);
}
// Reflected / environment lookup: terrain if the ray hits it, otherwise the sky.
__device__ float3 environment(const float4 *T, float3 ro, float3 rd, int steps, int season,
                              float time) {
  float t = terrainTrace(T, ro, rd, steps, 16000.0f);
  if (t > 0)
    return terrainShade(T, add(ro, mul(rd, t)), rd, t, season, 0, time);
  return sky(rd, season);
}
__device__ float floorDepth(const float4 *T, float x, float z, float depth) {
  // Floor meets the surface at the waterline so the bank shows through shallow water.
  float offshore = fmaxf(0, -shoreDistance(T, x, z));
  float fade = smooth(0.0f, 12.0f, offshore);
  return bedDepth(offshore, depth) + .18f * (noise(x * .12f, z * .12f) - .5f) * fade +
         .08f * (noise(x * .55f + 7, z * .55f + 7) - .5f) * fade;
}
__device__ float3 stone(const float4 *peb, float x, float z, float footprint) {
  float k = noise(x * .85f, z * .85f) * 8, ia = floorf(k), f = frac(k), u = x / .78f * 1024,
        w = z / .78f * 1024;
  float4 a = sample4(peb, u + sinf(3 * ia) * 1024, w + sinf(7 * ia) * 1024, 1024, 0),
         b = sample4(peb, u + sinf(3 * (ia + 1)) * 1024, w + sinf(7 * (ia + 1)) * 1024, 1024, 0);
  float m = smooth(.2f, .8f, f - .1f * (a.x + a.y + a.z - b.x - b.y - b.z));
  float3 col = v3(lerp(a.x, b.x, m), lerp(a.y, b.y, m), lerp(a.z, b.z, m));
  return mix3(col, v3(.20f, .18f, .14f), smooth(.015f, .16f, footprint));
}
__global__ void render_water(const float4 *surface, const float4 *rip, const float4 *caustics,
                             const float4 *pebbles, const float4 *terrain, float4 *hdr, int width,
                             int height, float camX, float camZ, float camY, float yaw, float pitch, float centerX,
                             float centerZ, float depth, float time, int view, int season) {
  int ix = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      iy = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (ix >= width || iy >= height)
    return;
  float sx = 2 * ((float)ix + .5f) / (float)width - 1,
        sy = 1 - 2 * ((float)iy + .5f) / (float)height;
  float3 rd = ray(sx, sy, (float)width / (float)height, yaw, pitch),
         ro = v3(camX, camY, camZ), sun = sunDir(),
         SUN = v3(6, 5.4f, 4.44f), col = sky(rd, season);
  float landT = terrainTrace(terrain, ro, rd, 128, 16000.0f);
  if (landT > 0)
    col = terrainShade(terrain, add(ro, mul(rd, landT)), rd, landT, season, 10, time);
  if (rd.y < .0015f) {
    float3 wd = norm(v3(rd.x, fminf(rd.y, -.0015f), rd.z));
    float t = -camY / wd.y;
    float4 a = make_float4(0, 0, 0, 0);
    for (int i = 0; i < 5; i++) {
      a = water(surface, rip, camX + wd.x * t, camZ + wd.z * t, centerX, centerZ, t);
      t = lerp(t, (a.x - camY) / wd.y, .7f);
    }
    float3 P = v3(camX + wd.x * t, camY + wd.y * t, camZ + wd.z * t);
    a = water(surface, rip, P.x, P.z, centerX, centerZ, t);
    bool onReservoir = shoreDistance(terrain, P.x, P.z) < -.5f && (landT < 0 || t < landT);
    if (onReservoir) {
    float3 n = norm(v3(-a.y, 1, -a.z)), v = mul(wd, -1);
    float nv = dot3(n, v);
    if (nv < .02f) {
      n = norm(add(n, mul(v, .02f - nv)));
      nv = dot3(n, v);
    }
    float F = fresnel(nv);
    float3 nr = norm(mix3(n, v3(0, 1, 0), .75f * smooth(40.0f, 700.0f, t)));
    float3 rr = sub(wd, mul(nr, 2 * dot3(wd, nr)));
    rr.y = fabsf(rr.y);
    // Reservoirs read by what they mirror: trace the reflected ray against the hills.
    float3 reflection = environment(terrain, add(P, v3(0, .3f, 0)), rr, 24, season, time),
           h = norm(add(v, sun));
    float nh = fmaxf(0, dot3(n, h)), nl = fmaxf(0, dot3(n, sun)),
          a2 = .00012f + 1.2f * a.w + .000025f * t, c2 = fmaxf(nh * nh, .0001f),
          tan2 = (1 - c2) / c2, D = expf(-tan2 / a2) / (3.14159265f * a2 * c2 * c2),
          Vis = .5f / (nl * sqrtf(nv * nv * (1 - a2) + a2) + nv * sqrtf(nl * nl * (1 - a2) + a2) +
                       .00001f);
    float3 spec = mul(SUN, fminf(12000, D * Vis * fresnel(dot3(h, v)) * nl));
    float3 tr = refract3(wd, n, 1 / 1.3335f);
    float dist = (-floorDepth(terrain, P.x, P.z, depth) - P.y) / tr.y;
    float3 FP = add(P, mul(tr, dist));
    for (int i = 0; i < 2; i++) {
      dist = (-floorDepth(terrain, FP.x, FP.z, depth) - P.y) / tr.y;
      FP = add(P, mul(tr, dist));
    }
    dist = fmaxf(0, dist);
    float dh = fmaxf(.05f, P.y - FP.y);
    float footprint = t / (float)height * 1.2f;
    float3 alb = stone(pebbles, FP.x, FP.z, footprint);
    float zone = fbm(FP.x * .16f + 3, FP.z * .16f + 3), sand = smooth(.64f, .8f, zone),
          marks = .5f +
                  .5f * sinf((FP.x * .93f + FP.z * .37f) * 16 + 3 * noise(FP.x * .8f, FP.z * .8f));
    alb = mix3(alb, mul(v3(.36f, .30f, .19f), .82f + .1f * marks), sand);
    float big = .65f * noise(FP.x * .45f, FP.z * .45f) +
                .35f * noise(FP.x * 1.3f + 3.1f, FP.z * 1.3f + 3.1f);
    alb = mul(alb, lerp(.62f, 1.22f, big));
    alb = mix3(v3(.30f, .29f, .27f), v3(powf(alb.x, 1.2f), powf(alb.y, 1.2f), powf(alb.z, 1.2f)),
               .72f);
    alb = prod(mul(alb, .6f), v3(1.1f, 1, .86f));
    float4 C = sample4(caustics, FP.x * 512 / 4.6f, FP.z * 512 / 4.6f, 512, 0);
    float3 caus = v3(C.x, C.y, C.z);
    float3 sunT = refract3(mul(sun, -1), v3(0, 1, 0), 1 / 1.3335f);
    float4 R = rippleAt(rip, FP.x - sunT.x * dh / (-sunT.y), FP.z - sunT.z * dh / (-sunT.y),
                        centerX, centerZ);
    caus = mul(caus, fminf(3, fmaxf(.45f, 1 / (1 + .12f * dh * R.w))));
    caus = mix3(caus, v3(1, 1, 1), smooth(.01f, .12f, footprint));
    // Turbid reservoir water (a few metres of visibility): red and blue go first.
    float3 sig = v3(.62f, .28f, .30f);
    float Ts = 1 - fresnel(sun.y);
    float3 Esun = prod(prod(mul(SUN, Ts * (-sunT.y)), exp3(mul(sig, -dh / (-sunT.y)))), caus),
           Esky =
               prod(v3(.4285f, .4838f, .5391f), exp3(mul(v3(.4112f, .0948f, .1152f), -dh * 1.25f))),
           Lfloor = prod(mul(alb, 1 / 3.14159265f), add(Esun, Esky)), Tv = exp3(mul(sig, -dist));
    float cosS = dot3(sunT, mul(tr, -1)),
          ph = .36f / (12.5663706f * powf(1.64f - 1.6f * cosS, 1.5f));
    float3 Lmid =
        add(prod(mul(SUN, Ts * (ph + .02f)), exp3(mul(sig, -dh * .5f / (-sunT.y)))),
            prod(v3(.0341f, .0385f, .0429f), exp3(mul(v3(.4f, .074f, .088f), -dh * .6f))));
    float3 Lin =
        mul(prod(prod(v3(.022f / .62f, .070f / .30f, .105f / .40f), Lmid), sub(v3(1, 1, 1), Tv)),
            3.2f);
    float3 under = add(prod(Lfloor, Tv), Lin);
    col = add(add(mul(reflection, F), mul(under, 1 - F)), spec);
    col = aerial(col, t, season);
    if (view == 1)
      col = mul(caus, .4f);
    if (view == 2)
      col = add(mul(n, .5f), v3(.5f, .5f, .5f));
    }
  }
  float mu = dot3(rd, sun);
  col = add(col, mul(SUN, 18 * smooth(.99996f, .999985f, mu)));
  hdr[iy * width + ix] = make_float4(fmaxf(0, col.x), fmaxf(0, col.y), fmaxf(0, col.z), 1);
}
__global__ void bloom_pass(const float4 *input, float4 *output, int width, int height, int axis) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x >= width || y >= height)
    return;
  float3 sum = v3(0, 0, 0);
  float total = 0;
  for (int i = -12; i <= 12; i++) {
    int xx = min(width - 1, max(0, x + (axis == 0 ? i * 2 : 0))),
        yy = min(height - 1, max(0, y + (axis == 1 ? i * 2 : 0)));
    float4 a = input[yy * width + xx];
    float w = expf(-(float)(i * i) / 40);
    float3 c = v3(a.x, a.y, a.z);
    if (axis == 0)
      c = v3(fmaxf(0, c.x - 2.5f), fmaxf(0, c.y - 2.5f), fmaxf(0, c.z - 2.5f));
    sum = add(sum, mul(c, w));
    total += w;
  }
  sum = mul(sum, 1 / total);
  output[y * width + x] = make_float4(sum.x, sum.y, sum.z, 1);
}
// Lens aperture diffraction: RGB wavelengths, hexagonal aperture and scratches.
// FFT(aperture) -> |amplitude|^2 -> normalized point-spread function -> FFT.
__global__ void lens_aperture(float4 *output) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || y >= 256)
    return;
  float radius = 28.16f * 550 / (c == 0 ? 620.0f : (c == 1 ? 530.0f : 460.0f)), sum = 0;
  for (int sy = 0; sy < 3; sy++)
    for (int sx = 0; sx < 3; sx++) {
      float dx = (float)x - 128 + ((float)sx + .5f) / 3 - .5f,
            dy = (float)y - 128 + ((float)sy + .5f) / 3 - .5f,
            ok = dx * dx + dy * dy < radius * radius ? 1.0f : 0.0f;
      for (int j = 0; j < 6; j++) {
        float ang = .261799f + (float)j * 1.04719755f;
        if (dx * cosf(ang) + dy * sinf(ang) > radius * .955f)
          ok = 0;
      }
      if (fabsf(dx * .93358f + dy * .35837f - .12f * radius) < .55f)
        ok = 0;
      if (fabsf(dx * .92388f + dy * .38268f + .38f * radius) < .40f)
        ok = 0;
      if (fabsf(dx * (-.88295f) + dy * .46947f - .25f * radius) < .25f)
        ok = 0;
      sum += ok;
    }
  output[c * 65536 + y * 256 + x] = make_float4(sum / 9, 0, 0, 0);
}
__global__ void lens_power(const float4 *amplitude, float4 *psf) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || y >= 256)
    return;
  int id = c * 65536 + y * 256 + x;
  float4 a = amplitude[id];
  float dx = (float)(x < 128 ? x : x - 256), dy = (float)(y < 128 ? y : y - 256),
        r = sqrtf(dx * dx + dy * dy),
        val = (a.x * a.x + a.y * a.y) * (1 + 7 * sat((r - 1.5f) / 15));
  if (r > 30)
    val = 0;
  psf[id] = make_float4(val, 0, 0, 0);
}
__global__ void lens_rows(const float4 *psf, float *sums) {
  int z = (int)(blockIdx.x * blockDim.x + threadIdx.x);
  if (z >= 768)
    return;
  float sum = 0;
  for (int x = 0; x < 256; x++)
    sum += psf[z * 256 + x].x;
  sums[z] = sum;
}
__global__ void lens_normalize(const float4 *psf, const float *sums, float4 *output) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || y >= 256)
    return;
  float total = 0;
  for (int j = 0; j < 256; j++)
    total += sums[c * 256 + j];
  int id = c * 65536 + y * 256 + x;
  output[id] = make_float4(psf[id].x / fmaxf(total, .000001f) / 65536, 0, 0, 0);
}
// A 32-pixel empty border plus finite PSF support prevents circular wrap ghosts.
__global__ void glare_source(const float4 *hdr, float4 *output, int width, int height) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || y >= 256)
    return;
  float fit = 192.0f / (float)max(width, height), gw = (float)width * fit, gh = (float)height * fit,
        px = ((float)x - 32) / gw, pz = ((float)y - 32) / gh;
  float val = 0;
  if (px >= 0 && px < 1 && pz >= 0 && pz < 1) {
    for (int j = 0; j < 3; j++)
      for (int i = 0; i < 3; i++) {
        int xx = min(width - 1, max(0, (int)(px * (float)width + ((float)i - 1) / fit * .4f))),
            yy = min(height - 1, max(0, (int)(pz * (float)height + ((float)j - 1) / fit * .4f)));
        float4 a = hdr[yy * width + xx];
        val += fminf(80000, fmaxf(0, (c == 0 ? a.x : (c == 1 ? a.y : a.z)) - 14)) / 9;
      }
  }
  output[c * 65536 + y * 256 + x] = make_float4(val, 0, 0, 0);
}
__global__ void glare_multiply(const float4 *input, const float4 *kernel, float4 *output) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y), c = (int)blockIdx.z;
  if (x >= 256 || y >= 256)
    return;
  int id = c * 65536 + y * 256 + x;
  float4 a = input[id], b = kernel[id];
  output[id] = make_float4(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x, 0, 0);
}
__device__ float tone(float x) {
  return powf(sat((x * (2.51f * x + .03f)) / (x * (2.43f * x + .59f) + .14f)), 1 / 2.2f);
}
__global__ void present(const float4 *hdr, const float4 *bloom, const float4 *diffraction,
                        unsigned *image, int width, int height, float exposure, int glare) {
  int x = (int)(blockIdx.x * blockDim.x + threadIdx.x),
      y = (int)(blockIdx.y * blockDim.y + threadIdx.y);
  if (x >= width || y >= height)
    return;
  int id = y * width + x;
  float4 a = hdr[id], b = bloom[id];
  float3 c = add(v3(a.x, a.y, a.z), mul(v3(b.x, b.y, b.z), glare != 0 ? .08f : 0));
  if (glare != 0) {
    float fit = 192.0f / (float)max(width, height), gx = 32 + ((float)x + .5f) * fit,
          gy = 32 + ((float)y + .5f) * fit;
    float4 dr = sample4(diffraction, gx, gy, 256, 0), dg = sample4(diffraction, gx, gy, 256, 65536),
           db = sample4(diffraction, gx, gy, 256, 131072);
    c = add(c, mul(v3(fmaxf(0, dr.x), fmaxf(0, dg.x), fmaxf(0, db.x)), .14f));
  }
  c = mul(c, exposure);
  unsigned r = (unsigned)(tone(c.x) * 255 + .5f), g = (unsigned)(tone(c.y) * 255 + .5f),
           bl = (unsigned)(tone(c.z) * 255 + .5f);
  image[id] = r | (g << 8) | (bl << 16) | 4278190080u;
}
