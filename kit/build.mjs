#!/usr/bin/env node
// build.mjs — storyboard.json → 可渲染的 HyperFrames 工程（index.html + assets/）
// 用法（在项目目录里）: node <kit>/build.mjs storyboard.json
// 会做三件事：1) 校验分镜（拍点网格、场景首尾相接、类型合法）2) 拷贝运行时与字体 3) 生成 index.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.dirname(fileURLToPath(import.meta.url));
const sbPath = process.argv[2] || "storyboard.json";
const sb = JSON.parse(fs.readFileSync(sbPath, "utf8"));
const TYPES = ["prompt", "codeCrawl", "wordCuts", "counter", "brushSlam", "spectrum", "tileFlip", "whisper", "titleLockup", "credits"];
const errs = [], warns = [];
const BEAT = 60 / sb.bpm, GRID = BEAT / 4; // 16 分音符网格
const onGrid = (t) => Math.abs(t / GRID - Math.round(t / GRID)) < 1e-3;

// ---------- validate ----------
if (!sb.duration || !sb.bpm) errs.push("storyboard 需要 duration 和 bpm");
let cursor = 0;
(sb.scenes || []).forEach((s, i) => {
  if (!TYPES.includes(s.type)) errs.push(`场景 ${s.id} 的 type "${s.type}" 不存在，可用：${TYPES.join(" / ")}`);
  if (Math.abs(s.start - cursor) > 1e-6) errs.push(`场景 ${s.id} 从 ${s.start}s 开始，但上一个场景结束在 ${cursor}s（场景必须首尾相接）`);
  if (!onGrid(s.start) || !onGrid(s.end)) warns.push(`场景 ${s.id} 的起止 ${s.start}–${s.end}s 不在 16 分音符网格上（${GRID}s 的整数倍）`);
  if (!/^[a-z][a-z0-9-]*$/.test(s.id)) errs.push(`场景 id "${s.id}" 只能用小写字母、数字和连字符`);
  cursor = s.end;
});
if (Math.abs(cursor - sb.duration) > 1e-6) errs.push(`场景总长 ${cursor}s ≠ duration ${sb.duration}s`);
for (const h of sb.hits || []) if (!onGrid(h.t) && !/explosion|reverse/.test(h.sfx)) warns.push(`音效 ${h.sfx}@${h.t}s 不在网格上`);
const fx = sb.fx || {};
for (const [t] of fx.shakes || []) if (!(sb.hits || []).some((h) => Math.abs(h.t - t) < 0.02)) warns.push(`镜头冲击 @${t}s 没有对应的音效（画面在动、声音没响）`);
if (errs.length) { console.error("✗ storyboard 有错误：\n  - " + errs.join("\n  - ")); process.exit(1); }

// ---------- copy runtime + assets ----------
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
cp(path.join(KIT, "runtime.js"), "assets/js/runtime.js");
cp(path.join(KIT, "gsap.min.js"), "assets/js/gsap.min.js");
for (const f of fs.readdirSync(path.join(KIT, "fonts"))) cp(path.join(KIT, "fonts", f), path.join("assets/fonts", f));
for (let i = 0; i < 4; i++) cp(path.join(KIT, `noise${i}.png`), `assets/noise${i}.png`);
fs.writeFileSync("assets/js/storyboard.js", "window.STORYBOARD=" + JSON.stringify(sb) + ";");
if (!fs.existsSync("assets/js/audio-data.js")) warns.push("没有 assets/js/audio-data.js：先运行 make-music.mjs（spectrum 场景需要它）");

