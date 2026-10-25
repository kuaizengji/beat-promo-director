#!/usr/bin/env node
// make-music.mjs — 由 storyboard.json 合成一段卡点配乐（原创、无依赖、可复现），并输出逐帧频谱 audio-data.js
// 用法: node <kit>/make-music.mjs storyboard.json assets/bgm.wav
// 设计：同一份 cues.json 同时驱动画面时间线和音乐，所以切镜/出招/音效天然对齐。
import fs from "node:fs";

const [, , cuesPath = "storyboard.json", outPath = "assets/bgm.wav"] = process.argv;
const sb = JSON.parse(fs.readFileSync(cuesPath, "utf8"));
// 兼容两种写法：storyboard.json（音乐写在 music 字段里）或独立的 cues.json
const cues = sb.music ? Object.assign({ bpm: sb.bpm, duration: sb.duration, hits: sb.hits || [] }, sb.music) : sb;
cues.lead = cues.lead || []; cues.koto = cues.koto || []; cues.hits = cues.hits || [];
const SR = 44100;
const DUR = cues.duration + 0.0;
const N = Math.ceil(SR * DUR);
const BEAT = 60 / cues.bpm;
const L = new Float32Array(N), R = new Float32Array(N);
const VL = new Float32Array(N), VR = new Float32Array(N); // reverb send

// ---------- deterministic noise ----------
let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hash01 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- helpers ----------
function add(t0, buf, gain = 1, pan = 0, send = 0) {
  const s0 = Math.round(t0 * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
  const gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  for (let i = 0; i < buf.length; i++) {
    const j = s0 + i; if (j < 0 || j >= N) continue;
    L[j] += buf[i] * gl; R[j] += buf[i] * gr;
    if (send) { VL[j] += buf[i] * gl * send; VR[j] += buf[i] * gr * send; }
  }
}
function render(dur, fn) { const n = Math.floor(dur * SR); const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = fn(i / SR, i); return b; }
// one-pole filters (stateful closures)
const lp1 = (fc) => { let y = 0; return (x, f = fc) => { const a = 1 - Math.exp(-2 * Math.PI * f / SR); y += a * (x - y); return y; }; };
const hp1 = (fc) => { const l = lp1(fc); return (x, f = fc) => x - l(x, f); };
// state-variable bandpass
const bp = (fc, q = 1) => { let lo = 0, b = 0; return (x, f = fc) => { const F = 2 * Math.sin(Math.PI * Math.min(f, SR / 6) / SR); const hi = x - lo - b / q; b += F * hi; lo += F * b; return b; }; };
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d));

// ---------- drums ----------
const kick = (g = 1) => { let ph = 0; return render(0.45, (t) => { const f = 45 + 110 * Math.exp(-t * 30); ph += f / SR; return Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * g + (t < 0.004 ? rnd() * 0.5 : 0); }); };
const snare = (g = 1) => { const b = bp(1900, 0.7); let ph = 0; return render(0.32, (t) => { ph += 190 / SR; return (Math.sin(2 * Math.PI * ph) * Math.exp(-t * 22) * 0.45 + b(rnd()) * 1.6 * Math.exp(-t * 15)) * g; }); };
const hat = (g = 1, open = false) => { const h = hp1(7500); return render(open ? 0.35 : 0.06, (t) => h(rnd()) * Math.exp(-t * (open ? 9 : 70)) * 0.32 * g); };
const taiko = (g = 1) => { let ph = 0; const l = lp1(500); return render(1.4, (t) => { const f = 62 + 70 * Math.exp(-t * 14); ph += f / SR; return (Math.sin(2 * Math.PI * ph) * Math.exp(-t * 3.2) + l(rnd()) * 0.9 * Math.exp(-t * 18)) * g; }); };
const crash = (g = 1) => { const h = hp1(4500); const b = bp(8000, 2); return render(2.2, (t) => { const x = rnd(); return (h(x) * 0.35 + b(x) * 0.25) * Math.exp(-t * 2.2) * g; }); };
const tom = (f0, g = 1) => { let ph = 0; return render(0.4, (t) => { ph += (f0 + f0 * 0.6 * Math.exp(-t * 20)) / SR; return Math.sin(2 * Math.PI * ph) * Math.exp(-t * 8) * g; }); };

