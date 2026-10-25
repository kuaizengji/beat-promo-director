# 场景库（10 种）

每个场景都是 1920×1080 的满屏版式，位置、字号、动效、配色由 kit 负责；你只填 `params`。
时间参数（`…At`、`t`、`flipTimes`、`chunks` 里的秒数）都是**绝对时间**，并且在 0.125 秒网格上。

| type | 用途 | 最佳时长 | 关键参数 |
|---|---|---|---|
| `prompt` | 开场：光标逐字打出一句话 | 2s | `text`（≤10 字）、`label`、`typeTimes`（可省，默认每 0.125s 一个字）、`enterAt`（回车时刻） |
| `codeCrawl` | 3D 透视滚动的代码/文字墙 + 大计数 | 2s | `lines`（6–12 行文本）、`counterTo`、`unit`、`glitchAt` |
| `wordCuts` | 每拍一个大字，黑白/强调色反转 | 2s（4 拍 4 个词） | `items: [{t, word, sub, bg, fg}]`，`word` ≤4 字，`t` 落在整拍 |
| `counter` | 巨型数字计数 + 胶片条 | 2s | `from`、`to`、`pad`、`label`、`lockAt`（数字锁定变红的时刻）、`glitchAt` |
| `brushSlam` | **drop 专用**：毛笔大字砸下 + 墨点 + 放射线 + 两列竖排 | 2s | `char`（1 个字）、`v1`/`v1At`、`v2`/`v2At`（竖排 ≤5 字） |
| `spectrum` | 本曲真实频谱（随音乐跳动）+ 标题 | 2s | `title`、`sub`、`data`（右下角 1–3 行小字） |
| `tileFlip` | 6×3 文字瓷砖，每个 8 分音符翻一格，最后收束成一句大字 | 2s | `tiles: [[正面, 正面小字, 背面, 背面小字]]`（6 组）、`flipTimes`（每 0.125s 一个）、`finalBig`、`finalText`、`finalAt` |
| `whisper` | break 段的留白小字，一块一块打出 | 2s | `chunks: [[t, 文本]]` |
| `titleLockup` | **finale 专用**：两行衬线大标题 + 印章 | 2s | `line1`、`line2`、`seal`（1 个字）、`sub`、`sealAt` |
| `credits` | 片尾信息 + 光标回到开头 | 2s | `lines`（2–3 行）、`cursorAt` |

## 一支 20 秒片的推荐骨架（120 BPM）

| 秒 | 段落 | 推荐场景 |
|---|---|---|
| 0–2 | intro | `prompt` |
| 2–4 | groove | `codeCrawl` 或 `counter` |
| 4–6 | build | `wordCuts` |
| 6–8 | build（末尾 riser，7.875 闪白） | `counter` |
| 8–10 | **drop** | `brushSlam` |
| 10–12 | drop | `spectrum` |
| 12–14 | drop | `tileFlip`（13.5 收束） |
| 14–16 | break | `whisper`（15.75–16 静音黑场） |
| 16–18 | finale | `titleLockup` |
| 18–20 | outro | `credits`（19.5 起淡出） |

同一个场景类型在一支片里最多用两次；相邻场景不要同类型。