// ---------- index.html ----------
const P = Object.assign({ ink: "#07070a", paper: "#f3efe6", accent: "#ff3b24", grey: "#8a8894" }, sb.palette || {});
const audio = sb.audio || "assets/bgm.wav";
const scenesHtml = sb.scenes.map((s) => `        <div id="${s.id}" class="scene clip" data-start="${s.start}" data-duration="${+(s.end - s.start).toFixed(4)}" data-track-index="0"></div>`).join("\n");
const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/js/gsap.min.js"></script>
    <style>
      @font-face { font-family: "CC Black"; src: url("assets/fonts/sans-black.woff2") format("woff2"); }
      @font-face { font-family: "CC Light"; src: url("assets/fonts/sans-light.woff2") format("woff2"); }
      @font-face { font-family: "CC Serif"; src: url("assets/fonts/serif-black.woff2") format("woff2"); }
      @font-face { font-family: "CC Brush"; src: url("assets/fonts/brush.woff2") format("woff2"); }
      @font-face { font-family: "CC Mono"; src: url("assets/fonts/mono.woff2") format("woff2"); }
      @font-face { font-family: "CC MonoB"; src: url("assets/fonts/mono-bold.woff2") format("woff2"); }
      :root { --ink: ${P.ink}; --paper: ${P.paper}; --accent: ${P.accent}; --grey: ${P.grey}; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--ink); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--ink); font-family: "CC Light", sans-serif; color: var(--paper); }
      #world { position: absolute; inset: 0; }
      .scene { position: absolute; inset: 0; overflow: hidden; }
      .mono { font-family: "CC Mono", "CC Light", monospace; } .monob { font-family: "CC MonoB", "CC Black", monospace; }
      .black { font-family: "CC Black", sans-serif; } .serif { font-family: "CC Serif", serif; } .brush { font-family: "CC Brush", serif; } .light { font-family: "CC Light", sans-serif; }
      .cap { font-size: 22px; letter-spacing: 0.32em; color: var(--grey); }
      .code-line { height: 64px; font-size: 34px; white-space: pre; color: #cfcbd6; }
      .code-line .ln { display: inline-block; width: 90px; color: #4a4854; }
      .tok-k { color: var(--accent); } .tok-s { color: var(--paper); } .tok-c { color: #6a6878; } .tok-n { color: #36e2ff; }
      .tile { position: absolute; width: 268px; height: 244px; transform-style: preserve-3d; }
      .tile .face { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; backface-visibility: hidden; border-radius: 6px; }
      .tile .front { background: #121117; border: 1px solid #24232b; }
      .tile .back { background: var(--accent); color: var(--ink); transform: rotateX(180deg); }
      .tile .t1 { font-size: 64px; white-space: nowrap; } .tile .t2 { font-size: 18px; letter-spacing: 0.3em; margin-top: 14px; opacity: 0.7; }
      #hud { position: absolute; inset: 0; mix-blend-mode: difference; color: #d9d6de; }
      #hud-tl { position: absolute; left: 64px; top: 52px; font-size: 20px; letter-spacing: 0.35em; }
      #hud-tr { position: absolute; right: 64px; top: 52px; font-size: 20px; letter-spacing: 0.15em; }
      #hud-bar { position: absolute; left: 64px; right: 64px; bottom: 54px; height: 2px; background: #3a3940; }
      #hud-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: #d9d6de; transform-origin: 0 50%; }
      #grain { position: absolute; inset: 0; opacity: 0.07; mix-blend-mode: overlay; background-size: 256px 256px; }
      #vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%); }
      #flash { position: absolute; inset: 0; background: #ffffff; opacity: 0; }
      #blackout { position: absolute; inset: 0; background: #000; opacity: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${sb.duration}" data-width="1920" data-height="1080">
      <audio id="bgm" src="${audio}" data-start="0" data-duration="${sb.duration}" data-track-index="11"></audio>
      <div id="world">
${scenesHtml}
      </div>
      <div id="overlays" class="clip" data-start="0" data-duration="${sb.duration}" data-track-index="5" style="position:absolute;inset:0;">
        <div id="hud" class="mono"><div id="hud-tl">${(sb.hud || "CODE → CINEMA").replace(/</g, "&lt;")}</div><div id="hud-tr"></div><div id="hud-bar"><div id="hud-fill"></div></div></div>
        <div id="grain"></div>
        <div id="vignette"></div>
        <div id="flash"></div>
        <div id="blackout"></div>
      </div>
    </div>
    <script src="assets/js/audio-data.js"></script>
    <script src="assets/js/storyboard.js"></script>
    <script src="assets/js/runtime.js"></script>
    <script>
      window.__timelines["main"] = window.__bpdTL;
    </script>
  </body>
</html>
`;
fs.writeFileSync("index.html", html);
console.log(`✓ index.html：${sb.scenes.length} 个场景，${sb.duration}s @ ${sb.bpm} BPM`);
if (warns.length) console.log("⚠ 提醒：\n  - " + warns.join("\n  - "));