// ---------- tonal ----------
const CH = { Dm: [62, 65, 69], Bb: [58, 62, 65], A: [57, 61, 64], C: [60, 64, 67], Gm: [55, 58, 62], F: [57, 60, 65] };
const ROOT = { Dm: 38, Bb: 34, A: 33, C: 36, Gm: 31, F: 41 };
function chordAt(t) { let c = cues.chords[0].chord; for (const k of cues.chords) if (k.t <= t + 1e-6) c = k.chord; return c; }
function sectionAt(t) { return cues.sections.find((s) => t >= s.start && t < s.end) || cues.sections[cues.sections.length - 1]; }

function padNote(m, dur, g, cutoff = 1400) {
  const dets = [-0.11, -0.04, 0.05, 0.12]; const phs = dets.map(() => Math.random() * 0 + 0);
  const l = lp1(cutoff);
  return render(dur + 0.6, (t) => {
    let s = 0; dets.forEach((d, i) => { phs[i] += mtof(m + d) / SR; s += saw(phs[i]); });
    const a = Math.min(1, t / 0.35) * (t > dur ? Math.exp(-(t - dur) * 5) : 1);
    return l(s / 4) * a * g;
  });
}
function bassNote(m, dur, g) {
  let ph = 0, ps = 0; const l = lp1(500);
  return render(dur + 0.05, (t) => { ph += mtof(m) / SR; ps += mtof(m - 12) / SR; const e = env(t, 0.004, 5) * 0.6 + 0.4 * (t < dur ? 1 : Math.exp(-(t - dur) * 60)); const fc = 220 + 1400 * Math.exp(-t * 18);
    return (l(saw(ph), fc) * 0.8 + Math.sin(2 * Math.PI * ps) * 0.55) * e * g * (t < dur ? 1 : Math.exp(-(t - dur) * 80)); });
}
function brass(ms, dur, g) {
  const v = ms.map((m) => ({ m, p1: 0, p2: 0 })); const l = lp1(3000);
  return render(dur + 0.3, (t) => { let s = 0; for (const o of v) { o.p1 += mtof(o.m - 0.08) / SR; o.p2 += mtof(o.m + 0.08) / SR; s += saw(o.p1) + saw(o.p2); }
    const fc = 700 + 3200 * Math.exp(-t * 6); const e = env(t, 0.012, 3.2) * (t > dur ? Math.exp(-(t - dur) * 12) : 1);
    return l(s / (v.length * 2), fc) * e * g; });
}
function lead(m, dur, g) {
  let ph = 0, pq = 0; const l = lp1(3600);
  return render(dur + 0.12, (t) => { const vib = t > 0.15 ? Math.sin(2 * Math.PI * 5.5 * t) * 0.18 : 0; const f = mtof(m + vib); ph += f / SR; pq += f / SR;
    const sq = (pq % 1) < 0.5 ? 1 : -1; const e = Math.min(1, t / 0.01) * (t < dur ? 1 : Math.exp(-(t - dur) * 30)) * (0.85 + 0.15 * Math.exp(-t * 6));
    return l(saw(ph) * 0.7 + sq * 0.25) * e * g; });
}
function koto(m, g) { // Karplus-Strong pluck
  const f = mtof(m); const p = Math.max(2, Math.round(SR / f)); const buf = new Float32Array(p); for (let i = 0; i < p; i++) buf[i] = rnd();
  let idx = 0; return render(1.6, (t) => { const a = buf[idx], b = buf[(idx + 1) % p]; const y = 0.4985 * (a + b); buf[idx] = y; idx = (idx + 1) % p; return a * g * Math.exp(-t * 1.5); });
}
// ---------- sfx ----------
const sweepNoise = (dur, f0, f1, q, g, shape) => { const b = bp(f0, q); return render(dur, (t) => { const u = t / dur; const f = f0 * Math.pow(f1 / f0, u); return b(rnd(), f) * shape(u) * g; }); };
const metal = (dur, g, partials = [2120, 3170, 4730, 6230, 8110]) => render(dur, (t) => partials.reduce((s, f, i) => s + Math.sin(2 * Math.PI * f * t + i) * Math.exp(-t * (3 + i * 1.6)) / (i + 1), 0) * g);
const sub = (dur, f0, f1, g) => { let ph = 0; return render(dur, (t) => { const f = f0 * Math.pow(f1 / f0, t / dur); ph += f / SR; return Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.4) * g; }); };
const SFX = {
  type: (t) => { add(t, sweepNoise(0.035, 3000, 2600, 3, 2.2, (u) => Math.exp(-u * 5)), 0.32, (Math.round(t * 8) % 2 ? 0.25 : -0.25), 0.1); add(t, render(0.03, (x) => Math.sin(2 * Math.PI * 180 * x) * Math.exp(-x * 120)), 0.25); },
  enter: (t) => { add(t, sweepNoise(0.06, 2200, 1800, 2, 2.6, (u) => Math.exp(-u * 4)), 0.45); add(t, kick(0.9), 0.7); },
  hit: (t) => { add(t, kick(1.15), 0.9); add(t, snare(0.9), 0.55, 0, 0.25); add(t, sub(0.6, 90, 40, 0.6)); },
  glitch: (t) => { add(t, render(0.28, (x) => { const step = Math.floor(x * 120); return (hash01(step) * 2 - 1) * (Math.sin(2 * Math.PI * (300 + 900 * hash01(step + 7)) * x) > 0 ? 1 : -1) * 0.35 * Math.exp(-x * 4); }), 0.6, 0, 0.15); },
  blip: (t) => { let ph = 0; add(t, render(0.09, (x) => { ph += (1600 - 900 * x / 0.09) / SR; return Math.sin(2 * Math.PI * ph) * Math.exp(-x * 40) * 0.5; }), 0.4, (Math.round(t * 4) % 2 ? 0.4 : -0.4), 0.3); },
  stamp: (t) => { add(t, sub(0.5, 120, 50, 1.0), 0.9); add(t, sweepNoise(0.12, 700, 300, 0.8, 2.4, (u) => Math.exp(-u * 8)), 0.6); add(t, taiko(0.7), 0.7, 0, 0.3); },
  reverse: (t) => { const c = crash(1.0); const n = Math.floor(0.9 * SR); const r = new Float32Array(n); for (let i = 0; i < n; i++) r[i] = c[n - 1 - i] * (i / n); add(t - 0.9, r, 0.7, 0, 0.2); },
  tick: (t) => add(t, render(0.02, (x) => Math.sin(2 * Math.PI * 2400 * x) * Math.exp(-x * 200)), 0.18, 0.3),
  boom: (t) => { add(t, taiko(1.0), 0.9, 0, 0.35); add(t, sub(1.4, 60, 32, 0.7)); },
  heel: (t) => { add(t, sweepNoise(0.05, 3400, 3000, 6, 3.5, (u) => Math.exp(-u * 6)), 0.6, -0.15, 0.4); add(t, render(0.08, (x) => Math.sin(2 * Math.PI * 1750 * x) * Math.exp(-x * 60)), 0.35, -0.15, 0.4); add(t + 0.01, sweepNoise(0.22, 2600, 1200, 1.5, 1.2, (u) => Math.exp(-u * 5)), 0.35, 0.1, 0.3); },
  aura: (t) => { add(t - 0.3, sweepNoise(0.9, 200, 1800, 1.2, 1.4, (u) => Math.sin(Math.PI * u)), 0.5, 0, 0.3); add(t, taiko(0.6), 0.6); },
  whoosh: (t) => add(t - 0.12, sweepNoise(0.32, 600, 3200, 1.3, 1.8, (u) => Math.sin(Math.PI * u) ** 2), 0.55, 0, 0.2),
  dash: (t) => add(t - 0.05, sweepNoise(0.5, 400, 4000, 1.1, 2.0, (u) => Math.sin(Math.PI * u)), 0.6, 0, 0.2),
  draw: (t) => { add(t, sweepNoise(0.35, 2500, 6500, 3, 1.5, (u) => Math.sin(Math.PI * u)), 0.45, 0.2, 0.3); add(t + 0.15, metal(1.3, 0.35), 0.55, 0.2, 0.5); },
  slam: (t) => { add(t, kick(1.2), 0.9); add(t, crash(0.8), 0.6, 0, 0.3); add(t, sub(1.0, 70, 35, 0.6)); },
  clash: (t) => { add(t, metal(1.1, 0.6, [1630, 2410, 3790, 5120, 6870]), 0.75, 0, 0.5); add(t, snare(1.2), 0.6, 0, 0.3); add(t, taiko(0.9), 0.8); add(t, crash(0.6), 0.5); },
  scrape: (t) => { add(t, sweepNoise(0.9, 3000, 5200, 4, 1.0, (u) => Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(u * 60))), 0.35, 0.3, 0.3); },
  claw: (t) => { add(t - 0.1, sweepNoise(0.35, 300, 2400, 0.9, 2.0, (u) => Math.sin(Math.PI * u)), 0.6, 0.3, 0.2); add(t + 0.05, sweepNoise(0.25, 1500, 900, 2, 1.2, (u) => Math.exp(-u * 4)), 0.4, 0.3); },
  punch: (t) => { add(t, sub(0.4, 110, 45, 1.0), 0.9); add(t, sweepNoise(0.12, 900, 400, 0.8, 2.5, (u) => Math.exp(-u * 6)), 0.6); add(t, snare(0.8), 0.4); },
  slash: (t) => { add(t - 0.06, sweepNoise(0.22, 1800, 7000, 2.2, 2.2, (u) => Math.sin(Math.PI * u)), 0.5, (Math.round(t * 4) % 2 ? 0.4 : -0.4), 0.25); add(t + 0.04, metal(0.5, 0.18, [3100, 4700, 6900]), 0.4, 0, 0.3); },
  charge: (t) => { let p1 = 0, p2 = 0; const l = lp1(200); add(t, render(1.0, (x) => { p1 += 55 / SR; p2 += 110.7 / SR; const fc = 200 + 2600 * x; const trem = 0.6 + 0.4 * Math.sin(2 * Math.PI * (4 + 18 * x) * x); return l(saw(p1) + saw(p2), fc) * x * trem * 0.5; }), 0.7, 0, 0.2); },
  explosion: (t) => { const l = lp1(900); add(t, render(2.4, (x) => l(rnd(), 900 * Math.exp(-x * 1.2) + 120) * Math.exp(-x * 1.6) * 1.6 + (rnd() > 0.995 ? rnd() * Math.exp(-x * 3) : 0)), 0.75, 0, 0.4); add(t, sub(1.6, 55, 28, 0.8)); },
  mega: (t) => { add(t, kick(1.4), 1.0); add(t, sub(2.2, 80, 24, 1.0)); add(t, crash(1.2), 0.8, 0, 0.4); add(t, metal(1.6, 0.6, [1210, 1830, 2950, 4400, 6100]), 0.7, 0, 0.6); add(t, brass([50, 57, 62, 65, 69, 74], 1.4, 0.9), 0.8, 0, 0.5); },
  sheath: (t) => { add(t, metal(1.8, 0.5, [3520, 5280, 7040, 8800]), 0.55, 0.15, 0.6); add(t, sweepNoise(0.06, 4200, 3800, 5, 3, (u) => Math.exp(-u * 8)), 0.4); },
};

