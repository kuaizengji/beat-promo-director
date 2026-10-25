/* beat-promo-director runtime — 把 storyboard.json 变成一支卡点动态排版片
 * 场景类型：prompt / codeCrawl / wordCuts / counter / brushSlam / spectrum / tileFlip / whisper / titleLockup / credits
 * 规则：所有时间都是绝对秒数，并且应当落在节拍网格上（BEAT = 60 / bpm）。
 * 确定性：没有 Math.random、没有 Date；逐帧内容由主时钟 render(t) 计算。
 */
(function () {
  const SB = window.STORYBOARD;
  const FPS = SB.fps || 30, DUR = SB.duration;
  const P = Object.assign({ ink: "#07070a", paper: "#f3efe6", accent: "#ff3b24", grey: "#8a8894", cyan: "#36e2ff" }, SB.palette || {});
  const $ = (s) => document.querySelector(s);
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const out3 = (x) => 1 - Math.pow(1 - x, 3), in2 = (x) => x * x;
  const c01 = (x) => Math.max(0, Math.min(1, x));
  const fit = (text, max, width) => Math.min(max, Math.floor(width / Math.max(1, Array.from(String(text || "")).length)));
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tl = gsap.timeline({ paused: true });
  const updaters = []; // (t, f) => void
  const glitchTargets = []; // [start, dur, element]
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const div = (parent, cls, css, html) => { const d = document.createElement("div"); if (cls) d.className = cls; if (css) d.style.cssText = css; if (html != null) d.innerHTML = html; parent.appendChild(d); return d; };
  document.documentElement.style.setProperty("--ink", P.ink); document.documentElement.style.setProperty("--paper", P.paper);
  document.documentElement.style.setProperty("--accent", P.accent); document.documentElement.style.setProperty("--grey", P.grey);

  function inkSplash(svg, cx, cy, seed, color, n, accent) {
    const drops = [];
    for (let i = 0; i < n; i++) { const a = hash(i * 1.7 + seed) * Math.PI * 2, d = 120 + Math.pow(hash(i * 3.1 + seed), 1.6) * 760; const r = 4 + Math.pow(hash(i * 5.3 + seed), 3) * 46; drops.push({ e: svgEl("circle", { cx, cy, r: 0, fill: i % 5 === 0 ? accent : color }, svg), x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, r, delay: hash(i * 7.7 + seed) * 0.06 }); }
    return drops;
  }
  function highlight(line) {
    const parts = []; const re = /(\/\/.*$)|("[^"]*"|'[^']*')|\b(const|let|var|for|if|return|function|new|await|true|false)\b|(\b\d+(?:\.\d+)?\b)/g; let last = 0, m;
    while ((m = re.exec(line))) { if (m.index > last) parts.push(esc(line.slice(last, m.index))); const cls = m[1] ? "tok-c" : m[2] ? "tok-s" : m[3] ? "tok-k" : "tok-n"; parts.push(`<span class="${cls}">${esc(m[0])}</span>`); last = re.lastIndex; }
    parts.push(esc(line.slice(last))); return parts.join("");
  }

  const SCENES = {
    // 1. 光标打字：params { text, label, typeTimes?[], enterAt? }
    prompt(root, p, sc) {
      const chars = Array.from(p.text);
      const times = p.typeTimes || chars.map((_, i) => sc.start + 0.25 + i * (p.step || 0.125));
      div(root, "mono cap", "position:absolute;left:244px;top:400px;", esc(p.label || "PROMPT"));
      const line = div(root, "mono", "position:absolute;left:240px;top:470px;height:140px;display:flex;align-items:center;font-size:92px;white-space:nowrap;");
      line.innerHTML = `<span style="color:var(--accent);margin-right:34px">&gt;</span><span class="pt"></span><span class="cur" style="display:inline-block;width:46px;height:96px;background:var(--accent);margin-left:10px"></span>`;
      const txt = line.querySelector(".pt"), cur = line.querySelector(".cur");
      if (p.enterAt) { tl.fromTo(line, { y: 0 }, { y: -18, duration: 0.25, ease: "power3.out" }, p.enterAt); tl.fromTo(line, { scale: 1 }, { scale: 1.06, duration: sc.end - p.enterAt, ease: "power2.in" }, p.enterAt); }
      updaters.push((t) => { if (t < sc.start || t >= sc.end) return; let n = 0; for (const tt of times) if (t >= tt) n++; txt.textContent = chars.slice(0, n).join(""); cur.style.opacity = n < chars.length || Math.floor(t * 4) % 2 === 0 ? 1 : 0.2; });
    },
    // 2. 3D 代码瀑布 + 计数：params { lines[], counterTo, unit, scatter? }
    codeCrawl(root, p, sc) {
      const stage = div(root, "", "position:absolute;inset:0;perspective:900px;perspective-origin:50% 20%;");
      const plane = div(stage, "mono", "position:absolute;left:260px;top:0;width:1400px;height:4200px;transform-origin:50% 0;opacity:.55;");
      plane.setAttribute("data-layout-allow-overlap", "");
      for (let i = 0; i < 64; i++) div(plane, "code-line", "", `<span class="ln">${String(i + 1).padStart(4, "0")}</span>` + highlight(p.lines[i % p.lines.length]));
      div(root, "", "position:absolute;inset:0;background:radial-gradient(ellipse 46% 34% at 50% 46%, rgba(7,7,10,.92) 0%, rgba(7,7,10,.6) 60%, rgba(7,7,10,0) 100%);");
      const cnt = div(root, "monob", "position:absolute;left:0;right:0;top:330px;text-align:center;font-size:300px;line-height:1;letter-spacing:-0.02em;", "0");
      const unit = div(root, "light", "position:absolute;left:0;right:0;top:690px;text-align:center;font-size:46px;letter-spacing:.5em;", esc(p.unit || ""));
      const d = sc.end - sc.start;
      tl.fromTo(plane, { rotationX: 58, y: 760, z: -200 }, { rotationX: 58, y: -2600, z: -200, duration: d, ease: "none" }, sc.start);
      tl.fromTo(cnt, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.25, ease: "expo.out" }, sc.start + 0.05);
      tl.fromTo(unit, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, sc.start + 0.2);
      if (p.glitchAt) glitchTargets.push([p.glitchAt, 0.3, cnt]);
      updaters.push((t) => { if (t < sc.start || t >= sc.end) return; cnt.textContent = Math.round(p.counterTo * out3(c01((t - sc.start - 0.05) / (d * 0.7)))).toLocaleString("en-US"); });
    },
    // 3. 每拍一个大字：params { items:[{t, word, sub, bg, fg}] }
    wordCuts(root, p, sc) {
      p.items.forEach((W, i) => {
        const c = div(root, "", `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${W.bg || P.ink};opacity:0;`);
        const big = div(c, "black", `font-size:${W.size || fit(W.word, 380, 1640)}px;line-height:1;letter-spacing:-0.02em;color:${W.fg || P.paper};white-space:nowrap;`, esc(W.word));
        const sub = div(c, "mono", `margin-top:44px;font-size:32px;letter-spacing:.6em;color:${W.fg || P.paper};opacity:.75;`, esc(W.sub || ""));
        div(c, "mono", `position:absolute;left:120px;bottom:110px;font-size:26px;letter-spacing:.3em;color:${W.fg || P.paper};opacity:.6;`, `0${i + 1} / 0${p.items.length}`);
        tl.set(c, { opacity: 1 }, W.t); const next = p.items[i + 1]; if (next) tl.set(c, { opacity: 0 }, next.t);
        tl.fromTo(big, { scale: 1.18 }, { scale: 1, duration: 0.16, ease: "power4.out" }, W.t);
        tl.fromTo(big, { y: 0 }, { y: -10, duration: 0.5, ease: "none" }, W.t + 0.16);
        tl.fromTo(sub, { opacity: 0, letterSpacing: "1.2em" }, { opacity: 0.75, letterSpacing: "0.6em", duration: 0.3, ease: "power3.out" }, W.t + 0.05);
      });
    },
    // 4. 巨型计数 + 胶片条：params { from, to, pad, label, lockAt, glitchAt }
    counter(root, p, sc) {
      const cols = [P.paper, P.accent, "#1b1a21", P.cyan, "#2a2930"]; const strips = [];
      [120, 860].forEach((y, r) => { const st = div(root, "", `position:absolute;left:0;top:${y}px;height:120px;width:6000px;background:#0f0e13;`); for (let i = 0; i < 36; i++) div(st, "", `position:absolute;top:18px;left:${20 + i * 166}px;width:150px;height:84px;border-radius:4px;background:${cols[Math.floor(hash(i * 3 + r * 17) * cols.length)]};opacity:${(0.18 + hash(i + r * 9) * 0.3).toFixed(2)}`); strips.push(st); });
      const num = div(root, "monob", "position:absolute;left:0;right:0;top:260px;text-align:center;font-size:460px;line-height:1;letter-spacing:-0.03em;", "0");
      div(root, "light", "position:absolute;left:0;right:0;top:760px;text-align:center;font-size:40px;letter-spacing:.6em;color:var(--grey);", esc(p.label || ""));
      const lock = p.lockAt || sc.start + (sc.end - sc.start) * 0.75;
      tl.fromTo(num, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "expo.out" }, sc.start);
      tl.fromTo(num, { scale: 1 }, { scale: 1.08, duration: lock - sc.start, ease: "power2.in" }, sc.start + 0.3);
      if (p.glitchAt) glitchTargets.push([p.glitchAt, 0.375, num]);
      updaters.push((t) => { if (t < sc.start || t >= sc.end) return; const u = c01((t - sc.start) / (lock - sc.start)); const v = Math.round(p.from + (p.to - p.from) * in2(u)); num.textContent = String(v).padStart(p.pad || 0, "0"); num.style.color = u >= 1 ? P.accent : P.paper; strips[0].style.transform = `translateX(${(-((t - sc.start) * 900) % 166).toFixed(1)}px)`; strips[1].style.transform = `translateX(${(-166 + ((t - sc.start) * 900) % 166).toFixed(1)}px)`; });
    },
    // 5. 毛笔大字砸下 + 墨点 + 竖排：params { char, v1, v1At, v2, v2At }
    brushSlam(root, p, sc) {
      root.style.background = P.paper;
      const svg = svgEl("svg", { width: 1920, height: 1080, viewBox: "0 0 1920 1080", style: "position:absolute;inset:0" }, root);
      const drops = inkSplash(svg, 730, 540, 3, "#0b0a0c", 46, P.accent);
      const burst = svgEl("g", { opacity: 0 }, svg);
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2 + hash(i) * 0.05, w = 0.006 + hash(i * 3) * 0.012, r0 = 420 + hash(i * 7) * 200; svgEl("path", { d: `M ${730 + Math.cos(a - w) * 2200} ${540 + Math.sin(a - w) * 2200} L ${730 + Math.cos(a) * r0} ${540 + Math.sin(a) * r0} L ${730 + Math.cos(a + w) * 2200} ${540 + Math.sin(a + w) * 2200} Z`, fill: "#0b0a0c" }, burst); }
      const ch = div(root, "brush", "position:absolute;left:230px;top:40px;width:1000px;height:1000px;display:flex;align-items:center;justify-content:center;font-size:900px;line-height:1;color:#0b0a0c;", esc(p.char));
      const v1 = div(root, "serif", `position:absolute;left:1420px;top:150px;font-size:${fit(p.v1, 150, 820)}px;writing-mode:vertical-rl;letter-spacing:.08em;line-height:1;color:${P.accent};`, esc(p.v1 || ""));
      const v2 = div(root, "serif", "position:absolute;left:1600px;top:150px;font-size:" + fit(p.v2, 150, 820) + "px;writing-mode:vertical-rl;letter-spacing:.08em;line-height:1;color:#0b0a0c;", esc(p.v2 || ""));
      const T = sc.start;
      tl.fromTo(ch, { scale: 3.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.12, ease: "power4.in" }, T - 0.05);
      tl.fromTo(ch, { rotation: -6 }, { rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" }, T + 0.07);
      tl.fromTo(ch, { x: 0 }, { x: -24, duration: sc.end - T - 0.1, ease: "none" }, T + 0.1);
      tl.fromTo(burst, { opacity: 1 }, { opacity: 0, duration: 0.45, ease: "power2.out" }, T);
      tl.fromTo(v1, { y: -160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: "expo.out" }, p.v1At || T + 0.5);
      tl.fromTo(v2, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: "expo.out" }, p.v2At || T + 1.0);
      glitchTargets.push([T, 0.1, ch]);
      updaters.push((t) => { if (t < T - 0.1 || t >= sc.end) return; for (const d of drops) { const u = c01((t - T - d.delay) / 0.22), e = out3(u); d.e.setAttribute("cx", (730 + (d.x - 730) * e).toFixed(1)); d.e.setAttribute("cy", (540 + (d.y - 540) * e + Math.max(0, t - T - 0.3) * 30 * (d.r / 20)).toFixed(1)); d.e.setAttribute("r", (u > 0 ? d.r * (0.4 + 0.6 * e) : 0).toFixed(1)); } });
    },
    // 6. 真实频谱：params { title, sub, data[] }  （频谱来自 make-music 生成的 audio-data.js）
    spectrum(root, p, sc) {
      const A = window.AUDIO_DATA; const wrap = div(root, "", "position:absolute;left:160px;right:160px;top:0;bottom:0;"); const bars = [];
      for (let i = 0; i < A.bands; i++) { const b = div(wrap, "", `position:absolute;bottom:470px;width:22px;border-radius:11px;left:${(i / (A.bands - 1)) * 1576}px;`); div(wrap, "", `position:absolute;top:616px;height:4px;width:22px;border-radius:2px;opacity:.18;background:${P.paper};left:${(i / (A.bands - 1)) * 1576}px;`); bars.push(b); }
      const title = div(root, "black", "position:absolute;left:0;right:0;top:650px;text-align:center;font-size:" + fit(p.title, 170, 1500) + "px;line-height:1;", esc(p.title || ""));
      const sub = div(root, "light", "position:absolute;left:0;right:0;top:850px;text-align:center;font-size:44px;letter-spacing:.4em;color:#c9c5ce;", esc(p.sub || ""));
      const data = div(root, "mono", "position:absolute;right:160px;bottom:120px;font-size:26px;letter-spacing:.2em;color:var(--grey);text-align:right;line-height:1.8;", (p.data || []).map((l) => `<div>${esc(l)}</div>`).join(""));
      tl.fromTo(title, { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: "expo.out" }, sc.start);
      tl.fromTo(sub, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, sc.start + 0.5);
      tl.fromTo(data, { opacity: 0 }, { opacity: 1, duration: 0.3 }, sc.start + 1.0);
      updaters.push((t, f) => { if (t < sc.start || t >= sc.end) return; const row = A.spec[f] || [], rms = A.rms[f] || 0; bars.forEach((b, i) => { const v = row[i] || 0, h = 20 + v * v * 360; b.style.height = (h * 1.15).toFixed(1) + "px"; b.style.background = v > 0.86 ? P.accent : P.paper; b.style.opacity = (0.35 + v * 0.65).toFixed(2); }); title.style.transform = `scale(${(1 + rms * 0.06).toFixed(4)})`; });
    },
    // 7. 文字瓷砖翻转：params { tiles:[[front, fsub, back, bsub]], flipTimes[], finalBig, finalText, finalAt }
    tileFlip(root, p, sc) {
      const grid = div(root, "", "position:absolute;left:120px;top:150px;width:1680px;height:780px;perspective:1400px;"); grid.setAttribute("data-layout-allow-overlap", "");
      const tiles = [];
      for (let i = 0; i < 18; i++) { const d = p.tiles[i % p.tiles.length]; const t = div(grid, "tile", `left:${(i % 6) * 284}px;top:${Math.floor(i / 6) * 268}px;`, `<div class="face front"><div class="t1 black" style="font-size:${fit(d[0], 64, 230)}px">${esc(d[0])}</div><div class="t2 mono">${esc(d[1] || "")}</div></div><div class="face back"><div class="t1 monob" style="font-size:${fit(d[2], 64, 300)}px">${esc(d[2] || "")}</div><div class="t2 mono">${esc(d[3] || "")}</div></div>`); tiles.push(t); }
      const order = [0, 7, 14, 3, 10, 17, 5, 8, 13, 2, 9, 16, 1, 6, 11, 4, 12, 15];
      tiles.forEach((t, i) => tl.fromTo(t, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.25, ease: "power3.out" }, sc.start + (i % 6) * 0.02 + Math.floor(i / 6) * 0.04));
      (p.flipTimes || []).forEach((ft, k) => tl.fromTo(tiles[order[k % 18]], { rotationX: 0 }, { rotationX: 180, duration: 0.18, ease: "power3.out" }, ft - 0.04));
      if (p.finalAt) {
        tiles.forEach((t, i) => tl.to(t, { scale: 0, opacity: 0, duration: 0.14, ease: "power3.in" }, p.finalAt - 0.14 + Math.hypot((i % 6) - 2.5, Math.floor(i / 6) - 1) * 0.012));
        const fin = div(root, "black", "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:" + fit(p.finalText, 210, 1240) + "px;white-space:nowrap;", `<span class="monob" style="color:var(--accent);font-size:420px;margin-right:30px">${esc(p.finalBig || "")}</span><span>${esc(p.finalText || "")}</span>`);
        tl.fromTo(fin, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.14, ease: "power4.out" }, p.finalAt);
      }
    },
    // 8. 留白小字：params { chunks:[[t, text]] }
    whisper(root, p, sc) {
      const tx = div(root, "light", "position:absolute;left:0;right:0;top:500px;text-align:center;font-size:" + fit(p.chunks.map((c) => c[1]).join(""), 64, 1300) + "px;letter-spacing:.3em;");
      const line = div(root, "", "position:absolute;left:360px;top:620px;height:2px;width:1200px;background:var(--grey);transform-origin:0 50%;");
      tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: sc.end - sc.start - 0.3, ease: "none" }, sc.start + 0.05);
      updaters.push((t) => { if (t < sc.start || t >= sc.end) return; let s = ""; for (const [ct, x] of p.chunks) if (t >= ct) s += x; tx.textContent = s; });
    },
    // 9. 标题落版 + 印章：params { line1, line2, seal, sub, sealAt }
    titleLockup(root, p, sc) {
      const svg = svgEl("svg", { width: 1920, height: 1080, viewBox: "0 0 1920 1080", style: "position:absolute;inset:0" }, root);
      const drops = inkSplash(svg, 1625, 665, 11, P.accent, 30, P.accent);
      const t1 = div(root, "serif", "position:absolute;left:200px;top:210px;font-size:" + fit(p.line1, 250, 1260) + "px;line-height:1;letter-spacing:.02em;white-space:nowrap;", esc(p.line1));
      const t2 = div(root, "serif", "position:absolute;left:200px;top:500px;font-size:" + fit(p.line2, 250, 1260) + "px;line-height:1;letter-spacing:.02em;white-space:nowrap;", esc(p.line2 || ""));
      const seal = div(root, "brush", "position:absolute;left:1520px;top:560px;width:210px;height:210px;background:var(--accent);border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:170px;color:var(--paper);", esc(p.seal || ""));
      const sub = div(root, "mono", "position:absolute;left:206px;top:820px;font-size:30px;letter-spacing:.4em;color:var(--grey);", esc(p.sub || ""));
      const T = sc.start, S = p.sealAt || T + 0.9;
      tl.fromTo(t1, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: "expo.out" }, T);
      tl.fromTo(t2, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: "expo.out" }, T + 0.08);
      tl.fromTo(t1, { scale: 1.12 }, { scale: 1, duration: 0.5, ease: "power3.out" }, T);
      tl.fromTo([t1, t2], { y: 0 }, { y: -12, duration: sc.end - T - 0.6, ease: "none" }, T + 0.5);
      tl.fromTo(seal, { scale: 2.4, rotation: -14, opacity: 0 }, { scale: 1, rotation: -4, opacity: 1, duration: 0.12, ease: "power4.in" }, S - 0.1);
      tl.fromTo(sub, { opacity: 0 }, { opacity: 1, duration: 0.4 }, S + 0.3);
      glitchTargets.push([T, 0.12, t1], [T, 0.12, t2]);
      updaters.push((t) => { if (t < S - 0.2 || t >= sc.end) return; for (const d of drops) { const u = c01((t - S + 0.02 - d.delay) / 0.2), e = out3(u); d.e.setAttribute("cx", (1625 + (d.x - 1625) * e * 0.45).toFixed(1)); d.e.setAttribute("cy", (665 + (d.y - 665) * e * 0.45).toFixed(1)); d.e.setAttribute("r", (u > 0 ? d.r * 0.5 * (0.4 + 0.6 * e) : 0).toFixed(1)); } });
    },
    // 10. 片尾：params { lines[], cursorAt }
    credits(root, p, sc) {
      const box = div(root, "light", "position:absolute;left:0;right:0;top:380px;text-align:center;font-size:34px;letter-spacing:.25em;line-height:2.2;");
      p.lines.forEach((l, i) => { const d = div(box, "", "", esc(l)); tl.fromTo(d, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, sc.start + 0.1 + i * 0.25); });
      const end = div(root, "mono", "position:absolute;left:0;right:0;top:700px;display:flex;justify-content:center;align-items:center;font-size:64px;", `<span style="color:var(--accent);margin-right:26px">&gt;</span><span class="cur" style="display:inline-block;width:34px;height:70px;background:var(--accent)"></span>`);
      const cur = end.querySelector(".cur"); const C = p.cursorAt || sc.start + 1;
      tl.fromTo(end, { opacity: 0 }, { opacity: 1, duration: 0.01 }, C); tl.fromTo(end, { scale: 1.3 }, { scale: 1, duration: 0.25, ease: "power4.out" }, C);
      updaters.push((t) => { if (t < sc.start) return; cur.style.opacity = Math.floor(t * 4) % 2 ? 1 : 0.15; });
    },
  };

  // ---------- build scenes ----------
  for (const sc of SB.scenes) {
    const root = document.getElementById(sc.id);
    if (!root) { console.warn("missing scene host", sc.id); continue; }
    const fn = SCENES[sc.type]; if (!fn) { console.warn("unknown scene type", sc.type); continue; }
    fn(root, sc.params || {}, sc);
  }
  // ---------- global fx ----------
  const FX = SB.fx || {};
  (FX.flashes || []).forEach(([t, a, d]) => tl.fromTo("#flash", { opacity: a }, { opacity: 0, duration: d, ease: "power2.out", immediateRender: false }, t));
  (FX.flashIn || []).forEach(([t, d]) => tl.fromTo("#flash", { opacity: 0 }, { opacity: 1, duration: d, ease: "power2.in", immediateRender: false }, t));
  (FX.blackouts || []).forEach(([a, b]) => { tl.set("#blackout", { opacity: 1 }, a); tl.set("#blackout", { opacity: 0 }, b); });
  if (FX.fadeOutAt) tl.fromTo("#blackout", { opacity: 0 }, { opacity: 1, duration: DUR - FX.fadeOutAt, ease: "power1.in", immediateRender: false }, FX.fadeOutAt);
  const SHAKES = FX.shakes || [];
  const world = $("#world"), grain = $("#grain"), hudTR = $("#hud-tr"), hudFill = $("#hud-fill");
  const tc = (f) => `00:00:${String(Math.floor(f / FPS)).padStart(2, "0")}:${String(f % FPS).padStart(2, "0")}`;
  const total = tc(Math.round(DUR * FPS)).replace(/:(\d\d)$/, ":00");
  function render(t) {
    const f = Math.min(Math.round(DUR * FPS) - 1, Math.floor(t * FPS + 1e-6));
    if (hudTR) hudTR.textContent = `${tc(f)} / ${total}`;
    if (hudFill) hudFill.style.transform = `scaleX(${(t / DUR).toFixed(4)})`;
    if (grain) { grain.style.backgroundImage = `url(assets/noise${f % 4}.png)`; grain.style.backgroundPosition = `${Math.floor(hash(f) * 256)}px ${Math.floor(hash(f + 99) * 256)}px`; }
    let sx = 0, sy = 0, rot = 0;
    for (const [st, amp, d] of SHAKES) { const u = (t - st) / d; if (u >= 0 && u < 1) { const k = amp * Math.pow(1 - u, 2); sx += (hash(f * 1.3 + st) - 0.5) * 2 * k; sy += (hash(f * 2.7 + st) - 0.5) * 2 * k; rot += (hash(f * 3.9 + st) - 0.5) * k * 0.04; } }
    world.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
    for (const [st, d, e] of glitchTargets) { const on = t >= st && t < st + d; if (on) { const k = 1 - (t - st) / d, o = (8 + hash(f * 5 + st) * 22) * k; e.style.textShadow = `${o.toFixed(1)}px 0 0 rgba(255,40,60,.85), ${(-o).toFixed(1)}px 0 0 rgba(40,220,255,.85)`; const cut = hash(f * 7 + st); e.style.clipPath = cut > 0.5 ? `inset(${(cut * 60).toFixed(0)}% 0 ${((1 - cut) * 20).toFixed(0)}% 0)` : "none"; } else if (e.dataset.g === "1") { e.style.textShadow = "none"; e.style.clipPath = "none"; } e.dataset.g = on ? "1" : "0"; }
    for (const u of updaters) u(t, f);
  }
  const clock = { t: 0 };
  tl.to(clock, { t: DUR, duration: DUR, ease: "none", onUpdate: () => render(clock.t) }, 0);
  window.__bpdTL = tl;
  render(0);
})();
