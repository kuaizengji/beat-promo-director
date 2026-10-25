#!/usr/bin/env node
// review.mjs — 抽帧自检：按分镜自动挑出关键时间点，调用 hyperframes snapshot 出联系表
// 用法（项目目录）: node <kit>/review.mjs storyboard.json
// 之后用 read_image 逐张查看 review/contact-sheet-*.jpg，按 references/review-checklist.md 打分并修改
import fs from "node:fs";
import { execSync } from "node:child_process";

const sb = JSON.parse(fs.readFileSync(process.argv[2] || "storyboard.json", "utf8"));
const times = new Set();
for (const s of sb.scenes) { times.add(+(s.start + 0.1).toFixed(2)); times.add(+((s.start + s.end) / 2).toFixed(2)); }
for (const [t] of (sb.fx && sb.fx.shakes) || []) times.add(+(t + 0.07).toFixed(2));
const at = [...times].filter((t) => t < sb.duration).sort((a, b) => a - b);
console.log(`抽 ${at.length} 帧：${at.join(", ")}`);
fs.rmSync("review", { recursive: true, force: true });
execSync(`npx --yes hyperframes snapshot . --no-end -o review --at ${at.join(",")}`, { stdio: "inherit", shell: true });
const sheets = fs.readdirSync("review").filter((f) => f.startsWith("contact-sheet")).map((f) => "review/" + f);
console.log("\n下一步：用 read_image 打开下面每一张联系表，逐条对照 review-checklist.md：");
for (const s of sheets) console.log("  " + s);