// ---------- arrangement ----------
for (const s of cues.sections) {
  for (let t = s.start; t < s.end - 1e-6; t += BEAT / 4) {
    const step = Math.round((t - s.start) / (BEAT / 4)); const beatIn = step % 4 === 0; const beatNo = Math.floor(step / 4);
    if (s.silenceFrom && t >= s.silenceFrom) continue;
    if (s.drums === "full") {
      if (beatIn) add(t, kick(1), 0.95);
      if (beatIn && beatNo % 2 === 1) add(t, snare(1), 0.7, 0.05, 0.15);
      add(t, hat(step % 4 === 2 ? 1.0 : 0.55, step % 8 === 6), 0.5, 0.25);
      if (step % 16 === 14) add(t, tom(140, 0.7), 0.6, -0.3);
    } else if (s.drums === "groove") {
      if (beatIn && beatNo % 2 === 0) add(t, kick(0.9), 0.85);
      if (beatIn && beatNo % 2 === 1) add(t, snare(0.6), 0.45, 0.05, 0.2);
      if (step % 2 === 0) add(t, hat(0.6), 0.35, 0.25);
    } else if (s.drums === "build") {
      const rel = t - s.start, len = s.end - s.start;
      if (beatIn) add(t, kick(0.85), 0.8);
      if (step % 2 === 0) add(t, hat(0.5), 0.35, 0.25);
      if (rel >= len - 1.0) { // accelerating snare roll in the last second
        const div = rel >= len - 0.5 ? 1 : 2; if (step % div === 0) add(t, snare(0.35 + 0.65 * (rel - (len - 1))), 0.55);
      }
    } else if (s.drums === "heartbeat") {
      if (beatIn && beatNo % 2 === 0) { add(t, kick(0.9), 0.8); add(t + 0.18, kick(0.6), 0.6); }
      const rel = t - s.start; if (rel >= 1.0 && step % 1 === 0 && rel < 1.75) add(t, snare(0.2 + 0.8 * (rel - 1) / 0.75), 0.45);
    }
  }
}
// riser into the drop and into the finale
const riser = (t0, dur) => { add(t0, sweepNoise(dur, 300, 7000, 1.4, 1.6, (u) => u * u), 0.5, 0, 0.3); let ph = 0; const l = lp1(800); add(t0, render(dur, (x) => { ph += (180 * Math.pow(4, x / dur)) / SR; return l(saw(ph)) * (x / dur) * 0.35; }), 0.5); };
riser(6.0, 2.0); riser(15.0, 0.75);
// pads (chords), bass, brass stabs
for (let t = 0; t < DUR - 1e-6; t += BEAT * 2) {
  const s = sectionAt(t); if (s.silenceFrom && t >= s.silenceFrom) continue;
  const c = chordAt(t); const cut = s.name === "break" ? 600 : s.name === "intro" || s.name === "outro" ? 1100 : 1700;
  const len = Math.min(BEAT * 2, (s.silenceFrom ?? 1e9) - t);
  CH[c].forEach((m, i) => add(t, padNote(m, len, 0.11, cut), 1, i - 1, 0.6));
  if (c !== chordAt(t + BEAT)) { /* chord changes mid-bar: second half */ }
}
for (const k of cues.chords) { // extra pad onsets for mid-bar chord changes
  if (Math.abs(k.t / (BEAT * 2) - Math.round(k.t / (BEAT * 2))) > 1e-6) {
    CH[k.chord].forEach((m, i) => add(k.t, padNote(m, BEAT * 2, 0.11, 1600), 1, i - 1, 0.6));
  }
}
for (let t = 0; t < DUR - 1e-6; t += BEAT / 2) {
  const s = sectionAt(t); if (s.silenceFrom && t >= s.silenceFrom) continue;
  const c = chordAt(t); const r = ROOT[c]; const step = Math.round(t / (BEAT / 2));
  if (s.drums === "full") { const pat = [0, 0, 12, 0, 0, 12, 0, 7]; add(t, bassNote(r + pat[step % 8], BEAT / 2 * 0.9, 0.42), 1); }
  else if (s.drums === "build" || s.drums === "groove") { add(t, bassNote(r, BEAT / 2 * 0.8, 0.28 + 0.1 * ((t - s.start) / 4)), 1); }
  else if (s.name === "break" && step % 4 === 0) add(t, bassNote(r, BEAT * 1.6, 0.25), 1);
}
const STAB = cues.stabs || [8.0, 8.5, 10.0, 10.5, 11.0, 11.25, 11.5, 12.0, 13.0, 13.5, 16.0, 17.0];
for (const t of STAB) { const c = chordAt(t); add(t, brass(CH[c].map((m) => m + 12).concat([CH[c][0]]), 0.22, 0.55), 1, 0, 0.35); }
for (const [t, m, d] of cues.lead) add(t, lead(m, d, 0.16), 1, 0.1, 0.3);
for (const [t, m] of cues.koto) add(t, koto(m, 0.5), 1, -0.35, 0.45);
// wind bed in intro/outro
{ const l = lp1(500); add(0, render(4.2, (x) => l(rnd()) * (0.5 + 0.5 * Math.sin(x * 1.3)) * Math.min(1, x / 0.8) * Math.exp(-Math.max(0, x - 3.4) * 4) * 0.5), 0.6); }
{ const l = lp1(500); add(18, render(2.0, (x) => l(rnd()) * (0.5 + 0.5 * Math.sin(x * 1.7)) * 0.5), 0.5); }
for (const h of cues.hits) { const f = SFX[h.sfx]; if (!f) { console.warn("unknown sfx", h.sfx); continue; } f(h.t); }

// ---------- reverb (Schroeder) on the send bus ----------
function reverb(inp, sr) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ b: new Float32Array(d), i: 0, f: 0.8 }));
  const aps = [225, 556].map((d) => ({ b: new Float32Array(d), i: 0 }));
  const out = new Float32Array(inp.length); let lpS = 0;
  for (let n = 0; n < inp.length; n++) {
    let s = 0; for (const c of combs) { const y = c.b[c.i]; lpS = y * 0.7 + lpS * 0.3; c.b[c.i] = inp[n] + lpS * c.f; c.i = (c.i + 1) % c.b.length; s += y; }
    s /= 4; for (const a of aps) { const y = a.b[a.i]; const x = s + y * 0.5; a.b[a.i] = x; a.i = (a.i + 1) % a.b.length; s = y - x * 0.5; }
    out[n] = s;
  }
  return out;
}
const rvL = reverb(VL), rvR = reverb(VR);
// final fade + soft clip + normalize
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR; const fade = t > DUR - 0.8 ? Math.max(0, (DUR - t) / 0.8) : 1;
  L[i] = Math.tanh((L[i] + rvL[i] * 0.55) * 0.9) * fade; R[i] = Math.tanh((R[i] + rvR[i] * 0.55) * 0.9) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.92 / (peak || 1);
const data = Buffer.alloc(44 + N * 4);
data.write("RIFF", 0); data.writeUInt32LE(36 + N * 4, 4); data.write("WAVE", 8); data.write("fmt ", 12);
data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { data.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4); data.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767), 46 + i * 4); }
fs.mkdirSync(outPath.replace(/[\\/][^\\/]*$/, "") || ".", { recursive: true });
fs.writeFileSync(outPath, data);
console.log(`wrote ${outPath}: ${DUR}s @ ${cues.bpm} BPM, ${cues.hits.length} hits, peak ${peak.toFixed(2)}`);

// ---------- per-frame spectrum for audio-reactive scenes (assets/js/audio-data.js) ----------
{
  const FPSx = sb.fps || 30, NF = Math.round(DUR * FPSx), W = 2048, BANDS = 48;
  const mono = new Float32Array(N); for (let i = 0; i < N; i++) mono[i] = (L[i] + R[i]) * 0.5 * norm;
  const re = new Float64Array(W), im = new Float64Array(W);
  const fft = () => { for (let i = 1, j = 0; i < W; i++) { let b = W >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= W; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < W; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s2 = Math.sin(a * k); const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s2, xi = re[i + k + len / 2] * s2 + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } } };
  const edges = []; for (let b = 0; b <= BANDS; b++) edges.push(40 * Math.pow(14000 / 40, b / BANDS));
  const spec = [], rms = [];
  for (let f = 0; f < NF; f++) {
    const c = Math.floor((f + 0.5) / FPSx * SR); let e = 0;
    for (let i = 0; i < W; i++) { const j = c - W / 2 + i; const v = j >= 0 && j < N ? mono[j] : 0; re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (W - 1))); im[i] = 0; e += v * v; }
    rms.push(Math.sqrt(e / W)); fft();
    const row = []; for (let b = 0; b < BANDS; b++) { const k0 = Math.max(1, Math.floor(edges[b] * W / SR)), k1 = Math.max(k0 + 1, Math.floor(edges[b + 1] * W / SR)); let m = 0; for (let k = k0; k < k1; k++) m += Math.hypot(re[k], im[k]); row.push(20 * Math.log10(m / (k1 - k0) + 1e-6)); }
    spec.push(row);
  }
  const flat = spec.flat().sort((a, b) => a - b); const lo = flat[Math.floor(flat.length * 0.05)], hi = flat[Math.floor(flat.length * 0.995)];
  const maxR = Math.max(...rms) || 1;
  const data = { fps: FPSx, bands: BANDS, spec: spec.map((r) => r.map((v) => Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100) / 100)), rms: rms.map((v) => Math.round(v / maxR * 1000) / 1000) };
  const dir = outPath.replace(/[\\/][^\\/]*$/, "") || ".";
  fs.mkdirSync(dir + "/js", { recursive: true });
  fs.writeFileSync(dir + "/js/audio-data.js", "window.AUDIO_DATA=" + JSON.stringify(data) + ";");
  console.log(`wrote ${dir}/js/audio-data.js: ${NF} frames x ${BANDS} bands`);
}
