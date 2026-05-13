# AI 图像生成总指南（gpt-img-2 输入文档）

> 本文档把游戏所需的全部图像资产，整理为可直接喂给 `gpt-img-2` 的 prompt 列表。
> 每个 prompt 已经内嵌 **风格基底 + 负面词 + 尺寸 + 背景**，你只需要把对应小节复制进去逐条调用。
> 与设计文档对齐：本文是 `doc/game-design.md` §21 的可执行版本。

## 目录

0. 使用方法（含 reference-first 工作流、验收标准、失败模式）
1. 全局风格基底 STYLE_BASE
2. 全局负面 prompt NEGATIVE_BASE
3. 输出参数表 + 像素级构图硬约束
4. 英雄角色帧（master ref → 72 动作帧 → 头像 → 立绘）
5. 防御塔（master 立绘 → L1/L2/L3 → attack → 分支）
6. 怪物（族系 LOCK → 每只 portrait → walk/attack/death + 章节 Boss）
7. 投射物 / 特效
8. 章节地图（背景，含 path geometry）
9. 章节漫画分镜（5 章 × 8 格 = 40 格）
10. 立绘 / 头像 / 启动屏
11. UI 元素与图标
12. 文件落点对照表
13. 批量生成脚本（reference-first 三阶段伪代码）
14. 速查清单
15. 全量资源预算表（含优先级）
16. 最终完整性自检

---

## 0. 使用方法

### 0.1 一句话流程

> 「**STYLE_BASE** + 该资源 prompt + **NEGATIVE_BASE** + 尺寸参数」 → 生成 → 命名 → 放到 §12 表里指定的目录。

### 0.2 推荐调用参数（gpt-img-2）

> ⚠️ **重要**：gpt-img-2 的 **size 只支持 3 种值**，且 **没有独立的 `negative_prompt` 参数**。请务必先读 §17 看真实约束，再回来对照下面的"逻辑参数"做映射。

逻辑参数（你在 manifest 里填的）：

```json
{
  "model": "gpt-img-2",
  "prompt": "<STYLE_BASE> ... <资源 prompt> ... Avoid: <NEGATIVE_BASE>",
  "size": "<API 实际支持的 size，见 §17.1>",
  "background": "transparent",
  "quality": "high",
  "n": 1
}
```

- 角色 / 塔 / 怪物 / 投射物 / 特效：**`background: "transparent"`**
- 地图 / 漫画 / 立绘背景：**`background: "opaque"`**
- 负面词不是独立参数，必须以 `"Avoid: ..."` 形式拼到主 prompt 末尾（见 §17.2）。

### 0.3 同一动作多帧的做法

帧动画必须姿势连续。两种推荐做法（按支持情况选其一）：

- **方案 A**（首选）：用 gpt-img-2 的 **图像编辑 / inpaint** 功能：先生成第 1 帧 → 以第 1 帧为参考，用 `edit` 接口微调姿势生成第 2、3、4 帧，参考图保持一致。
- **方案 B**（无 reference 时）：在 prompt 里显式描述 **同一角色、同一服装、同一光照**，并给出当前帧的"姿势锁定关键词"（见各动作的 4 个 frame keyword）。

### 0.4 Reference-First 工作流（强烈推荐）

跨帧 / 跨贴图保持外观一致的唯一可靠方法：**先做参考图，再用参考图驱动后续所有生成**。

```
Step 1: 主参考表（master sheet）
  对每个角色 / 每种塔 / 每个 Boss / 每张地图，先生成 1 张「参考图」。
  这张图采用 1024×1024（角色 / 塔）或 1920×1080（地图），尽量信息密集：
    - 角色参考表：3 视图（正面 / 侧面 / 背面）+ 武器特写 + 配色色板
    - 塔参考表：3 等级正面 + 攻击姿态 + 配色色板
    - 怪物参考表：单只大尺寸正侧面 + 配色色板
  目的：让你和模型对「这只角色长什么样」有同一个视觉锚点。

Step 2: 全部下游图都以主参考表为 reference / image input
  使用 gpt-img-2 的 image-edit / image-to-image 接口，
  把主参考表当 reference_image，再用本文档里的 prompt 生成动作帧 / 等级帧。
  这样可以避免「同一角色 4 帧脸不一样」、「同一塔 L1 和 L3 完全不是同一座」。

Step 3: 每个动作的首帧也作为该动作其它帧的 reference
  例如生成 tiezhu-walk-02/03/04 时，把 tiezhu-walk-01 作为额外 reference，
  以保持姿势骨架风格一致。
```

实践要点：

- 主参考表 prompt 必须显式包含「neutral idle pose, three-quarter front view, plain neutral background」，方便后续抠出局部用作参考。
- 主参考表生成后请**人工审核 + 锁定**，不满意就重出，直到完全满意为止 — **后续所有图的质量上限由这一张决定**。
- 主参考表本身不入游戏包，只作为生产工具。

### 0.5 验收标准（生成完逐条核对，不达标重出）

| 类别 | 必须满足 |
|---|---|
| **画风** | 与 STYLE_BASE 描述一致（手绘奇幻、暖色、赛璐璐）。不是 3D 渲染、不是照片、不是像素风（除非明确要求） |
| **背景** | sprite 资源必须 100% 透明（无白边、无残余地面、无 drop shadow）。地图 / 漫画必须无 UI / 无文字 |
| **构图** | 角色 / 塔 / 怪物**完整可见**（不被画布边裁切），脚下中心对齐画布底边中点 |
| **朝向** | 英雄帧 facing right；怪物帧 facing left。**朝向错了必须重出**，禁止用代码 flip 临时补救 |
| **比例** | 角色实占高度在 §3 表格的范围内（误差 ±4 px 可接受） |
| **配色** | 与角色 LOCK 描述的配色一致（误差靠肉眼判断，差距明显则重出） |
| **同动作多帧** | 4 帧之间角色脸、服装、武器、配色完全一致；只姿势不同 |
| **跨等级塔** | L1 / L2 / L3 的底座必须像素级一致（如有偏移，可代码侧居中对齐，但禁止"换了一座塔"） |
| **文字 / 水印** | 一律禁止。出现任何字、Logo、签名都必须重出 |
| **多余元素** | sprite 上不应有道具 / 武器 / 角色之外的随机物体（如莫名其妙的小动物） |

### 0.6 常见失败模式与重出策略

| 失败 | 表现 | 原因 | 对策 |
|---|---|---|---|
| 残余背景 | 透明 PNG 边缘有白边 / 灰边 | 模型把背景画上了，alpha 不干净 | prompt 加 "isolated subject on pure transparent background, no environment, no ground plane"；或后处理用 `magick -fuzz 10% -transparent white` |
| 朝向反 | 怪物面向右（错） | prompt 优先级被武器描述抢走 | 在 prompt 开头第一句就强调 "FACING LEFT, body oriented to the LEFT side of canvas"，并放在 NEGATIVE_BASE 里加 "facing right" |
| 角色被裁 | 头顶或脚被切 | 角色画得太大或居中偏移 | prompt 加 "full body visible with 10 px margin on all sides; head fully inside canvas; feet on bottom 1/8 of canvas" |
| 跨帧人脸漂移 | 同一角色 4 帧脸不一样 | 没用 reference | 必须用 §0.4 reference-first 工作流 |
| 风格漂移 | 偶发 3D / 厚涂感 | STYLE_BASE 被覆盖 | 把 STYLE_BASE 放在 prompt **最前** + 在 NEGATIVE 里强化 "3d render, photo, thick oil paint" |
| 多人物 | 单角色 prompt 出了 2–3 个人 | prompt 没强调 single | 加 "EXACTLY ONE character in frame, no companions, no duplicates" |
| 文字水印 | 出现假签名 / 中文乱字 | 模型脑补排版 | NEGATIVE 加 "text, letters, asian characters, signature, watermark"；如仍不行降低质量等级再试 |
| 路径不连续（地图） | 路径中间断开或多分支 | 没强调 path geometry | 参考 §8.2 各章 PATH_GEOMETRY 描述强制路径走向 |
| 塔升级长不像 | L1→L3 像换了 3 座塔 | 没用 reference + 没强调 "based on L1 silhouette" | L2/L3 prompt 必须显式说 "based on the L1 base footprint, add upper structures only" + 把 L1 作为 reference |

### 0.7 透明背景兜底流程（gpt-img-2 偷懒时用）

`gpt-img-2` 在 `background: "transparent"` 模式下**经常偷懒**：把背景画成纯白 / 纯灰 / 浅色环境，**alpha 通道根本没抠**。如果连续 3 次重出仍然有背景，切换到本流程：

#### 0.7.1 第一步：主动要绿幕（chroma key）

把 `background` 改回 `"opaque"`，并在 prompt 末尾追加：

```
RENDER ON CHROMA KEY BACKGROUND: solid pure flat green color #00ff00
filling the ENTIRE canvas behind and around the subject. The green color
must be 100% uniform (no gradient, no shadow, no vignette, no painterly
variation) so it can be removed by chroma key. The subject must NOT
contain any green hue: replace any green elements in the design with a
near-equivalent color (e.g., teal #2a8a8a or olive #6a7a3a). Subject
edges should be sharp, no anti-alias halo blending into the green.
```

并把 NEGATIVE_BASE 临时加上：

```
green tint on subject, green spill on edges, gradient background,
vignette, painted background, environment, scene
```

#### 0.7.2 第二步：程序化抠图

用 ImageMagick / Pillow 把绿色去掉。**推荐用 `chromakey` 而不是 `transparent`，前者会处理边缘 spill**：

```powershell
# Windows PowerShell（ImageMagick 7）
# 简单版：精确等于纯绿才透明
magick in.png -fuzz 5% -transparent "#00ff00" -channel RGBA -alpha on out.png

# 进阶版：连同绿色边缘 spill 一起处理
magick in.png `
  -alpha set `
  -channel RGBA `
  -fuzz 12% -fill none -draw "matte 0,0 replace" `
  -fuzz 8% -transparent "#00ff00" `
  out.png
```

更稳的写法（用专门的 chroma key 算子，自动处理 anti-alias 半透明边缘）：

```powershell
magick in.png -colorspace HSL -channel G -separate +channel `
  -threshold 50% -negate -alpha copy in.png +swap `
  -compose CopyAlpha -composite out.png
```

或用 Python + `rembg` / `cv2` 做绿幕抠图（更智能，能处理头发等复杂边缘）：

```python
import cv2, numpy as np
img = cv2.imread("in.png")
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
# 绿幕 H 范围 ~50..70（OpenCV H 是 0..180）
mask = cv2.inRange(hsv, (40, 80, 80), (80, 255, 255))
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8))
alpha = 255 - mask
b, g, r = cv2.split(img)
# 去 green spill：把绿通道里超过红/蓝的部分压回去
g_capped = np.minimum(g, np.maximum(r, b))
out = cv2.merge([b, g_capped, r, alpha])
cv2.imwrite("out.png", out)
```

#### 0.7.3 哪些资源适合走绿幕兜底

| 资源 | 直接要透明 | 绿幕兜底 |
|---|:-:|:-:|
| 英雄 / 怪物动作帧 | 首选 | 备选（边缘头发、披风容易残留） |
| 塔 sprite | 首选 | 备选 |
| 投射物 / 火花 | **必须真透明** | ❌ 不要绿幕（additive blend 会染绿） |
| 光环 ring | **必须真透明** | ❌ 同上 |
| UI 按钮 / 图标 | 首选 | 备选 |
| 立绘 / 漫画 / 地图 | — | — opaque 不需要 |

> **重要**：投射物 / 火花 / 光环之类 **依赖 additive 叠加** 的资源**绝对不能走绿幕兜底**。即使抠掉绿色，半透明边缘的绿 spill 在游戏里 additive blend 时会变成可见绿光。这类资源如果模型给不出真透明，必须重出 prompt 直到出真 alpha。

#### 0.7.4 接收侧自动判断

收到一张图时按这个顺序判断：

1. **角点 alpha = 0** → 真透明，OK，直接归档。
2. **角点 alpha = 255 但颜色 = `#00ff00` ± 10%** → 绿幕兜底图，跑 §0.7.2 抠图后归档。
3. **角点 alpha = 255 但是其它颜色（白 / 灰 / 浅彩）** → 模型偷懒了，**重出**（不要尝试用 fuzz 抠白底，会把角色高光也抠掉）。

§16 的自检脚本里我也补了这套判断（见对应 §16.5 节）。

---

## 1. 全局风格基底 STYLE_BASE

> 所有 prompt 前面都要拼上这段。

```
STYLE_BASE = "Hand-drawn fantasy game art, warm color palette, soft cel-shading,
clean clear outlines, mild rim lighting, painterly textures, slight 2.5D top-down
perspective for sprites, consistent with classic JRPG and indie tower-defense
aesthetics; reference style: warm storybook illustration; no realism, no photo
texture; medium saturation, no neon."
```

风格关键词锁定表（生成时不要漂移）：

| 维度 | 必须 | 禁止 |
|---|---|---|
| 线稿 | clean dark outline 1–2px | sketchy, scribbled, multi-line |
| 上色 | flat cel-shading + 1 highlight + 1 shadow | airbrush, gradient soft blur |
| 色调 | warm palette, golden hour | desaturated grey, neon, pastel |
| 透视 | slight 3/4 top-down for units, side-view for hero portraits | strict pixel art, isometric |
| 细节密度 | medium, readable at 64–96 px | photoreal, hyper-detailed |

---

## 2. 全局负面 prompt NEGATIVE_BASE

```
NEGATIVE_BASE = "text, letters, words, asian characters, chinese characters,
japanese kana, watermark, signature, logo, copyright mark, frame, border,
speech bubble, caption,
blurry, out of focus, low quality, jpeg artifacts, compression artifacts,
photo, photorealistic, 3d render, octane render, plastic, cgi look,
multiple characters, twins, duplicate, crowd,
extra limbs, extra fingers, six fingers, deformed hands, missing hands,
mutated, ugly, dull, oversaturated neon, cyberpunk,
modern objects (smartphones, cars, guns, headphones, computers, sunglasses),
realistic drop shadow on ground, cast shadow, ground plane,
white background, gray background, color background (when transparent requested),
checker pattern, transparency checker,
visible canvas border, color frame, vignette."
```

> 提示：每个具体资源 prompt 还可以追加自己的局部负面词（如"facing right"对怪物）— 见各小节。

---

## 3. 输出参数表

| 资源类型 | size | background | 备注 |
|---|---|---|---|
| 英雄动作帧 | `96x96` | transparent | 角色实占高度 70–84 px |
| 英雄头像 | `128x128` | transparent | 头肩特写 |
| 英雄立绘 | `768x1024` | opaque | 用于商店 / 技能介绍 |
| 塔 L1 / L2 / L3 / attack / branch | `96x96` | transparent | 实占高 56 / 64 / 72 / 72 |
| 塔主立绘 | `256x256` | transparent | 图鉴用 |
| 普通怪物帧 | `64x64` | transparent | 实占 36–48 px |
| 精英怪物帧 | `80x80` | transparent | 实占 56 px |
| Boss 帧 | `128x128` | transparent | 实占 96 px |
| 怪物图鉴立绘 | `256x256` | transparent | 80% 高度 |
| 投射物 / 火花 | `32x32` 或 `48x48` | transparent | additive 混合用 |
| 章节地图 | `1920x1080` | opaque | 战场背景，路径要清晰 |
| 漫画单格 | `1024x1024` | opaque | 4 格一组，画风连贯 |
| 立绘（女王 / 夜噬） | `768x1024` | opaque | 主菜单 / 漫画引用 |
| UI 按钮 | `256x96` | transparent | 9-slice 友好 |
| UI 面板纹理 | `512x512` | opaque | 木纹平铺 |
| 图标 | `64x64` | transparent | 装备 / 技能用 |

### 3.1 像素级构图硬约束（每个 sprite prompt 都要拼上对应一条）

| 资源类型 | COMPOSITION_RULE |
|---|---|
| 英雄动作帧 96×96 | "Single character centered horizontally in the 96x96 canvas. Feet sit on the bottom row at canvas y=88..92. Top of head at y=8..14. Character total height 74..82 px. Weapon must stay fully inside the canvas; if the weapon would clip, scale character down. Leave at least 6 px transparent margin on the left and right sides at the widest point. Face is fully visible. No part of the body or weapon may touch the canvas edge." |
| 怪物 64×64 | "Single creature centered horizontally in the 64x64 canvas. Feet / belly on bottom row at canvas y=58..62. Top of head at y=8..14. Creature total height 40..48 px. Leave 4 px margin on each side. FACING LEFT (body angled toward the left side of canvas)." |
| 精英怪 80×80 | "Single creature centered. Feet at y=72..76. Top at y=12..16. Height 54..60 px. Leave 6 px side margin. FACING LEFT." |
| Boss 128×128 | "Single boss creature centered. Feet at y=118..124. Top at y=14..20. Height 94..104 px. Leave 8 px side margin. FACING LEFT (or facing forward for static intro splash)." |
| 塔 L1 96×96 | "Single tower structure centered. Base on bottom row at y=86..92. Top at y=28..38. Total tower height 52..60 px. Footprint width 56..64 px centered. No characters near the tower. No ground." |
| 塔 L2 96×96 | "Single tower structure centered. Base bottom row at y=86..92 (IDENTICAL to L1 base footprint). Top at y=20..28. Height 60..68 px. Same base width as L1." |
| 塔 L3 96×96 | "Single tower structure centered. Base bottom row at y=86..92 (IDENTICAL to L1 base footprint). Top at y=12..20. Height 68..76 px. Same base width as L1. Most ornate version of this tower." |
| 塔 attack | "Same silhouette and base as L3 but in the act of firing its main attack; visual effect must stay inside the 96x96 canvas." |
| 塔 分支 | "Same base footprint as L3, height 68..76 px. Distinct silhouette upgrade from L3 (one clearly different upper structure)." |
| 投射物 32×32 | "Single object centered, occupies 24..28 px on its longest axis. Oriented pointing to the RIGHT for projectiles that travel rightward; for symmetric effects orient radially. 4 px margin all sides." |
| 投射物 48×48 | "Single object centered, longest axis 36..42 px, 6 px margin all sides." |
| 火花 / 光环 64×64 | "Centered radial effect, fills 60..80% of canvas, fades to transparent at outer edge, no hard outline at the edge." |
| 章节地图 1920×1080 | "Top-down 3/4 painted battle map. The enemy path is a single continuous winding dirt road entering from the RIGHT edge (around y=300..700) and exiting at the LEFT edge (around y=200..600). Path width 60..100 px at this resolution. The path must not cross itself. Around the path leave 6..10 flat clearings (each ~120×120 px) where towers can be placed. No characters, no creatures, no UI." |
| 漫画分镜 1024×1024 | "Full painted scene. Characters fully visible, faces clear. No speech bubble, no caption, no panel border. Composition leaves clear focal point. Foreground and background readable separately." |
| 立绘 768×1024 | "Full-body character portrait. Character occupies center, head at y=80..160, feet at y=920..980. Slight painted soft-light background suggesting biome." |
| 头像 128×128 | "Head-and-shoulders portrait centered. Head fills 60..70% of canvas. Eyes at y=46..62. Transparent background." |
| UI 按钮 256×96 | "Centered horizontal button asset. Symmetric left-right; trim and rivets uniform. Center 192×72 area kept visually flat for future text overlay." |
| UI 面板 512×512 | "Seamlessly tileable pattern. No subject, no logo. Edges loop cleanly: left edge matches right edge, top edge matches bottom edge." |
| 图标 64×64 | "Single emblematic object centered, occupies 70..85% of canvas. Strong silhouette. No background gradient." |

---

## 4. 英雄角色帧

### 4.1 三位英雄角色基底（**CHARACTER_LOCK**）

每次生成英雄相关图，**必须把对应角色基底拼在 STYLE_BASE 之后**，保证跨帧外观一致。

#### 4.1.1 王铁柱 TIEZHU_LOCK

```
TIEZHU_LOCK = "Character: Wang Tiezhu, a stout middle-aged Chinese man, broad
shoulders, short black hair, full black beard with friendly weathered face,
wearing layered iron-plate armor over crimson tunic, red shoulder cape, brown
leather belt and boots, wielding a large two-handed iron warhammer with bronze
trim. Mood: stoic, brave, dependable. Color signature: deep blue armor #355b82,
warm bronze trim #bac7d4, crimson cloth #8b2a2a."
```

#### 4.1.2 王二狗 ERGOU_LOCK

```
ERGOU_LOCK = "Character: Wang Ergou, a lean wiry young Chinese man in his
twenties, sharp eyes, messy short brown hair, light leather armor with hood
half-down, fur-lined collar, fingerless gloves, brown leather boots, carries
a slim recurve bow on the back and a curved short sword at the hip. Mood:
cunning, agile, quick-witted. Color signature: warm leather brown #784c22,
golden trim #f0c062, off-white cloth."
```

#### 4.1.3 白月光 YUEGUANG_LOCK

```
YUEGUANG_LOCK = "Character: Bai Yueguang, a graceful young female mage with
long flowing silver-white hair tied loose, calm gentle face, wearing a long
blue-and-white robe with silver embroidery, wide sleeves, soft white inner
collar, holding a tall slender staff topped with a glowing pale moon crystal.
Mood: serene, scholarly, kind. Color signature: violet-blue #7a63c8, soft
white #f7ecff, silver accents."
```

### 4.2 第一步：生成英雄主参考表（每英雄 1 张，1024×1024）

> 这是后续 72 张动作帧的"母本"。**先把这 3 张做到满意再开工**，质量上限由这一张决定。

#### 4.2.1 王铁柱主参考表 `ref/tiezhu-master.png`

```
[STYLE_BASE]
[TIEZHU_LOCK]
Master reference sheet, 1024x1024 px, plain neutral light-grey background (#cccccc).
Layout: three character views from left to right, all standing at the same
ground line at y=900, same scale, neutral idle pose:
- Left third (x=0..341): three-quarter FRONT view, weapon held in right hand
  with hammer head resting on ground.
- Middle third (x=341..682): full SIDE view facing right, weapon at side, vertical.
- Right third (x=682..1024): three-quarter BACK view, weapon over right shoulder.
Below all three figures at y=940..1010, a slim horizontal color palette strip
with 6 square swatches (50x50 px each, evenly spaced) showing the character's
signature colors: deep blue #355b82, bronze trim #bac7d4, crimson cloth #8b2a2a,
leather brown, skin tone, hair black.
EXACTLY ONE character figure per view (three figures total = same person from three angles).
No text, no labels, no other characters.
[NEGATIVE_BASE]
```

#### 4.2.2 王二狗主参考表 `ref/ergou-master.png`

```
[STYLE_BASE]
[ERGOU_LOCK]
Master reference sheet, 1024x1024 px, plain neutral light-grey background (#cccccc).
Layout: three character views (front / side / back) standing at the same ground
line y=900, same scale, neutral idle pose.
- Front view: bow held diagonally across body in left hand; short curved sword
  visible at right hip.
- Side view (facing right): bow at left side, arrow not nocked.
- Back view: quiver of arrows visible, bow over shoulder.
Below figures at y=940..1010, 6-swatch color palette strip:
leather brown #784c22, gold trim #f0c062, off-white cloth, dark green hood lining,
skin tone, hair brown.
EXACTLY ONE character (same person from three angles).
No text, no labels, no other characters.
[NEGATIVE_BASE]
```

#### 4.2.3 白月光主参考表 `ref/yueguang-master.png`

```
[STYLE_BASE]
[YUEGUANG_LOCK]
Master reference sheet, 1024x1024 px, plain neutral light-grey background (#cccccc).
Three character views (front / side / back) at same ground line y=900.
- Front view: staff held vertical in right hand, base near right foot, moon
  crystal at top above shoulder.
- Side view (facing right): long sleeves slightly flowing.
- Back view: long silver-white hair detail, robe back embroidery visible.
Below figures at y=940..1010, 6-swatch color palette strip:
violet-blue #7a63c8, soft white #f7ecff, silver accent, pale moon crystal blue,
skin tone, hair silver-white.
EXACTLY ONE character (same person from three angles).
No text, no labels, no other characters.
[NEGATIVE_BASE]
```

### 4.3 第二步：用主参考表生成 72 张动作帧

每条 prompt 已经把 STYLE_BASE / CHARACTER_LOCK / COMPOSITION_RULE / NEGATIVE_BASE 全部就位，直接复制即可使用。

**调用约定**：
- 把对应英雄的 master ref 作为 image input / reference image。
- 同动作的 02/03/04 帧建议再追加 01 帧作为额外 reference。
- 帧间 **服装 / 配色 / 武器 / 脸型 必须完全一致**，只有姿势 / 道具位置变化。
- 同动作 4 帧画布尺寸完全相同（96×96），脚底着地 y 坐标相同。

**通用前缀（每条 prompt 都要拼上）**：

```
[STYLE_BASE]
[CHARACTER_LOCK — 取对应英雄的 LOCK]
[COMPOSITION_RULE — 取「英雄动作帧 96×96」]
Single character, FACING RIGHT, feet on bottom-center of canvas.
Output: 96x96 px, transparent background.
```

下文每条 prompt 用 `[HEAD-tiezhu]` / `[HEAD-ergou]` / `[HEAD-yueguang]` 代指对应英雄的「通用前缀」。每条 prompt 末尾默认追加 `[NEGATIVE_BASE]`。

#### 4.3.1 walk（4 帧）— 文件名 `{hero}-walk-{NN}.png`

**`tiezhu-walk-01.png`**：
```
[HEAD-tiezhu]
ACTION: walking cycle frame 1 of 4. Left foot planted forward, right foot
behind lifted ~12 px off ground. Weight on left leg. Body slightly rotated
3/4 toward viewer. Left arm hangs forward relaxed, right arm holds the
warhammer head-down at right side, hammer shaft near-vertical. Calm forward
gaze.
```

**`tiezhu-walk-02.png`**：
```
[HEAD-tiezhu]
ACTION: walking cycle frame 2 of 4. Feet passing each other (both near center,
right foot toe just leaving ground). Body bobbing slightly upward by 2 px.
Hammer still at right side, shaft swinging slightly back. Same neutral
expression.
```

**`tiezhu-walk-03.png`**：
```
[HEAD-tiezhu]
ACTION: walking cycle frame 3 of 4. Mirror of frame 1: right foot planted
forward, left foot behind lifted ~12 px. Weight on right leg. Hammer swung
slightly forward at right side.
```

**`tiezhu-walk-04.png`**：
```
[HEAD-tiezhu]
ACTION: walking cycle frame 4 of 4. Feet passing each other, body dipping
slightly downward by 2 px. Transition pose preparing to loop to frame 1.
Hammer settling back to neutral right-side position.
```

**`ergou-walk-01.png` ~ `ergou-walk-04.png`**：与王铁柱 walk 同步姿势节奏，但替换：
- `[HEAD-tiezhu]` → `[HEAD-ergou]`
- 把每帧 "warhammer head-down at right side, hammer shaft" 全部替换为 "recurve bow held loosely in left hand at left side, bow not drawn, no arrow nocked"
- 帧 03/04 弓的轻微摆动方向对应步伐变化。

**`yueguang-walk-01.png` ~ `yueguang-walk-04.png`**：
- `[HEAD-tiezhu]` → `[HEAD-yueguang]`
- 把武器描述换为 "tall slender staff held vertical in right hand, base of staff near right foot, glowing pale moon crystal at top above shoulder"
- 每帧袍摆下沿轻微摆动 ~3 px。

#### 4.3.2 run（4 帧）— `{hero}-run-{NN}.png`

**`tiezhu-run-01.png`**：
```
[HEAD-tiezhu]
ACTION: running cycle frame 1 of 4. Long stride: right knee lifted high to
chest level, left leg fully extended back almost straight with only toe
touching ground. Body leaning forward 15 degrees. Red cape flowing back
horizontally to the LEFT. Warhammer gripped tight in right hand at right
hip, pointing back-and-down.
```

**`tiezhu-run-02.png`**：
```
[HEAD-tiezhu]
ACTION: running cycle frame 2 of 4. Airborne apex: both feet off ground,
knees crossing near each other. Body still leaning forward 15 degrees. Red
cape and black hair streaming back horizontally. Hammer steady at right hip.
```

**`tiezhu-run-03.png`**：
```
[HEAD-tiezhu]
ACTION: running cycle frame 3 of 4. Mirror of frame 1: left knee lifted high
to chest, right leg extended back, only toe touching ground. Body still
leaning forward. Cape mid-flow.
```

**`tiezhu-run-04.png`**：
```
[HEAD-tiezhu]
ACTION: running cycle frame 4 of 4. Airborne moment mirrored: both feet off
ground, knees crossing. Cape settling mid-air.
```

**`ergou-run-01..04.png`**：步幅稍大、身姿轻盈，弓紧握靠胸前，小披风后扬。  
**`yueguang-run-01..04.png`**：长袍下摆奔跑时飘起 ~16 px，长发后扬，法杖紧贴右肩斜抓。

#### 4.3.3 attack（4 帧，**第 3 帧 = 武器伸到最远**）— `{hero}-attack-{NN}.png`

> 第 3 帧"PEAK"是代码侧投射物生成的时机帧，**武器/法术必须伸到画布右侧最远处**。

**`tiezhu-attack-01.png`（蓄力）**：
```
[HEAD-tiezhu]
ACTION: hammer attack frame 1 of 4 (windup). Warhammer raised high overhead
with both hands gripping the shaft, hammer head pointing up-and-slightly-back.
Body coiled, weight on back foot (left), front foot (right) lightly planted.
Determined face. Hammer head must stay inside the canvas, top of hammer at
y=4..10.
```

**`tiezhu-attack-02.png`（中段）**：
```
[HEAD-tiezhu]
ACTION: hammer attack frame 2 of 4 (mid-swing). Hammer arcing forward and
downward, currently at "1 o'clock" position (upper-right of body at ~45 deg).
Both hands still on grip. Body shifting weight forward.
```

**`tiezhu-attack-03.png`（PEAK 命中帧）**：
```
[HEAD-tiezhu]
ACTION: hammer attack frame 3 of 4 (PEAK reach). Hammer fully extended
horizontally forward at chest height. Hammer HEAD must be at the
FRONT-RIGHT of canvas at approximately x=78..88, y=44..56. Body fully
forward, front leg deep bent. Small puff of dust at the hammer impact point.
THIS IS THE MOMENT PROJECTILES SPAWN — hammer head must be the rightmost
visible element.
```

**`tiezhu-attack-04.png`（收招）**：
```
[HEAD-tiezhu]
ACTION: hammer attack frame 4 of 4 (recovery). Hammer lowered to knee
level at right side, body returning to neutral upright stance, breath
catching. Small residual dust around hammer.
```

**`ergou-attack-01..04.png`** — 拉弓 / 张满 / 放箭 / 收：
- 01：侧身，张弓搭箭至右耳边。
- 02：弓弦完全拉满，弓体弯曲明显，眼神聚焦。
- 03：**PEAK**：箭飞出，箭头位于 x=84..92 / y=44..52，弓弦回弹波纹，身体微后坐。
- 04：弓臂放下，右手摸向腰间箭袋。

**`yueguang-attack-01..04.png`** — 凝聚 / 符文旋转 / 放出月光 / 余晖：
- 01：法杖斜举，左手在胸前凝聚白色小光球。
- 02：法杖顶端月晶发亮，3 个银色符文环绕，眼神专注。
- 03：**PEAK**：法杖向右前方推出，月光束从晶体射出，光束头位于 x=86..94 / y=40..52，袍角后扬。
- 04：法杖收回，残余银色粒子飘散。

#### 4.3.4 cast（4 帧，主动技能）— `{hero}-cast-{NN}.png`

**王铁柱 重击 `tiezhu-cast-01..04.png`**：
- 01：锤子触地，双手握柄，半蹲，金色能量在锤面聚集。
- 02：锤子微抬，锤面出现金色裂纹，眼睛淡金色发光。
- 03：**PEAK**：锤子向前下方猛砸，金色冲击波从落点（x=70..90, y=72..88）爆开半圆形扩散。
- 04：锤子收回肩头，金色粒子消散。

**王二狗 三连射 `ergou-cast-01..04.png`**：
- 01：弓拉满，3 支箭呈扇形夹在指间。
- 02：第 1 支箭飞出（已离画布右侧），剩 2 支在弦上。
- 03：第 2 支箭飞出，第 3 支仍在弦，动态线明显。
- 04：第 3 支射出，弓空，右手伸向箭袋，嘴角上扬。

**白月光 月光普照 `yueguang-cast-01..04.png`**：
- 01：法杖斜倚右侧，左手掌心向上聚集白光。
- 02：左掌上方形成小月亮（直径 ~12 px），微笑。
- 03：**PEAK**：巨大半透明月盘在头顶展开（占画布上半部 y=8..50），柔白光覆盖周身，袍角飘动。
- 04：月盘消散，光粒如雪片飘落。

> 将以上简述转成完整 prompt 时，沿用 4.3.3 的格式：`[HEAD-{hero}]` + `ACTION: ... frame N of 4 (描述)。具体姿势、道具位置、特效像素坐标范围。`

#### 4.3.5 ultimate（4 帧，连击大招演出）— `{hero}-ultimate-{NN}.png`

**王铁柱 `tiezhu-ultimate-01..04.png`**：
- 01：高高跃起（脚部位于 y=20..30），锤举过头顶，背后金色阳光放射状光线。
- 02：空中顶点，锤拉到身后如陨石，怒吼。
- 03：**PEAK**：锤砸地，巨大金色冲击波环向外扩散（半径覆盖大半画布），扬起浓尘环，英雄英姿落地。
- 04：从冲击坑中站起，锤拖烟尘，碎屑落定。

**王二狗 `ergou-ultimate-01..04.png`**：
- 01：侧身翻滚，翻滚中拉弓。
- 02：起身瞬间，弓上箭已搭好。
- 03：**PEAK**：5 支发光金色箭呈扇形齐射飞出（5 道金色箭迹从英雄向右扇形发散）。
- 04：弓垂下，露出狡黠笑，残影箭迹未散。

**白月光 `yueguang-ultimate-01..04.png`**：
- 01：法杖高举，闭眼凝神。
- 02：脚下展开巨大符文圆（占画布下半 y=60..92），长发被魔法风吹起。
- 03：**PEAK**：天降巨大苍白月光柱（占画布中央 x=36..60 上下贯穿）罩住英雄，长袍光辉飘动。
- 04：光柱消散，缓缓放下法杖，温柔微笑。

#### 4.3.6 defeated（4 帧，倒地）— `{hero}-defeated-{NN}.png`

| 帧 | 文件名后缀 | 姿势描述 |
|---:|---|---|
| 01 | `-defeated-01` | 单膝软倒，武器从手中滑落，头低垂。身体仍直立但向前倾 20 度。 |
| 02 | `-defeated-02` | 单膝跪地，以武器撑地（撑地点位于身体右侧），喘息。 |
| 03 | `-defeated-03` | 侧身倒下，武器横落在身旁，半闭眼。整体身体水平横躺在画布下半 y=60..88。 |
| 04 | `-defeated-04` | 完全侧躺，武器在旁，身体上方淡淡的灵魂光（提示复活倒计时），整体轮廓淡化至 60% 不透明度。 |

完整 prompt 示例（王铁柱第 1 帧）：

```
[HEAD-tiezhu]
ACTION: defeated frame 1 of 4. Tiezhu's left knee buckling, body folding
forward 20 degrees, warhammer slipping from his right hand toward the
ground, head lowered. Pained expression. Hammer should be falling near his
right foot, still inside the canvas.
[NEGATIVE_BASE]
```

### 4.4 英雄头像（128×128，每英雄 1 张）— `src/assets/heroes/{hero}.png`

**`tiezhu.png` 头像**：
```
[STYLE_BASE]
[TIEZHU_LOCK]
[COMPOSITION_RULE — 取「头像 128×128」]
Head-and-shoulders portrait, three-quarter view facing slightly right,
friendly confident expression with slight smile, chin slightly raised, eyes
looking toward viewer. Soft warm rim light from upper-left. Transparent
background.
Output: 128x128 px, transparent background.
[NEGATIVE_BASE]
```

**`ergou.png` 头像**：同上替换 LOCK 为 `ERGOU_LOCK`，表情改为 "slight smirk, sharp focused eyes, eyebrow slightly raised"。  
**`yueguang.png` 头像**：替换 LOCK 为 `YUEGUANG_LOCK`，表情改为 "serene gentle smile, calm half-closed eyes, peaceful demeanor"。

### 4.5 英雄立绘（768×1024）— `src/assets/portraits/heroes/{hero}.png`

**`tiezhu.png` 立绘**：
```
[STYLE_BASE]
[TIEZHU_LOCK]
[COMPOSITION_RULE — 取「立绘 768×1024」]
Full body hero portrait. Slight low-angle heroic stance, warhammer planted
on ground in front of him with both hands resting on the hammer pommel,
chin slightly up, confident expression. Painted soft background: sunset-lit
castle wall with hanging red royal banner, warm orange backlight from the
right, ambient haze. Character occupies center of canvas, head at y=80..160,
feet at y=920..980. Hammer touches the ground at y~970.
Output: 768x1024 px, opaque background.
[NEGATIVE_BASE]
```

**`ergou.png` 立绘**：背景改为 "sun-dappled forest path at dawn, scattered green leaves drifting, soft golden god-rays through trees"。姿势 "left foot resting on a low log, bow casually slung over right shoulder, hand on hip with a confident smirk"。  
**`yueguang.png` 立绘**：背景改为 "arcane library interior, floating glowing runic books behind her, soft pale moonlight streaming through tall arched window from the upper-left"。姿势 "staff held vertical in right hand at her side, left hand gently raised palm-up with a small floating moon-orb hovering above"。

---

## 5. 防御塔

> 每种塔产线流程：先生成 256×256 主立绘作为参考 → 用主立绘当 reference 生成 L1 → 把 L1 当 reference 生成 L2 / L3 / attack / branch。**这样 5 张图属于同一座塔**。

### 5.1 塔通用前缀

```
[STYLE_BASE]
[COMPOSITION_RULE — 取「塔 {阶段} 96×96」]
A defensive tower for a fantasy tower-defense game, 3/4 top-down view,
single structure centered in 96x96 canvas, NO ground plane, NO drop shadow,
NO characters, NO UI. Clean readable silhouette suitable for small game
display, exaggerated proportions for legibility at 64–96 px.
Output: 96x96 px, transparent background.
```

下文 `[HEAD-tower]` 代指这段前缀。每条 prompt 末尾默认追加 `[NEGATIVE_BASE]`。

### 5.2 各塔基底（**TOWER_LOCK**）

| towerId | TOWER_LOCK |
|---|---|
| `arrow` | "An archer's wooden watchtower built from sturdy oak logs and brown wood shingles, hexagonal log base, raised wooden platform with crenellation, oversized racks of bows leaning on the platform. Color signature: warm wood brown #8b5a2b, weathered grey shingles, dark green cloth accents." |
| `mage` | "An arcane stone tower made of pale carved sandstone with faintly glowing blue runes etched on its surface, narrow vertical spire, a floating blue crystal hovering above the top. Color signature: pale sandstone #d8c9a2, glowing rune blue #7ab8ff, deep navy capstone." |
| `artillery` | "A short stout dwarven cannon turret, riveted iron plates, brass barrel pointing upward, wooden scaffolding around the body, brass gear details, small exhaust smoke curl. Color signature: dark iron grey, brass #c98a3a, oak wood." |
| `barracks` | "A small wooden barracks fort, raised palisade log walls, single banner flag on top, training dummies visible at base, sturdy oak gate. Color signature: warm wood brown, red banner cloth, dark iron rivets." |
| `flame` | "An obsidian flame tower, dark volcanic stone with cracks glowing red-orange, an iron brazier filled with fire at the top, soot stains on the stone. Color signature: black obsidian #1a1614, glowing magma orange #ff6b2a, dull iron." |
| `frost` | "An ice crystal tower, pale blue-white translucent crystals jutting upward, frost ring at the base, gentle snow particles drifting around. Color signature: pale icy blue #b8d9ff, deep glacier blue #4a78a8, white snow." |
| `altar` | "A sacred altar shrine of warm white marble with gold trim, small floating golden sun-disc above the top, garlands of golden ribbons draped, soft amber glow at base. Color signature: ivory marble #f7eed8, royal gold #f2ca73, soft amber glow." |
| `gold` | "A coin-stack treasury tower, ornate brass casing with embossed coin imagery on each tier, small open treasure chest at the base spilling coins, sparkles in the air. Color signature: bright gold #ffd25a, brass #c98a3a, ruby red gem accents." |

### 5.3 第一步：塔主立绘（256×256）— `src/assets/towers/{towerId}.png`

主立绘作为该塔的"母本参考"。生成 8 张（每塔 1 张）。

**示例（arrow 塔）`arrow.png`**：
```
[STYLE_BASE]
[TOWER_LOCK — arrow]
Hero shot of the tower, dramatic 3/4 view, soft painterly base mist, no
scene background but a gentle radial warm light to suggest importance.
The L3-style ornate version of the tower (banners and racks fully visible).
Output: 256x256 px, transparent background, tower occupies 80% of canvas
height, base centered at the bottom.
[NEGATIVE_BASE]
```

其余 7 个塔同模板，仅替换 `[TOWER_LOCK]`。

### 5.4 第二步：等级帧（L1 / L2 / L3 / attack）— 每塔 4 张

> **关键**：必须以该塔主立绘为 reference，且 L2/L3 必须再加 L1 作为额外 reference，让底座保持像素级一致。

**L1 通用 prompt（替换 `[TOWER_LOCK]`）**：
```
[HEAD-tower — 取塔 L1 96×96 构图规则]
[TOWER_LOCK — 取对应塔]
STAGE: Level 1 (basic / freshly built). Minimal decoration: single tier,
raw materials visible, no banners, no glowing runes yet, modest scale.
Total tower height 52..60 px, base width 56..64 px centered.
Important: this base footprint and silhouette will be REUSED for L2/L3/attack;
make it a clean simple silhouette.
Output: 96x96 px, transparent background.
[NEGATIVE_BASE]
```

**L2 通用 prompt**：
```
[HEAD-tower — 取塔 L2 96×96 构图规则]
[TOWER_LOCK — 取对应塔]
STAGE: Level 2 (improved / reinforced). KEEP the L1 base footprint and
lower half IDENTICAL (same logs / stones / scaffolding at the bottom 30 px).
ADD: one extra tier on top, decorative banner or trim ribbon, slight
glowing accent if magical (small rune or ember), more refined paint.
Total tower height 60..68 px, base width same as L1.
Output: 96x96 px, transparent background.
[NEGATIVE_BASE]
```

**L3 通用 prompt**：
```
[HEAD-tower — 取塔 L3 96×96 构图规则]
[TOWER_LOCK — 取对应塔]
STAGE: Level 3 (mastered / ornate). KEEP the L1 base footprint and lower
half IDENTICAL. ADD: ornate upper decorations: full banners, glowing runes,
crystals, brass trim, or a brazier - matching the tower's theme. Most
visually impressive form of this tower while still readable.
Total tower height 68..76 px, base width same as L1.
Output: 96x96 px, transparent background.
[NEGATIVE_BASE]
```

**attack 通用 prompt（每塔不同的攻击姿态）**：
```
[HEAD-tower — 取塔 attack 构图规则]
[TOWER_LOCK — 取对应塔]
ATTACK POSE: same silhouette and base footprint as L3, but in the act of
firing its main attack. <ATTACK_VFX>. Visual effect must stay fully INSIDE
the 96x96 canvas (no clipping). Total tower height 68..76 px.
Output: 96x96 px, transparent background.
[NEGATIVE_BASE]
```

各塔的 `<ATTACK_VFX>` 替换片段：

| towerId | ATTACK_VFX |
|---|---|
| `arrow` | "A wooden archer figure on the platform with bowstring fully drawn back, arrow ready to release, motion lines from the bow." |
| `mage` | "A bright blue rune circle bursting open at the crystal level, energy radiating outward, crystal shining brilliantly." |
| `artillery` | "A bright muzzle flash blooming from the brass barrel, smoke ring at the muzzle, slight recoil tilt on the barrel." |
| `barracks` | "A guardsman figure standing on the platform mid-swing of a sword, motion line behind the blade, banner fluttering." |
| `flame` | "A large fire-tongue erupting forward from the brazier, embers spraying out, brazier glowing white-hot." |
| `frost` | "A pulse of pale icy-blue ring expanding outward from the upper crystal, snowflake particles scattering." |
| `altar` | "A golden pulse wave radiating outward from the sun-disc, garlands fluttering in the wave." |
| `gold` | "A shower of gold coins spraying upward from the treasure chest, sparkles and shine." |

### 5.5 分支升级（4 级分支，96×96）

每个分支沿用 L3 base footprint，仅替换上半部分：

**通用 prompt**：
```
[HEAD-tower — 取塔 分支 96×96 构图规则]
[TOWER_LOCK — 取对应塔]
STAGE: Level 4 BRANCH variant. KEEP the L3 base footprint and lower half
IDENTICAL. REPLACE the upper structures with the variant's signature:
<BRANCH_DESC>. The branch must be visually distinguishable from L3 at a
glance. Total tower height 68..76 px.
Output: 96x96 px, transparent background.
[NEGATIVE_BASE]
```

完整分支列表（`<BRANCH_DESC>` 替换）：

| 文件名 | BRANCH_DESC |
|---|---|
| `arrow-branch-burst.png` | "explosive-arrow variant: explosive bombs strapped on the bow rack, red-orange flame-feather fletching on visible arrows, scorched wood near the rack" |
| `arrow-branch-hawk.png` | "hawkeye variant: a precision crossbow mounted on top with a brass scope lens, blue-feathered arrows in a sleek quiver, narrower silhouette" |
| `mage-branch-arcane.png` | "arcane variant: 3 floating purple rune tablets orbiting the upper spire, the main crystal glowing brighter purple" |
| `mage-branch-meteor.png` | "meteor variant: a large fiery red-orange orb orbiting above the spire, scorch marks on the spire, ember particles around" |
| `artillery-branch-rapid.png` | "rapid-fire variant: twin shorter brass cannons mounted side by side on a rotating gear platform" |
| `artillery-branch-shrapnel.png` | "shrapnel variant: a single oversized cannon barrel with a flared bell-shaped muzzle, rack of shrapnel rounds visible at the base" |
| `barracks-branch-veteran.png` | "veteran variant: gold-trimmed crimson banner on top, captain's plumed helmet displayed on a stand, polished stone base inset into the wood" |
| `barracks-branch-reserve.png` | "reserve variant: doubled palisade ring, two banners on top, larger reinforced oak gate at the base" |
| `flame-branch-inferno.png` | "inferno variant: a massive iron bowl of liquid fire on top instead of a brazier, deep magma cracks running down the stone body" |
| `flame-branch-wildfire.png` | "wildfire variant: three smaller fire braziers arranged around the upper spire, ember sparks flying outward in arcs" |
| `frost-branch-glacier.png` | "glacier variant: a massive solid ice block as the core, jagged crystal armor plates around the body, frost mist heavier" |
| `frost-branch-blizzard.png` | "blizzard variant: a swirling snow vortex around the upper crystal, smaller ice shards orbiting in the vortex" |
| `altar-branch-radiance.png` | "radiance variant: a brighter golden sun-disc with an outer golden halo ring, marble base inscribed with glowing runes" |
| `altar-branch-tempo.png` | "tempo variant: a spinning gold ring orbiting around the sun-disc, faint motion lines suggesting rapid rotation" |
| `gold-branch-fortune.png` | "fortune variant: an overflowing treasure chest at the base with coins spilling outward in waves, a large four-leaf clover decoration on the front of the chest" |

### 5.6 八塔具体示例（arrow L1，可直接用）

```
[STYLE_BASE]
[COMPOSITION_RULE — 「塔 L1 96×96」]
[TOWER_LOCK — arrow]
A defensive tower for a fantasy tower-defense game, 3/4 top-down view,
single structure centered, NO ground plane, NO drop shadow, NO characters,
NO UI. Clean readable silhouette for small game display.
STAGE: Level 1 (basic / freshly built). Minimal decoration: single tier,
raw oak logs visible, no banners, modest scale. Total tower height 56 px,
base width 60 px centered. Footprint will be reused for L2/L3/attack.
Output: 96x96 px, transparent background.
[NEGATIVE_BASE]
```

---

## 6. 怪物

> 流程：先为每只怪生成 1 张 256×256 portrait 作为母本参考 → 用 portrait 当 reference 生成 walk-01 → 把 walk-01 当 reference 生成 walk-02..04 / attack-01..03 / death-01..03。

### 6.1 怪物通用前缀

```
[STYLE_BASE]
[MONSTER_LOCK — 取对应族系]
[COMPOSITION_RULE — 取「怪物 {size}」对应行]
Single creature centered, 3/4 top-down side view, FACING LEFT
(body angled toward the left side of canvas, head on the left half).
Transparent background, NO ground plane, NO drop shadow, NO scene,
NO companions. Clean game-sprite silhouette readable at small size.
Output: {64x64 | 80x80 | 128x128} px, transparent background.
```

下文 `[HEAD-monster]` 代指此前缀。每条末尾默认追加 `[NEGATIVE_BASE]`，并在 negative 里**额外加 "facing right"**。

### 6.2 怪物族系基底（**MONSTER_LOCK**）

| sheet | 适用 tier | MONSTER_LOCK |
|---|---:|---|
| 萌怪01 | 1–3 | "Cute fluffy fantasy creature, round body, large expressive eyes, soft pastel-warm colors, marshmallow / hamster aesthetic, harmless adorable look. Palette: cream, pink, sky blue, butter yellow." |
| 萌怪02 | 2–4 | "Cute mid-size fantasy critter, slightly mischievous face, wind-spirit / flower-sprite aesthetic, small horns or leaves, soft warm colors. Palette: mint green, lavender, pale gold." |
| 萌怪03 | 4–6 | "Mid-tier mythic creature with stronger silhouette: mechanical, dragonkin, or jellyfish-king aesthetic, glowing eyes, partial armor or plates. Palette: brass, deep teal, crystal blue, dark navy." |
| 萌怪04 | 6–8 | "Greasy meat-monster: sausage-like body, centipede sections, or bulldog mass. Oily glistening skin highlights, vaguely gross but stylized. Palette: warm beige, pink, oily brown, sickly yellow." |
| 萌怪05 | 1–3 | "Cartoon pixel-style cute creature with simple shapes (blob / ghost / critter), pure-color blocks, child-friendly silhouette. Palette: bright yellow, pure white, pure blue, pure pink." |
| 萌怪06 | 8–10 | "Fierce dark fantasy beast: sharp teeth, tattered fur, glowing red or purple eyes, ominous silhouette, dramatic high-contrast lighting. Palette: shadow black, blood red, void purple, dim grey." |
| 萌怪08 | 3–5 | "Stylized creature with attached visual effect (lightning sparks, fire embers, magic wisps). Candy-cannon / magical-wisp aesthetic, vibrant accent color glow around the body. Palette: candy pink + electric yellow, or ember orange + dark grey." |

### 6.3 单只怪物完整 prompt（按 tier 列出，每只可直接复制）

> 每只怪需生成：1 张 portrait（256×256，图鉴用）+ 4 帧 walk + 3 帧 attack + 3 帧 death = 11 张。
> 文件落点：`src/assets/enemies/{monsterId}/`。

#### 6.3.1 Tier 1（萌怪01 族，64×64）

**`m01-marshmallow-rabbit/portrait.png`（256×256）**：
```
[STYLE_BASE]
[MONSTER_LOCK — 萌怪01]
Portrait of a single marshmallow rabbit creature, 3/4 view facing forward,
soft amber radial backlight, transparent background, NO ground, NO scene.
Specific creature: a fluffy round-bodied rabbit creature, two long floppy
ears, sky-blue belly patch, big black bead eyes, soft pink nose, tiny
white paws, friendly hopping stance.
Output: 256x256 px, transparent background, creature occupies 80% of
canvas height.
[NEGATIVE_BASE]
```

**`m01-marshmallow-rabbit/walk-01.png`**：
```
[HEAD-monster — 萌怪01, 64×64]
Specific creature: a fluffy round-bodied rabbit creature, two long floppy
ears, sky-blue belly patch, big black bead eyes, soft pink nose, tiny white
paws. FACING LEFT.
ACTION: walk cycle frame 1 of 4. Left front paw planted on the ground,
right paw lifted ~6 px, body slightly bobbing up. Ears trailing slightly
back. Friendly hopping motion.
[NEGATIVE_BASE, plus "facing right"]
```

walk-02..04 / attack-01..03 / death-01..03 按 §6.4 的"通用动作描述"替换 ACTION 段即可。

**`m01-cotton-puff/portrait.png`**：
> Specific creature: a cotton-puff sprite, a round fluffy ball of white cotton-like fur, two small green leaf hands attached at the sides, two thin twig legs at the bottom, closed-eye smiling face with rosy cheeks, a small dandelion seed feather floating above its head.

#### 6.3.2 Tier 2（萌怪02 族，64×64）

**`m02-hyacinth-sprite/portrait.png`**：
> Specific creature: a small flower-sprite with a hyacinth blossom (purple-pink clustered petals) forming a hat/headdress, slender green vine arms with tiny three-fingered leaf hands, a layered leaf skirt around the waist, mischievous half-smile, two tiny black bead eyes, pale mint-green skin.

**`m02-honey-snail/portrait.png`**：
> Specific creature: a snail with a glossy golden honey-glazed spiral shell (~70% of body), soft cream-colored body trail, slow contented smile, two antennae with tiny black bead eyes on the tips, faint amber honey drip from the shell rim.

**`m02-mushcap-imp/portrait.png`**：
> Specific creature: a small impish creature with a red-and-white spotted toadstool mushroom cap as a hat (covering top half of head), pale green skin, pointed ears, mischievous fanged grin, small bare feet, holding a tiny twig in one hand.

#### 6.3.3 Tier 1–3（萌怪05 族，64×64，简单卡通）

**`m05-blob-yellow/portrait.png`**：
> Specific creature: a perfectly round bright-yellow blob (pure flat color), two simple black dot eyes, a wide simple curved black smile mouth, no limbs, slight gloss highlight on upper-left.

**`m05-ghost-kid/portrait.png`**：
> Specific creature: a small pure-white cartoon ghost child, rounded body shape tapering to a slight wavy tail at the bottom (no legs), two small stub arms at the sides, friendly closed-eye smiling face with rosy cheeks, semi-transparent edges.

**`m05-pink-slime/portrait.png`**：
> Specific creature: a round pink slime, smooth glossy surface with a few tiny inner bubbles visible, two black dot eyes, small cheerful open-mouth smile showing a tiny tongue.

#### 6.3.4 Tier 3–5（萌怪08 族，80×80，带特效）

**`m08-candy-cannoneer/portrait.png`（256×256 portrait）**：
```
[STYLE_BASE]
[MONSTER_LOCK — 萌怪08]
Portrait of a candy-cannoneer creature, 3/4 view, transparent background.
Specific creature: small round pink-and-cream body with stubby legs, a
striped candy-cannon barrel (red and white spiral) mounted on its back,
pink smoke puff at muzzle, big black bead eye, cheery expression.
Output: 256x256 px, transparent background.
[NEGATIVE_BASE]
```

**`m08-spark-wisp/portrait.png`**：
> Specific creature: a semi-transparent blue-white floating wisp, brighter glowing core in the center, 5 small lightning sparks orbiting around it in a halo pattern, no limbs, faint electric crackle trails.

**`m08-flame-sprite/portrait.png`**：
> Specific creature: a small fire-sprite floating slightly above the ground (no legs), orange-red flickering flame body shape, taller flame mane on top, glowing yellow-orange eyes, tiny ember particles trailing behind, body partially translucent at edges.

#### 6.3.5 Tier 4–6（萌怪03 族，80×80，中阶）

**`m03-clockwork-knight/portrait.png`**：
> Specific creature: a small mechanical knight, brass-plated armor body with rivets, a large bronze wind-up key sticking out of its back, glowing blue eye-slit in helmet, short stubby legs, holding a tiny iron spear in one hand, faint steam puff from a shoulder vent.

**`m03-crystal-dragonling/portrait.png`**：
> Specific creature: a juvenile dragon, body covered in jagged blue-green crystal scales catching the light, small webbed wings half-spread, fierce yellow eyes with vertical pupils, front claws raised, short snout with two small horns, slender lashing tail.

**`m03-jelly-king/portrait.png`**：
> Specific creature: a regal jellyfish king, translucent pale-blue dome body (~60% of figure), a tiny golden crown floating just above the dome, 5 long trailing tentacles drifting below in graceful curves, two small dark eye-spots inside the dome.

#### 6.3.6 Tier 6–8（萌怪04 族，80×80，精英）

**`m04-grease-slime/portrait.png`**：
> Specific creature: a large oily cream-colored slime with pink and brown gloss highlights, two big drooping sad yellow eyes, downturned wide mouth, dripping liquid trails on its surface, irregular bulbous shape (not perfectly round).

**`m04-meat-centipede/portrait.png`**：
> Specific creature: a sausage-link style centipede with 6 distinct pink segmented body links, each segment has 2 short stubby legs underneath (12 legs total), small triangular head with a pair of black bead eyes and a small open mouth showing tiny teeth, slight oily sheen.

**`m04-lard-bulldog/portrait.png`**：
> Specific creature: a bulky greasy bulldog creature, sagging jowls dripping drool, thick stubby legs, hunched shoulders, lazy snarl showing yellowish teeth, beige-pink oily skin with darker brown patches, droopy eyes.

#### 6.3.7 Tier 8–10（萌怪06 族，80×80 精英 / 128×128 Boss）

**`m06-shadow-wolf/portrait.png`（128×128）**：
```
[STYLE_BASE]
[MONSTER_LOCK — 萌怪06]
Portrait of a shadow wolf, 3/4 view, transparent background, dramatic
purple rim light from behind.
Specific creature: large hulking wolf with tattered black fur, purple
smoke trailing off its shoulders, glowing red eyes, fanged open snarl,
ribs faintly visible, claws gripping the ground.
Output: 128x128 px, transparent background, creature occupies 90% of
canvas height.
[NEGATIVE_BASE]
```

**`m06-void-stalker/portrait.png`（128×128）**：
> Specific creature: a tall thin humanoid stalker, semi-transparent inky-black body (silhouette visible through it), four glowing purple eyes arranged vertically on its faceless head, long jagged claws on each hand, no feet (drifts ~5 px above ground in a wisp of dark mist), ghostly elongated proportions.

**`m06-yeshi-boss/portrait.png`（256×256）**：见 §6.4 章节 Boss。

### 6.4 章节 Boss 专属（128×128 战斗帧 + 256×256 splash 立绘）

每个章节 Boss 需要：portrait 256×256 + walk 4 帧 128×128 + attack 4 帧 128×128 + death 4 帧 128×128。

| Boss | 章节 | 文件夹 | 描述 |
|---|---:|---|---|
| 边境暴熊 | 1 | `enemies/boss-warbear/` | "A heavy plains warbear, massive humanoid bear, scarred brown-grey fur, red tribal war-paint stripes on face and chest, broken iron collar around neck, two tribal stone-axes strapped on shoulders, fierce open-mouth roar, claws extended. Color signature: dark brown fur #4a3220, red war paint, rusty iron." |
| 藤蔓巨木 | 2 | `enemies/boss-vinewood/` | "A massive plant boss, thick brown bark torso 3 meters tall, two glowing yellow eyes deep set in the trunk, four sprawling vine arms with leaf-tip fingers, green moss and red mushrooms growing on the body, roots gripping ground. Color signature: dark bark brown, moss green, mushroom red, glowing yellow eyes." |
| 熔岩巨像 | 3 | `enemies/boss-magmagolem/` | "A towering lava golem, cracked black obsidian armor with bright magma seams glowing red-orange between plates, single huge clenched fist raised, crown of fire on top of head, thick smoke trail rising from shoulders. Color signature: obsidian black, magma orange #ff6b2a, ember yellow." |
| 冰王副官 | 4 | `enemies/boss-frostknight/` | "An icy lieutenant in dark frosted armor, single curved-horn helmet, frost-blade longsword in right hand glowing pale blue, breath of pale mist from helmet visor, cold purple cape flowing. Color signature: dark steel #2a3140, frost blue #b8d9ff, royal purple cape." |
| 夜噬本体 | 5 | `enemies/boss-yeshi/` | "Yeshi, the Devourer of Night: massive black multi-armed beast, four long muscular arms ending in razor claws, glowing red heart-shaped core embedded in chest, two curved horns, mane of dark smoke flowing around head, sharp glowing red eyes. Color signature: void black, blood red core #d6422a, purple smoke #6a3a8a." |

**章节 Boss splash 立绘 prompt 示例（夜噬）**：
```
[STYLE_BASE]
[MONSTER_LOCK — 萌怪06]
Yeshi, the Devourer of Night - splash boss intro.
Boss creature description: massive black multi-armed beast, four long
muscular arms ending in razor claws, glowing red heart-shaped core
embedded in chest, two curved horns, mane of dark smoke flowing around
head, sharp glowing red eyes, intimidating monstrous silhouette.
Background: deep underground cavern shrine with floating sealed runic
stone pillars, dim purple rune glow, oppressive scale.
Composition: hero-pose, slight low-angle, boss occupies 80% of canvas
height, dramatic backlighting.
Output: 256x256 px, opaque background.
[NEGATIVE_BASE]
```

### 6.5 通用动作描述模板（每只怪复用，替换 ACTION 段）

普通怪（64×64 / 80×80）：

```
ACTION: walk frame 1 of 4. Body shifted slightly to the left, feet pose 1
of 4 cycle (front-left foot/paw planted, back-right lifted). Body bobbing
up 2 px. FACING LEFT.

ACTION: walk frame 2 of 4. Both feet near center, body neutral.

ACTION: walk frame 3 of 4. Mirror of frame 1: front-right foot/paw planted,
back-left lifted. Body bobbing down 2 px.

ACTION: walk frame 4 of 4. Both feet near center, transition pose.

ACTION: attack frame 1 of 3 (windup). Body coiled back, mouth opening or
weapon raised, anticipation pose. FACING LEFT.

ACTION: attack frame 2 of 3 (PEAK lunge). Body extended forward to the
LEFT, mouth wide / weapon thrust at maximum reach, motion lines.

ACTION: attack frame 3 of 3 (recovery). Body returning to neutral, mouth
closing / weapon retracting.

ACTION: death frame 1 of 3 (flinch). Body jolted backward, eyes wide,
small impact spark.

ACTION: death frame 2 of 3 (falling). Body tipping sideways, limbs limp.

ACTION: death frame 3 of 3 (defeated). Body lying flat on side, X-eyes
or closed eyes, slight fade to 70% opacity.
```

Boss（128×128）：用类似模板但更夸张，walk/attack/death 各 4 帧（多一个过渡帧）。

---

## 7. 投射物 / 特效

### 7.1 通用前缀

```
[STYLE_BASE]
[COMPOSITION_RULE — 取「投射物 32×32 / 48×48」或「火花 / 光环 64×64」]
A small visual effect sprite for a fantasy game, transparent background,
single element centered, clean readable silhouette, NO character, NO UI,
NO ground plane, NO drop shadow. Designed for additive blending (bright on
dark background; black areas will be treated as transparent), but provide
true PNG alpha.
Output: {32x32 | 48x48 | 64x64} px, transparent background.
```

下文 `[HEAD-fx]` 代指此前缀。

### 7.2 投射物完整 prompt（每条可直接复制）

**`arrow.png`（32×32）**：
```
[HEAD-fx — 32×32]
Specific: a slender wooden arrow pointing to the RIGHT, brown wooden shaft,
three white feather fletches at the tail, sharp grey-metal triangular
arrowhead. Arrow occupies 26 px horizontally, centered vertically. Slight
motion trail behind the tail (~6 px wisps).
[NEGATIVE_BASE]
```

**`arrow-burst.png`（48×48）**：
```
[HEAD-fx — 48×48]
Specific: an arrow with a glowing red-orange explosive tip (small bomb-like
bulb) pointing RIGHT. Brown shaft, flame-feather fletches (orange-red).
Ember trail behind. Arrow occupies 40 px horizontally.
[NEGATIVE_BASE]
```

**`arrow-hawk.png`（32×32）**：
```
[HEAD-fx — 32×32]
Specific: a slim sleek arrow pointing RIGHT with a sharp polished metallic
triangular head, narrow blue-feather fletches, faint horizontal speed-line
trail behind the tail (~10 px). Arrow occupies 28 px horizontally.
[NEGATIVE_BASE]
```

**`magic-bolt.png`（32×32）**：
```
[HEAD-fx — 32×32]
Specific: a glowing violet-blue magic orb (10..14 px diameter) with two
trailing energy wisps behind it pointing RIGHT (like a comet). Bright
inner core fading to translucent purple at edges.
[NEGATIVE_BASE]
```

**`meteor.png`（64×64）**：
```
[HEAD-fx — 32×32 rule extended to 64×64]
Specific: a burning meteor falling at 45 degrees from upper-left to
lower-right. Glowing red-orange core (~24 px), rocky black surface,
bright comet tail of fire and sparks (~30 px) trailing toward upper-left.
[NEGATIVE_BASE]
```

**`shrapnel.png`（32×32）**：
```
[HEAD-fx — 32×32]
Specific: a single jagged piece of grey metal shrapnel (irregular polygon,
~16 px wide) with sharp edges, faint motion lines on one side suggesting
it's flying.
[NEGATIVE_BASE]
```

**`frost-shard.png`（32×32）**：
```
[HEAD-fx — 32×32]
Specific: a pale icy-blue translucent crystal shard pointing RIGHT,
elongated diamond shape (~26 px long, 10 px wide), faint frost mist around
it, internal facet highlights.
[NEGATIVE_BASE]
```

### 7.3 多帧特效（每帧独立 prompt）

**`flame-puff-1.png`（48×48）**：
```
[HEAD-fx — 48×48]
Frame 1 of 3 of a flame puff animation. Small flicker of orange flame at
canvas center, ~16 px tall, narrow base, yellow inner core.
[NEGATIVE_BASE]
```

**`flame-puff-2.png`（48×48）**：
```
[HEAD-fx — 48×48]
Frame 2 of 3. Flame expanded to ~32 px tall, broader base, bright yellow-
white inner core, orange outer layer.
[NEGATIVE_BASE]
```

**`flame-puff-3.png`（48×48）**：
```
[HEAD-fx — 48×48]
Frame 3 of 3. Flame dispersing into fading orange smoke wisps, ~36 px tall
but mostly translucent, 40% opacity overall.
[NEGATIVE_BASE]
```

**`hit-spark-1.png`（32×32）**：
```
[HEAD-fx — 32×32]
Frame 1 of 3 of a hit-spark animation. A tiny bright white-yellow star
burst at canvas center, ~8 px diameter, 4 short rays.
[NEGATIVE_BASE]
```

**`hit-spark-2.png`（32×32）**：
```
[HEAD-fx — 32×32]
Frame 2 of 3. Spark expanded to ~20 px with 6 longer radial rays, bright
yellow-white core, small orange flicker.
[NEGATIVE_BASE]
```

**`hit-spark-3.png`（32×32）**：
```
[HEAD-fx — 32×32]
Frame 3 of 3. Spark fading: faint smoke ring (~24 px) at 30% opacity, a
few tiny residual sparks.
[NEGATIVE_BASE]
```

**`block-spark-1.png` / `-2.png` / `-3.png`（32×32）**：与 hit-spark 同结构，但配色为 **蓝白**（`#b8d9ff` 主色 + 白色高光），用于王铁柱格挡反馈。

### 7.4 光环

**`slow-ring.png`（64×64）**：
```
[HEAD-fx — 64×64 ring rule]
A pale ice-blue translucent ring viewed from top-down (slight perspective
ellipse, wider than tall: ~56 px wide x 32 px tall, centered). Faint
snowflake motifs embedded in the ring outline. Additive-glow effect: bright
on outer edge of ring, fading to transparent inside and outside.
[NEGATIVE_BASE]
```

**`heal-ring.png`（64×64）**：
```
[HEAD-fx — 64×64 ring rule]
A soft white-green translucent ring (top-down ellipse ~56x32 px, centered).
Gentle leaf and feather motifs embedded in the ring. Soft additive glow,
bright on the ring outline, fading to transparent inside and outside.
[NEGATIVE_BASE]
```

---

## 8. 章节地图（背景）

### 8.1 通用前缀

```
[STYLE_BASE]
[COMPOSITION_RULE — 「章节地图 1920×1080」]
Top-down 3/4 view battle map background. Painterly hand-drawn storybook
style, warm cinematic lighting. NO characters, NO creatures, NO text,
NO UI, NO decorative border, NO frame, NO compass rose.
PATH GEOMETRY (critical):
  The enemy path is a SINGLE continuous winding dirt road.
  - Enters at the RIGHT edge of canvas (x=1920, around y=380..520).
  - Exits at the LEFT edge of canvas (x=0, around y=180..360).
  - Path width 60..100 px throughout, NEVER crosses itself, NEVER forks.
  - Edges of path are irregular with gravel, wheel ruts, grass patches,
    and small chapter-themed details (e.g., haystacks for plains, vines
    for forest, lava chunks for volcano).
  - Around the path leave 6..10 small flat clearings (each ~120x120 px)
    where towers can be placed.
Output: 1920x1080 px, opaque painted background.
```

下文 `[HEAD-map]` 代指此前缀。

### 8.2 五张地图完整 prompt

**`chapter-1.png` 边境平原**：
```
[HEAD-map]
Specific theme: golden grassland borderland at sunset hour. Tall warm-yellow
grass, distant low purple-grey mountain silhouettes, ruined stone village
walls and broken wooden palisades scattered around the path, a small wooden
watchtower in the upper-left background, scattered haystacks and a wagon
wheel near the path, warm orange-amber sunset light from the right.
Palette: golden yellow, warm orange, dusty olive, soft purple distance.
[NEGATIVE_BASE]
```

**`chapter-2.png` 幽暗森林**：
```
[HEAD-map]
Specific theme: deep ancient forest at twilight. Thick mossy ancient trees
flanking the path (mostly out of frame at the top, casting shadows down),
soft blue-glowing fireflies floating, hanging vines, mossy half-buried
stone steles with faint engraved runes near the path, misty atmosphere,
distant glow of moss-covered ruins in the back. Cool palette balanced with
amber accents.
Palette: deep forest green, teal mist, moss brown, faint blue glow, warm
amber highlights on path.
[NEGATIVE_BASE]
```

**`chapter-3.png` 烈焰火山**：
```
[HEAD-map]
Specific theme: volcanic mountain road. Black volcanic rock terrain with
bright magma cracks glowing red-orange running parallel to the dirt path,
small smoking fissures, occasional magma rivulets crossing under small
stone bridges, distant active volcano cone with smoke plume in the
background, ember particles in the air. Bright lava highlights against
dark charcoal terrain.
Palette: charcoal black, magma red-orange #ff6b2a, ember yellow,
distant dark red sky.
[NEGATIVE_BASE]
```

**`chapter-4.png` 极北雪山**：
```
[HEAD-map]
Specific theme: northern snow-mountain pass during a light blizzard. Icy
dirt path with patches of frost, jagged ice shards jutting from the snow
along the edges, distant frozen stone fortress silhouette on the back-left
horizon, swirling snowflakes in the foreground (subtle), subtle aurora
green-blue hint in the upper sky. Cold blue-white palette.
Palette: pale icy blue #b8d9ff, snow white, deep glacier blue, distant
aurora hint of green-cyan.
[NEGATIVE_BASE]
```

**`chapter-5.png` 回响之渊**：
```
[HEAD-map]
Specific theme: deep underground abyss cavern. Massive ancient sealed stone
pillars carved with rune-glyphs flanking the path (mostly out of frame at
the top edges, suggesting impossible scale), faint purple rune glow
illuminating the path, deep black-indigo darkness in the background, a few
floating purple rune-stones suspended near the path, oppressive scale.
Palette: deep void black, indigo, faint purple #6a3a8a rune glow, occasional
warm amber rune highlight on path.
[NEGATIVE_BASE]
```

### 8.3 地图与代码 lane 对齐

- 第 1 章 `chapter-1.png` 已经做好，并在 `src/data/map.js` 配置了 **3 条 spawn lane**。重出第 1 章时请保留视觉上能解释 3 条 lane 的痕迹（例如主路 + 南侧斜插小道 + 东南角小径）。
- 第 2–5 章默认 1 条主路；如果未来扩展为 2–3 条 lane，需先更新 `src/data/map.js` 再重出地图。

---

## 9. 章节漫画分镜

> 漫画总量：5 章 × (4 prologue + 4 epilogue) = **40 格**。每格独立 prompt，必须把出场角色的 LOCK 拼上以保证脸 / 服装一致。

### 9.1 通用漫画前缀

```
[STYLE_BASE]
[COMPOSITION_RULE — 「漫画分镜 1024×1024」]
Single painted comic panel illustration, 1024x1024 px, opaque painted
background. NO speech bubble, NO caption text (will be added later in
post), NO panel border, NO frame, NO Asian characters/text anywhere.
Warm storybook hand-drawn style. Cinematic composition with clear focal
point and readable foreground/background separation.
Characters present (each MUST match its LOCK exactly):
  <CHARACTER_LOCKS LIST — 把当格出场的所有角色 LOCK 拼这里>
Output: 1024x1024 px, opaque background.
```

下文 `[HEAD-comic with: X, Y, Z]` 代指该前缀 + 列出的角色 LOCK 段。

### 9.2 第 1 章 出征（章首 4 + 章末 4 = 8 格）

**`ch1-prologue-1.png`**：
```
[HEAD-comic with: QUEEN_LOCK]
Royal capital plaza at dawn. Queen Aileana stands tall on a high stone
platform at center-frame, sword raised skyward in oath, royal red cape
fluttering. Below the platform, rows of soldiers in formation hold spears.
Distant red haze in the sky on the horizon. Warm golden dawn light from
the right. Composition: hero shot of the Queen.
[NEGATIVE_BASE]
```

**`ch1-prologue-2.png`**：
```
[HEAD-comic with: QUEEN_LOCK, TIEZHU_LOCK, ERGOU_LOCK, YUEGUANG_LOCK]
Throne hall interior. Tiezhu (left), Ergou (center), Yueguang (right) kneel
on one knee in a row before Queen Aileana, who is mid-motion placing a
small golden hero-medallion over the neck of one hero. Golden divine light
streaming from above. Stained-glass window behind the throne suggests dawn.
Composition: 3/4 wide angle showing all four figures clearly.
[NEGATIVE_BASE]
```

**`ch1-prologue-3.png`**：
```
[HEAD-comic with: TIEZHU_LOCK, ERGOU_LOCK, YUEGUANG_LOCK]
The three heroes walking out through the open city gate together, viewed
from a 3/4 rear-angle behind them so we see their backs and the open road
ahead. Citizens on the high stone walls above waving farewell, several red
royal banners flying. Warm dawn light on the road.
[NEGATIVE_BASE]
```

**`ch1-prologue-4.png`**：
```
[HEAD-comic with: TIEZHU_LOCK, ERGOU_LOCK, YUEGUANG_LOCK]
Border plain at dusk. The three heroes stand together at a small rise in
the foreground (silhouetted partly against the sky), looking across at
distant monster campfires dotting the dark plain in the background. They
grip their weapons, determined faces lit by the warm orange dusk and the
distant red campfires. Composition: medium-wide rear-3/4 of the trio.
[NEGATIVE_BASE]
```

**`ch1-epilogue-1.png`**：
```
[HEAD-comic with: TIEZHU_LOCK]
Plains battlefield at midday. Tiezhu mid-action, having just struck a large
monster captain with his warhammer. The monster captain (a brutish
ogre-like creature with broken armor) is falling backward, shockwave dust
and impact debris around the strike. Tiezhu in heroic forward stance, red
cape billowing.
[NEGATIVE_BASE]
```

**`ch1-epilogue-2.png`**：
```
[HEAD-comic with: ERGOU_LOCK]
Same battlefield, slightly later. Ergou kneels beside the fallen monster
body in the foreground, carefully picking up a small grey stone fragment
carved with glowing strange purple runes. Curious focused expression.
Smoky battlefield haze behind.
[NEGATIVE_BASE]
```

**`ch1-epilogue-3.png`**：
```
[HEAD-comic with: YUEGUANG_LOCK]
Close-medium shot. Yueguang holds the rune fragment between gloved
fingertips, her other hand casting a faint silver spell-light onto it to
inspect the runes. Slight frown, mouth slightly open as if whispering
"Echoing Abyss". Dusk background, blue-purple ambient.
[NEGATIVE_BASE]
```

**`ch1-epilogue-4.png`**：
```
[HEAD-comic with: TIEZHU_LOCK, ERGOU_LOCK, YUEGUANG_LOCK]
The three heroes seen from behind in mid-shot, turning to look toward a
distant dark forest on the horizon at twilight. A faint cold blue glow
emanates from deep within the woods. Foreshadowing mood. Composition:
heroes occupy the lower-left third, forest in the upper-right two-thirds.
[NEGATIVE_BASE]
```

### 9.3 第 2 章 寻路（章首 4 + 章末 4 = 8 格）

> 每条完整 prompt 结构 = `[HEAD-comic with: 所需角色 LOCK]` + 下面的 Specific 段 + `[NEGATIVE_BASE]`。

**`ch2-prologue-1.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: Edge of a deep ancient forest at twilight. The three heroes walk into the forest from foreground (back-3/4 view), small in the frame center. Towering moss-covered trees on both sides, soft blue glowing fireflies floating in the air, light shafts breaking through the canopy. Mood: stepping into the unknown.

**`ch2-prologue-2.png`** — chars: `[YUEGUANG]`
> Specific: Medium close-up. Yueguang stands beside a thick mossy tree trunk, holding up a torn fabric flag fragment (royal red with faint gold royal emblem visible) hanging from a vine. She inspects it with a small silver glow spell on her fingertips, brow furrowed.

**`ch2-prologue-3.png`** — chars: `[ERGOU]`
> Specific: Ergou crouches low behind a fallen log in the foreground, bow at the ready, peering forward. In the misty middle distance, the massive silhouette of a plant-boss (vine-wood Boss) looms barely visible through fog, only its glowing yellow eyes clearly cutting through.

**`ch2-prologue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes stand in battle stance in the foreground (medium-wide), the vine-wood Boss's huge vine-arms emerging from the mist behind them, leaf-tip fingers reaching forward. Dramatic tension, blue mist swirling.

**`ch2-epilogue-1.png`** — chars: `[TIEZHU]`
> Specific: The vine-wood Boss has fallen, body sprawled across the ground, severed vines still twitching. Tiezhu mid-action delivering the final hammer strike on the Boss's torso, shockwave of bark splinters bursting outward.

**`ch2-epilogue-2.png`** — chars: `[YUEGUANG]`
> Specific: Close-medium shot. Yueguang gently extracts a glowing blue translucent seal-stone (~hand-sized) from a crack in the fallen Boss's chest cavity. The stone pulses with faint blue light, soft glow illuminating her face.

**`ch2-epilogue-3.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes gather around the seal-stone held in Yueguang's palm. Inside the stone, a small holographic vision of a volcanic landscape (lava flows, dark mountain) is visible. Their faces lit blue from below.

**`ch2-epilogue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes seen from behind on a forest ridge at dawn, looking toward a distant volcanic mountain on the horizon with red smoke plume rising. Cool blue foreground transitioning to warm red distance.

### 9.4 第 3 章 火山（8 格）

**`ch3-prologue-1.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes stand on a rocky outcrop at the edge of a volcanic crater, glowing orange lava visible below, heat-shimmer distorting the background air, distant lava fountain erupting. Heroes silhouetted against the orange glow.

**`ch3-prologue-2.png`** — chars: `[TIEZHU]`
> Specific: A group of small flame-elemental creatures (orange flickering wisps, ~half the size of Tiezhu) rush toward him from the right. Tiezhu mid-swing with his warhammer, sweeping it in a wide arc, ember sparks flying.

**`ch3-prologue-3.png`** — chars: `[ERGOU]`
> Specific: Ergou stands on a cliff edge beside a flowing lava river, drawing his bow and loosing an arrow toward something off-frame. In the background, the back silhouette of a massive lava golem (Boss) is visible walking away on the lava plain below.

**`ch3-prologue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes on a black volcanic rock plateau, weapons drawn, facing the lava golem Boss as it rises and turns toward them, magma seams glowing red, smoke billowing from its crown of fire.

**`ch3-epilogue-1.png`** — chars: `[YUEGUANG]`
> Specific: Mid-battle. Yueguang in foreground casting a beam of pale silver moonlight from her staff, the beam striking the lava golem Boss's chest core, magma core cracking visibly.

**`ch3-epilogue-2.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The lava golem Boss has collapsed forward, its chest plate shattered open revealing a glowing red heart-core inside. Smoke and embers settle. Heroes stand at safe distance in the foreground silhouette.

**`ch3-epilogue-3.png`** — chars: `[YUEGUANG]`
> Specific: Close-medium shot. Yueguang carefully extracts the second seal-stone (this one with a red-orange heart-core inside instead of blue) from the Boss's chest, her expression grave and tense. Heat haze rising.

**`ch3-epilogue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes seen from a low angle, now wearing thick fur-lined cloaks, looking up toward distant snow-covered mountains on the horizon. Cold wind blowing the cloaks. Transition from warm to cold palette.

### 9.5 第 4 章 雪山（8 格）

**`ch4-prologue-1.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes struggle through a blizzard, leaning into the wind, cloaks billowing, footprints in deep snow behind them. In the far background, a frozen stone fortress silhouette barely visible through swirling snow.

**`ch4-prologue-2.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: A pack of 4 frost-wolves (pale blue fur, glowing icy eyes) circles the heroes in the snow. The three stand back-to-back in a defensive triangle, weapons drawn. Snowflakes falling around them.

**`ch4-prologue-3.png`** — chars: `[TIEZHU, ERGOU]`
> Specific: A massive ice-covered fortress gate fills the background. Ergou stands in foreground pointing at it. Tiezhu beside him raises his warhammer high, preparing to strike the gate.

**`ch4-prologue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: Interior of an icy throne hall. The three heroes have just entered through the broken gate (visible at frame edge), facing the Frost King's lieutenant rising from a frozen throne in the back center, drawing a glowing pale-blue frost-blade longsword.

**`ch4-epilogue-1.png`** — chars: `[TIEZHU]`
> Specific: Tiezhu and the Frost Knight's weapons clash mid-air at frame center, warhammer meeting frost-sword, blue sparks and ice shards bursting outward. Both characters mid-lunge in dynamic pose.

**`ch4-epilogue-2.png`** — chars: `[YUEGUANG]`
> Specific: The Frost Knight has fallen, half-collapsed on icy floor. Yueguang kneels beside the body, picking up the third seal-stone (pale blue/white with snowflake pattern inside) from the knight's armor.

**`ch4-epilogue-3.png`** — chars: `[YUEGUANG]`
> Specific: Close-up of Yueguang's open palm holding all three seal-stones (blue, red, white) glowing in unison. A vertical light-pillar shoots upward from her palm into the dark sky above, pointing toward an off-frame destination.

**`ch4-epilogue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes stand at the edge of a massive crack in the earth, purple-black light pouring out of the depths below. They face the chasm with determined resolve, capes flowing. The entrance to the Echoing Abyss.

### 9.6 第 5 章 回响之渊（8 格）

**`ch5-prologue-1.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes descend along a narrow stone tunnel covered in glowing purple runes. Darkness above and below, only the rune-light illuminating the path. Heroes seen from a 3/4 side view, mid-descent.

**`ch5-prologue-2.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: The three heroes emerge into a massive cavern shrine. Center of the cavern: Yeshi's dormant colossal black form, four arms folded, eyes closed, suspended in a ring of floating runic stones. Heroes tiny in foreground for scale.

**`ch5-prologue-3.png`** — chars: `[YUEGUANG]`
> Specific: Yueguang places the three seal-stones into three carved slots in the cavern floor. The stones flare brightly. In the background, Yeshi's red eyes snap open, awakening. Dramatic tension moment.

**`ch5-prologue-4.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: Yeshi is fully awake, all four massive clawed arms spread outward menacingly, glowing red core blazing, dark smoke mane billowing. The three heroes stand defiant in foreground (small for scale), weapons raised. Hero-shot framing.

**`ch5-epilogue-1.png`** — chars: `[TIEZHU, ERGOU, YUEGUANG]`
> Specific: All three heroes attack Yeshi simultaneously in a coordinated assault: Tiezhu (lower-left) smashes a hammer into Yeshi's foreleg, Ergou (upper-right) looses an arrow at the red core, Yueguang (lower-right) casts a silver moonlight seal-circle around Yeshi. Yeshi looms in center.

**`ch5-epilogue-2.png`** — chars: `[QUEEN, TIEZHU, ERGOU, YUEGUANG]`
> Specific: Queen Aileana has arrived at the abyss entrance with a column of royal soldiers behind her. She extends her sword and joins her power with the three heroes' attacks, all four channeling a brilliant column of golden holy light into Yeshi.

**`ch5-epilogue-3.png`** — chars: `[QUEEN, TIEZHU, ERGOU, YUEGUANG]`
> Specific: Yeshi dissolves into floating black ash particles, drifting upward in the holy light. The four protagonists stand in foreground (back view), looking up at the dispersing form. Triumphant but solemn mood.

**`ch5-epilogue-4.png`** — chars: `[QUEEN, TIEZHU, ERGOU, YUEGUANG]`
> Specific: Royal capital gate, daytime award ceremony. Queen Aileana places hero medallions on the three heroes one by one. Crowds cheering on the walls. ENDING HOOK: in the upper-right corner of the sky, a single tiny wisp of black ash drifts unnoticed (foreshadow).

---

## 10. 立绘 / 头像

### 10.1 关键 NPC 角色基底

#### 10.1.1 女王艾琳娜 QUEEN_LOCK

```
QUEEN_LOCK = "Character: Queen Aileana, a young regal woman with long flowing
golden hair, gold filigree crown, white-and-gold ornate plate armor with red
royal cape draped over one shoulder, a long royal sword at her hip, dignified
yet warm expression. Color signature: ivory white, royal gold #f2ca73,
crimson red cape."
```

#### 10.1.2 夜噬 YESHI_LOCK

```
YESHI_LOCK = "Character: Yeshi, the Devourer of Night. A colossal black
shadow-beast with four muscular long arms ending in razor claws, a
heart-shaped glowing red core in its chest, twin curved horns, mane of
black smoke flowing around its head, sharp glowing red eyes, an aura of
purple-black mist around its body. Intimidating, monstrous, ancient."
```

### 10.2 立绘 / splash 完整 prompt

**`portraits/heroes/tiezhu.png`** — 见 §4.5 完整 prompt（已写好）。  
**`portraits/heroes/ergou.png`** / **`portraits/heroes/yueguang.png`** — 同 §4.5。

**`portraits/queen.png`（768×1024）**：
```
[STYLE_BASE]
[QUEEN_LOCK]
[COMPOSITION_RULE — 「立绘 768×1024」]
Full body portrait of Queen Aileana. Standing on a high castle wall at
sunset, holding her royal longsword pointed skyward in oath, royal red
cape billowing to the right in the wind. Behind her, a large red royal
banner with golden emblem. Soft warm sunset backlight from the upper-right
casting gentle rim light on her armor. Dignified yet warm expression.
Character occupies center, head at y=80..160, feet at y=920..980.
Output: 768x1024 px, opaque background.
[NEGATIVE_BASE]
```

**`portraits/yeshi.png`（768×1024）**：
```
[STYLE_BASE]
[YESHI_LOCK]
[COMPOSITION_RULE — 「立绘 768×1024」]
Full body portrait of Yeshi, the Devourer of Night. Emerging from
purple-black smoke that swirls around his legs and lower body, four arms
spread outward menacingly. Surrounded by 3..5 floating ancient sealed
runic stone tablets glowing faint purple. Dramatic low-angle camera makes
him feel huge. Intimidating scale, oppressive atmosphere.
Character occupies center, head at y=80..200, feet at y=900..980 (with
smoke covering lower portion).
Output: 768x1024 px, opaque background.
[NEGATIVE_BASE]
```

**`splash/splash_main.png`（1920×1080，启动屏）**：
```
[STYLE_BASE]
[QUEEN_LOCK]
[TIEZHU_LOCK]
[ERGOU_LOCK]
[YUEGUANG_LOCK]
Splash screen composition, painterly cinematic.
Foreground (lower third): three hero silhouettes (Tiezhu, Ergou, Yueguang)
climbing a stone path uphill toward a castle wall, viewed from behind so
their backs face the camera.
Middle ground: Queen Aileana standing on the castle wall at the top of
the path, sword raised, royal red cape glowing in the warm sunset light.
Background: distant valley with subtle dark monster horde shadows on the
horizon, warm orange-amber sunset sky with a few clouds.
Composition rules:
- Leave the top 20% of canvas (y=0..216) relatively clean for future game
  logo overlay (just sky / sunset).
- Leave the bottom 10% of canvas (y=972..1080) for version text overlay
  (lower contrast, fewer details).
NO text, NO logo.
Output: 1920x1080 px, opaque background.
[NEGATIVE_BASE]
```

**`menu/menu_bg.png`（1920×1080，主菜单背景）**：
```
[STYLE_BASE]
[QUEEN_LOCK]
[TIEZHU_LOCK]
[ERGOU_LOCK]
[YUEGUANG_LOCK]
Main menu background, painterly cinematic, more static composition than
splash. The Queen and three heroes are positioned to the LEFT THIRD of
the canvas (x=0..640), looking thoughtfully toward the right. The CENTER
THIRD (x=640..1280) is intentionally LESS DETAILED (soft painterly sky
or distant valley) so that four menu buttons can be placed on top later.
The RIGHT THIRD (x=1280..1920) shows the distant castle and warm sunset.
Warm cinematic lighting. NO text, NO logo, NO button shapes (those are
overlaid later).
Output: 1920x1080 px, opaque background.
[NEGATIVE_BASE]
```

---

## 11. UI 元素与图标

### 11.1 按钮（4 个状态，256×96）

**通用前缀**：
```
[STYLE_BASE]
[COMPOSITION_RULE — 「UI 按钮 256×96」]
A game UI button asset, 256x96 px, transparent background. Painted wooden
plank shape with warm gold trim border (3..4 px wide), rounded corners
(corner radius ~10 px), sturdy iron rivets at each of the 4 inner corners,
slight inner bevel highlight along the top edge.
9-SLICE FRIENDLY: trim thickness is uniform on all 4 sides; the center
192x72 area (from x=32..224, y=12..84) is visually flat and uniform so
text can be overlaid later. NO text on the button itself.
Output: 256x96 px, transparent background.
```

**`ui/btn-default.png`**：
```
[上述前缀]
STATE: default / idle. Warm wood color #5a3a1c, gold trim #f2ca73, iron
rivets dark grey, subtle wood grain visible.
[NEGATIVE_BASE]
```

**`ui/btn-hover.png`**：
```
[上述前缀]
STATE: hover / focus. Wood slightly brighter (#6a4a2c), gold trim glowing
softly with a faint outer halo (~2 px), rivets slightly brighter.
[NEGATIVE_BASE]
```

**`ui/btn-disabled.png`**：
```
[上述前缀]
STATE: disabled. Desaturated grey-brown wood (#5a4a3c), dim trim (muted
gold #9a8a5a), rivets darker, overall ~70% opacity feel.
[NEGATIVE_BASE]
```

**`ui/btn-danger.png`**：
```
[上述前缀]
STATE: danger / destructive action. Deep crimson-red wood (#6a1d10), gold
trim #f2ca73, more prominent iron rivets (6 instead of 4), faint warning
glow around the edges.
[NEGATIVE_BASE]
```

### 11.2 面板纹理（无缝平铺，512×512）

**`ui/panel-wood.png`**：
```
[STYLE_BASE]
[COMPOSITION_RULE — 「UI 面板 512×512」]
Seamlessly tileable wood plank pattern. Warm dark oak wood color #3c2814
with subtle vertical grain striations, a few scattered small dark knots,
hint of small nail-hole indentations at regular intervals (one near each
corner of the canvas, simulating planks meeting). NO border, NO logo, NO
text. CRITICAL: the LEFT edge must match the RIGHT edge pixel-for-pixel
and the TOP edge must match the BOTTOM edge for seamless tiling.
Output: 512x512 px, opaque background.
[NEGATIVE_BASE]
```

### 11.3 图标（64×64，每条完整 prompt）

**通用前缀**：
```
[STYLE_BASE]
[COMPOSITION_RULE — 「图标 64×64」]
A single game icon, 64x64 px, transparent background. Centered subject
filling 70..85% of canvas. Strong silhouette, slightly exaggerated cartoon
proportions for legibility at small UI sizes. Soft inner shadow, optional
warm gold rim accent on the silhouette edge. NO text, NO background.
Output: 64x64 px, transparent background.
```

**`icons/coin.png`**：
```
[上述前缀]
Specific: a single round gold coin viewed front-on, embossed with a small
royal crown emblem in the center, warm gold #f2ca73 with darker gold
shadow #b8932a on the rim, subtle white highlight on the upper-left.
[NEGATIVE_BASE]
```

**`icons/blueprint.png`**：
```
[上述前缀]
Specific: a tightly rolled blueprint scroll tied with a red ribbon in the
middle, viewed at 3/4 angle, light blue paper edge visible at both ends
with faint white grid lines hinting.
[NEGATIVE_BASE]
```

**`icons/blueprint-fragment.png`**：
```
[上述前缀]
Specific: a torn jagged corner of blueprint paper with faint glowing
purple runes on the surface, irregular shape, light blue paper.
[NEGATIVE_BASE]
```

**`icons/heart.png`**：
```
[上述前缀]
Specific: a simple stylized round red heart with one bright white highlight
in the upper-left, classic JRPG life icon, gentle gold rim outline.
[NEGATIVE_BASE]
```

**`icons/heart-shield.png`**：
```
[上述前缀]
Specific: a red heart shape inset inside a small round steel shield with
gold rim. The heart fills ~60% of the shield, indicating fortified life.
[NEGATIVE_BASE]
```

**`icons/skill-tiezhu.png`**：
```
[上述前缀]
Specific: a top-down view of a heavy iron warhammer with bronze trim,
surrounded by a golden swirling energy aura. Hammer head at the top of the
icon, shaft pointing down.
[NEGATIVE_BASE]
```

**`icons/skill-ergou.png`**：
```
[上述前缀]
Specific: three arrows arranged in a fan pattern, crossed at the center,
fletching at the bottom, sharp metallic heads pointing upward-outward in
3 directions.
[NEGATIVE_BASE]
```

**`icons/skill-yueguang.png`**：
```
[上述前缀]
Specific: a glowing crescent moon (pale white-silver) at the center,
3 small star sparkles around it, soft blue halo behind.
[NEGATIVE_BASE]
```

**`icons/equipment-weapon.png`**：
```
[上述前缀]
Specific: two swords crossed in an X, gold pommels at the bottom, bright
metallic blades, with a small red gem at the cross point.
[NEGATIVE_BASE]
```

**`icons/equipment-armor.png`**：
```
[上述前缀]
Specific: a round steel chestplate viewed front-on, gold trim along the
edges, embossed with a small crown emblem in the center, dark metallic
shading.
[NEGATIVE_BASE]
```

**`icons/equipment-trinket.png`**：
```
[上述前缀]
Specific: a teardrop-shaped translucent blue gemstone (#7ab8ff) held in a
gold filigree wire setting, faint internal sparkles.
[NEGATIVE_BASE]
```

**`icons/easter-egg.png`**：
```
[上述前缀]
Specific: a small wrapped golden gift box with a red ribbon tied in a bow
on top, gold sparkle decorations.
[NEGATIVE_BASE]
```

---

## 12. 文件落点对照表

> 生成完成后，把图片按下表放到对应目录。**严禁修改文件名**。

| 资源类别 | 落点目录 | 备注 |
|---|---|---|
| 英雄动作帧 | `src/assets/heroes/action-sheets/` | `{heroId}-{action}-{NN}.png` |
| 英雄头像 | `src/assets/heroes/` | `{heroId}.png`（已存在则覆盖） |
| 英雄立绘 | `src/assets/portraits/heroes/` | 创建目录 |
| 塔等级 / 攻击 / 分支 | `src/assets/towers/` | 已存在目录 |
| 塔图鉴主立绘 | `src/assets/towers/` | `{towerId}.png` |
| 怪物动画帧 | `src/assets/enemies/{monsterId}/` | 创建子目录，每只怪一个 |
| 怪物图鉴 | `src/assets/portraits/monsters/` | 创建目录 |
| 投射物 / 特效 | `src/assets/projectiles/` | 创建目录 |
| 章节地图 | `src/assets/maps/` | `chapter-{1..5}.png` |
| 漫画分镜 | `src/assets/comics/` | `ch{n}-prologue-{1..4}.png` 等 |
| 关键 NPC 立绘 | `src/assets/portraits/` | `queen.png`、`yeshi.png` |
| 开机 / 主菜单背景 | `src/assets/splash/` 与 `src/assets/menu/` | 1920x1080 |
| UI 按钮 / 面板 | `src/assets/ui/` | 创建目录 |
| 图标 | `src/assets/icons/` | 创建目录 |

---

## 13. 批量生成脚本（reference-first 工作流伪代码）

```python
# 用任意支持 gpt-img-2 的 SDK 跑。完整流程分 3 个阶段：
# 阶段 A：生成主参考表 / 主立绘（角色 3 张 + 塔 8 张 + Boss 5 张 + 关键 NPC 3 张）
# 阶段 B：用主参考表生成 L1 / walk-01 等"首帧"
# 阶段 C：用首帧 + 主参考表生成所有后续帧

STYLE_BASE = "..."           # 见 §1
NEGATIVE   = "..."           # 见 §2
LOCKS      = {"tiezhu": ..., "ergou": ..., "yueguang": ..., "queen": ..., "yeshi": ...}

def gen(prompt, *, size, transparent, out_path, reference_images=None):
    """一次 API 调用 + 保存"""
    kwargs = {
        "model": "gpt-img-2",
        "prompt": prompt,
        "negative_prompt": NEGATIVE,
        "size": size,
        "background": "transparent" if transparent else "opaque",
        "quality": "high",
    }
    if reference_images:
        kwargs["image"] = reference_images  # 参考图列表
    client.images.generate(**kwargs).save(out_path)

# ==========  阶段 A：主参考表  ==========

# A1. 3 张英雄 master ref（§4.2）
for hero, lock in LOCKS.items():
    if hero in ("tiezhu", "ergou", "yueguang"):
        gen(
            prompt=build_hero_master_prompt(hero, lock),  # §4.2 对应小节
            size="1024x1024", transparent=False,
            out_path=f"ref/{hero}-master.png",
        )
# 人工审核 ref/*.png，不满意就重出，满意后锁定。

# A2. 8 张塔主立绘（§5.3）
for tower_id in ["arrow","mage","artillery","barracks","flame","frost","altar","gold"]:
    gen(
        prompt=build_tower_portrait_prompt(tower_id),
        size="256x256", transparent=True,
        out_path=f"src/assets/towers/{tower_id}.png",
    )

# A3. 5 章节 Boss + 2 NPC（§6.4 / §10）
# 略

# ==========  阶段 B：首帧  ==========

# B1. 英雄每个动作的 frame 01（用 master ref 当参考）
for hero in ("tiezhu", "ergou", "yueguang"):
    master_ref = f"ref/{hero}-master.png"
    for action in ("walk","run","attack","cast","ultimate","defeated"):
        gen(
            prompt=build_hero_frame_prompt(hero, action, frame=1),  # §4.3
            size="96x96", transparent=True,
            out_path=f"src/assets/heroes/action-sheets/{hero}-{action}-01.png",
            reference_images=[master_ref],
        )

# B2. 塔 L1（用 tower portrait 作为参考）
for tower_id in ALL_TOWERS:
    portrait = f"src/assets/towers/{tower_id}.png"
    gen(
        prompt=build_tower_l1_prompt(tower_id),
        size="96x96", transparent=True,
        out_path=f"src/assets/towers/{tower_id}-l1.png",
        reference_images=[portrait],
    )

# ==========  阶段 C：后续帧  ==========

# C1. 英雄 frame 02..04（每帧用 master ref + frame 01 双参考）
for hero in ("tiezhu", "ergou", "yueguang"):
    master_ref = f"ref/{hero}-master.png"
    for action in ("walk","run","attack","cast","ultimate","defeated"):
        first_frame = f"src/assets/heroes/action-sheets/{hero}-{action}-01.png"
        for n in (2, 3, 4):
            gen(
                prompt=build_hero_frame_prompt(hero, action, frame=n),
                size="96x96", transparent=True,
                out_path=f"src/assets/heroes/action-sheets/{hero}-{action}-{n:02d}.png",
                reference_images=[master_ref, first_frame],
            )

# C2. 塔 L2 / L3 / attack / branches（每张用 tower portrait + L1 双参考）
for tower_id in ALL_TOWERS:
    portrait = f"src/assets/towers/{tower_id}.png"
    l1 = f"src/assets/towers/{tower_id}-l1.png"
    for stage in ("l2", "l3", "attack"):
        gen(
            prompt=build_tower_stage_prompt(tower_id, stage),
            size="96x96", transparent=True,
            out_path=f"src/assets/towers/{tower_id}-{stage}.png",
            reference_images=[portrait, l1],
        )
    for branch in TOWER_BRANCHES[tower_id]:
        gen(
            prompt=build_tower_branch_prompt(tower_id, branch),
            size="96x96", transparent=True,
            out_path=f"src/assets/towers/{tower_id}-branch-{branch}.png",
            reference_images=[portrait, l1],
        )

# C3. 怪物（每只 portrait → walk-01 → walk-02..04 + attack + death）
# 同模式：portrait 作为 master ref，walk-01 作为动作 ref

# 估算总调用次数：
#   英雄: 3 master + 72 frame = 75
#   塔: 8 portrait + 8*5 stage + ~15 branch = 63
#   怪物: ~30 portrait + ~30*10 frame = ~330
#   章节 Boss: 5 portrait + 5*12 frame = 65
#   投射物 / 火花 / 光环: ~20
#   地图: 5
#   漫画: 40
#   立绘 / splash / menu: 7
#   UI 按钮 / 面板 / 图标: ~20
# 合计 ≈ 625 张图（首次完整生成估算）
```

---

## 14. 速查清单（开始前 / 每张交付前打勾）

### 14.1 开始前

- [ ] 已把 STYLE_BASE 拼到每个 prompt 最前面
- [ ] 已把 NEGATIVE_BASE 设为 negative_prompt
- [ ] sprite 类资源 `background: transparent`，背景类 `opaque`
- [ ] 同一动作 4 帧用 image-edit / reference 模式（§0.4）
- [ ] 文件名严格按表，2 位补零，全小写英文 + 连字符
- [ ] 怪物默认 facing LEFT，英雄默认 facing RIGHT
- [ ] 输出尺寸严格匹配 §3 表格
- [ ] 主参考表已生成、已锁定（§4.2 / §5.3 / §6.3）

### 14.2 每张交付前（§0.5 完整对一遍）

- [ ] 背景 100% 透明（无白边 / 灰边 / 棋盘格）
- [ ] 主体完整可见，未被画布边裁切
- [ ] 朝向正确
- [ ] 角色 / 怪物实占高度符合 §3
- [ ] 配色与 LOCK 一致
- [ ] 4 帧之间脸 / 服装 / 武器 / 配色完全一致
- [ ] L1 / L2 / L3 底座像素级一致
- [ ] 无文字 / 水印 / Logo
- [ ] 无多余道具或随机物体

---

## 15. 全量资源预算表

| 模块 | 数量 | 优先级 | 备注 |
|---|---:|---|---|
| 英雄 master ref | 3 | P0（必须先做）| reference 阶段 |
| 英雄动作帧 | 72 | P1 | 6 动作 × 4 帧 × 3 英雄 |
| 英雄头像 | 3 | P2 | 128×128 |
| 英雄立绘 | 3 | P3 | 768×1024，商店/介绍用 |
| 塔主立绘 | 8 | P0 | reference 阶段 |
| 塔等级帧 | 32 | P1 | L1+L2+L3+attack × 8 塔 |
| 塔分支帧 | 15 | P2 | 各塔 1–3 分支 |
| 怪物 portrait | ~30 | P0–P1 | 每族 3 只代表性 |
| 怪物动画帧 | ~300 | P2 | walk 4 + attack 3 + death 3 |
| 章节 Boss portrait | 5 | P1 | 256×256 |
| 章节 Boss 动画帧 | 60 | P2 | 5 boss × 12 帧 |
| 投射物 | 7 | P1 | 静态单帧 |
| 多帧特效 | 9 | P2 | flame-puff / hit-spark / block-spark |
| 光环 | 2 | P2 | slow-ring / heal-ring |
| 章节地图 | 5 | P1 | 1920×1080，第 1 章已有 |
| 漫画分镜 | 40 | P3 | 5 章 × 8 格 |
| NPC 立绘 | 2 | P2 | queen / yeshi |
| 启动屏 / 菜单背景 | 2 | P2 | 1920×1080 |
| UI 按钮 | 4 | P1 | 256×96 |
| UI 面板纹理 | 1 | P2 | 512×512 |
| 图标 | 12 | P1 | 64×64 |
| **总计** | **~625** | — | 见 §13 估算 |

### 优先级说明

- **P0**：必须先做（reference 阶段，所有下游资源依赖它）
- **P1**：核心游玩体验必需（不做会有缺图）
- **P2**：提升表现力（可后期补）
- **P3**：内容扩展（漫画 / 立绘可分批做）

---

## 16. 最终完整性自检

生成完成后跑一遍下面这套验证：

```bash
# 1. 检查文件命名
ls src/assets/heroes/action-sheets/ | grep -v "^[a-z]\+-[a-z]\+-[0-9][0-9]\.png$"
# 上面命令应该没有输出（任何输出意味着命名违规）

# 2. 检查所有 sprite 真透明（不要有白底）
# 用 ImageMagick / Pillow 脚本检查角点像素 alpha = 0
for f in src/assets/{heroes,enemies,towers,projectiles,icons,ui}/**/*.png; do
  alpha=$(magick "$f" -format "%[fx:p{0,0}.a*255]" info:)
  [ "$alpha" = "0" ] || echo "WARN: $f corner not transparent"
done

# 3. 检查同动作 4 帧画布尺寸一致
for hero in tiezhu ergou yueguang; do
  for action in walk run attack cast ultimate defeated; do
    sizes=$(magick identify -format "%wx%h\n" src/assets/heroes/action-sheets/$hero-$action-*.png | sort -u)
    [ $(echo "$sizes" | wc -l) -eq 1 ] || echo "WARN: $hero-$action frames have inconsistent sizes"
  done
done

# 4. 检查总文件数
find src/assets -name "*.png" | wc -l   # 期望 ≥ 600
```

### 16.5 透明度三态分类（配合 §0.7 兜底流程）

收到一批图片后跑这段，自动分桶：`real-alpha`（合格）/ `greenscreen`（待抠图）/ `bad-bg`（重出）：

```python
# tools/classify_bg.py
import sys, shutil, pathlib
from PIL import Image

def classify(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    # 取 4 个角的像素
    corners = [im.getpixel((0,0)), im.getpixel((w-1,0)),
               im.getpixel((0,h-1)), im.getpixel((w-1,h-1))]
    # 1. 真透明：所有角 alpha == 0
    if all(c[3] == 0 for c in corners):
        return "real-alpha"
    # 2. 绿幕：所有角 alpha == 255 且接近 #00ff00
    def is_green(rgba):
        r, g, b, a = rgba
        return a == 255 and g > 180 and r < 80 and b < 80
    if all(is_green(c) for c in corners):
        return "greenscreen"
    # 3. 其它（白底 / 灰底 / 杂色）：模型偷懒，重出
    return "bad-bg"

base = pathlib.Path("src/assets")
buckets = {"real-alpha": [], "greenscreen": [], "bad-bg": []}
for png in base.rglob("*.png"):
    buckets[classify(png)].append(png)

for k, v in buckets.items():
    print(f"{k}: {len(v)} files")
    for p in v[:5]:
        print(f"  {p}")
```

跑出来后：
- `real-alpha` 桶 → 直接合格
- `greenscreen` 桶 → 用 §0.7.2 脚本批量抠图，覆盖原文件
- `bad-bg` 桶 → 全部加进重出清单，**不要尝试自动抠白底**

完成后，把这份文档与生成日志一起归档到 `doc/asset-deliveries/` 下，作为后续重生成的基线。

---

## 17. gpt-img-2 真实 API 约束 / 参数映射

> 本节覆盖 §0.2 / §3 里的"逻辑尺寸"，是 **API 调用真正能跑通** 的硬约束。所有矛盾以本节为准。

### 17.1 实际支持的 size

gpt-img-2 **只接受这 3 个 size 字符串**，其它一律 400：

| size | 用途 |
|---|---|
| `1024x1024` | 方图（sprite / icon / portrait 全部生成在这）|
| `1024x1536` | 竖图（立绘 768×1024 的母版 → 后处理 crop 到 768×1024）|
| `1536x1024` | 横图（章节地图 / splash 1920×1080 的母版 → 后处理 crop + resize）|

文档前面写过的 `64x64` / `96x96` / `80x80` / `128x128` / `256x96` / `768x1024` / `1920x1080` **不是 API 调用参数**，而是 **最终成品尺寸**。生成与最终的对应关系按下表：

| 目标 final size | API 调用 size | 后处理步骤 |
|---|---|---|
| 32×32 / 48×48 / 64×64 / 80×80 / 96×96 / 128×128 | `1024x1024` | trim 透明边距 → alpha-aware lanczos resize 到目标边长 |
| 256×96 UI 按钮 | `1024x1024` | crop 出按钮所在 矩形（要求模型把按钮放在画布中央 1024×384 区域）→ resize |
| 256×256 塔立绘 / Boss portrait | `1024x1024` | trim → resize |
| 512×512 UI 面板 | `1024x1024` | resize（不 trim，因为是平铺纹理）|
| 768×1024 立绘 | `1024x1536` | 左右各 crop 128 → 得到 768×1536 → resize 高度到 1024 |
| 1024×1024 漫画 | `1024x1024` | 不变 |
| 1920×1080 地图 / splash | `1536x1024` | resize 到 1920×1280 → 上下 crop 100 px 得 1920×1080 |

### 17.2 negative_prompt 的拼接方式

gpt-img-2 **没有** 独立的 `negative_prompt` 字段。所有负面词必须以下面这段模板拼到主 prompt 末尾：

```
... 主 prompt 内容 ...

Avoid: <NEGATIVE_BASE 的所有内容，逗号分隔>.
Do NOT include: text, letters, asian characters, signature, watermark,
multiple subjects, 3d render, photo, thick oil paint, facing right
(for monsters), facing left (for heroes), white border, grey border,
transparency checker pattern, green spill on subject.
```

文档前面所有 `[NEGATIVE_BASE]` 标记都按此规则展开。

### 17.3 background 参数

| 值 | 行为 |
|---|---|
| `"transparent"` | 返回 PNG 带 alpha 通道。**模型偶尔偷懒**（见 §0.7）|
| `"opaque"` | 返回 PNG 不带 alpha（背景由模型自由发挥）|
| `"auto"` | 由模型决定 → **禁用**（不可预测）|

### 17.4 reference / edit 接口

reference-first 工作流（§0.4 / §13）依赖 image input。gpt-img-2 通过 **`/images/edits`** 端点接受参考图：

```python
client.images.edit(
    model="gpt-img-2",
    image=open("ref/tiezhu-master.png", "rb"),   # 单张参考
    # 或: image=[open(f, "rb") for f in ref_list]  # 多参考（最多 4 张）
    prompt=full_prompt,
    size="1024x1024",
    background="transparent",
    quality="high",
)
```

注意：
- **edit 端点不接受 `mask`**（除非你显式要 inpaint，这里我们用纯参考模式：`mask` 不传）。
- 单次最多 4 张参考；超出要分批。
- 参考图本身的尺寸不限，建议同样是 1024×1024。

### 17.5 quality / cost

| quality | 用途 | 相对成本 |
|---|---|---|
| `low` | 不推荐，分辨率细节够但风格易漂移 | 1× |
| `medium` | 投射物 / 火花 / 图标这种简单元素可以用 | 2× |
| `high` | 默认值，所有角色 / 怪物 / 塔 / 立绘必须用 | 4× |

> 全量 625 张图全部走 high 大概会比全 medium 贵 2 倍。建议按 §15 优先级：P0/P1 用 high，P2/P3 用 medium，特效 / 图标用 medium。

### 17.6 n / 多候选

gpt-img-2 `n` 默认 1。要 A/B 出多版本时设 `n=2..4`，**强烈推荐**对 master ref（§13 阶段 A）出 `n=4` 然后人工挑一张作为最终 ref，把质量上限拔高。

### 17.7 速率限制实务

OpenAI 默认 gpt-img-2 限速一般是 **5 RPM / 50 IPM**（按账户档位浮动）。625 张串行跑会非常慢，建议：

- **并行 5 路**：5 个并发 worker 共享 token bucket，整体维持 5 RPM。
- **指数退避**：429 错误 → wait = `min(60, 2 ** attempt)` 秒。
- **断点续传**：每张图生成后立即写入 `done.txt`，重启时跳过已完成项（manifest §20 的 status 字段直接记录）。

预估时长：625 张 × (1.2 min/张 / 5 并发) ≈ **2.5 小时**。

---

## 18. 后处理 pipeline（每张图必经）

> 模型出的图基本不能"裸用"。必须过一遍下面的管线才能落到 `src/assets/`。

### 18.1 管线总览

```
API 返回 PNG (1024x1024)
    ↓
[step 1] 透明度三态分类（§16.5）
    ↓
   分桶：real-alpha / greenscreen / bad-bg
    ↓
[step 2] (greenscreen 桶) 抠图 → 进入 real-alpha
[step 2'] (bad-bg 桶) 标记重出 → 跳过
    ↓
[step 3] trim 透明边距（仅 sprite 类）
    ↓
[step 4] alpha-aware resize 到目标尺寸
    ↓
[step 5] 多帧 anchor 对齐（仅动画帧）
    ↓
[step 6] 颜色 / 描边检查（可选）
    ↓
落到 src/assets/{...}.png
```

### 18.2 完整 Python 脚本（`tools/postprocess.py`）

```python
"""
后处理 pipeline。读取 manifest.json，对每张图按 manifest.post 字段执行步骤。
依赖：Pillow >= 10, numpy, opencv-python
"""
import json, pathlib
from PIL import Image, ImageOps
import numpy as np
import cv2

def trim_alpha(im: Image.Image, padding: int = 2) -> Image.Image:
    """裁掉 alpha=0 的边距，保留 padding 像素"""
    bbox = im.getbbox()
    if bbox is None:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(im.width, x1 + padding)
    y1 = min(im.height, y1 + padding)
    return im.crop((x0, y0, x1, y1))

def alpha_aware_resize(im: Image.Image, target: tuple[int, int]) -> Image.Image:
    """
    保持长宽比 resize 后居中粘到 target 画布。
    用 LANCZOS，alpha 通道一起算（避免边缘 fringing）。
    """
    src_w, src_h = im.size
    tgt_w, tgt_h = target
    scale = min(tgt_w / src_w, tgt_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = im.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    canvas.paste(resized, ((tgt_w - new_w) // 2, (tgt_h - new_h) // 2), resized)
    return canvas

def greenscreen_to_alpha(im: Image.Image) -> Image.Image:
    """对绿幕桶图做抠图 + spill 抑制（§0.7.2 Python 版本）"""
    arr = np.array(im.convert("RGBA"))
    bgr = cv2.cvtColor(arr[..., :3], cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (40, 80, 80), (80, 255, 255))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    alpha = 255 - mask
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    g_capped = np.minimum(g, np.maximum(r, b))
    out = np.stack([r, g_capped, b, alpha], axis=-1)
    return Image.fromarray(out, "RGBA")

def classify_bg(im: Image.Image) -> str:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    corners = [rgba.getpixel((0, 0)), rgba.getpixel((w-1, 0)),
               rgba.getpixel((0, h-1)), rgba.getpixel((w-1, h-1))]
    if all(c[3] == 0 for c in corners):
        return "real-alpha"
    if all(c[3] == 255 and c[1] > 180 and c[0] < 80 and c[2] < 80 for c in corners):
        return "greenscreen"
    return "bad-bg"

def anchor_align_frames(frame_paths: list[pathlib.Path], anchor: str = "bottom-center"):
    """
    多帧动画对齐：以第 1 帧的内容质心为锚点，把后续帧的内容平移到同一锚点。
    anchor: 'bottom-center'（脚锚，多数 sprite）、'center'（特效）。
    """
    def content_anchor(im: Image.Image) -> tuple[int, int]:
        arr = np.array(im)
        alpha = arr[..., 3]
        ys, xs = np.where(alpha > 16)
        if len(xs) == 0:
            return im.width // 2, im.height // 2
        if anchor == "bottom-center":
            return int(xs.mean()), int(ys.max())
        return int(xs.mean()), int(ys.mean())

    images = [Image.open(p).convert("RGBA") for p in frame_paths]
    if not images:
        return
    target_anchor = content_anchor(images[0])
    target_size = images[0].size
    for i in range(1, len(images)):
        ax, ay = content_anchor(images[i])
        dx = target_anchor[0] - ax
        dy = target_anchor[1] - ay
        canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
        canvas.paste(images[i], (dx, dy), images[i])
        canvas.save(frame_paths[i])
    # 第 1 帧不动
    images[0].save(frame_paths[0])

def process(entry: dict):
    """对一条 manifest 项做完整后处理"""
    raw = pathlib.Path(entry["raw_path"])
    im = Image.open(raw).convert("RGBA")

    # step 1: 分类
    bucket = classify_bg(im)
    if bucket == "bad-bg":
        print(f"REISSUE NEEDED: {entry['id']} (bad background)")
        return False

    # step 2: 绿幕抠图
    if bucket == "greenscreen":
        im = greenscreen_to_alpha(im)

    # step 3: trim（仅 sprite 类，地图 / 漫画跳过）
    if entry.get("trim", True):
        im = trim_alpha(im, padding=entry.get("trim_padding", 2))

    # step 4: resize
    final_size = tuple(entry["final_size"])
    if entry.get("trim", True):
        im = alpha_aware_resize(im, final_size)
    else:
        im = im.resize(final_size, Image.LANCZOS)

    out = pathlib.Path(entry["out_path"])
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    return True

def main(manifest_path: str):
    manifest = json.loads(pathlib.Path(manifest_path).read_text(encoding="utf-8"))
    ok, fail = 0, 0
    for entry in manifest:
        if process(entry):
            ok += 1
        else:
            fail += 1

    # step 5: 多帧 anchor 对齐（按 group_id 聚合）
    groups: dict[str, list[pathlib.Path]] = {}
    for entry in manifest:
        gid = entry.get("anim_group")
        if gid:
            groups.setdefault(gid, []).append(pathlib.Path(entry["out_path"]))
    for gid, paths in groups.items():
        paths.sort()  # 按文件名 walk-01..04
        anchor_align_frames(paths, anchor="bottom-center")

    print(f"done: {ok} ok, {fail} fail")

if __name__ == "__main__":
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else "manifest.json")
```

### 18.3 关键决策注释

- **trim 仅 sprite 类**：地图 / 漫画 / 立绘是 opaque 背景，没有 alpha 边距，直接跳过 trim。manifest 项里加 `"trim": false`。
- **resize 用 LANCZOS（不是 nearest）**：游戏代码默认 bilinear 采样，asset 也按平滑边缘处理；不是像素艺术。
- **anchor 用 bottom-center**：所有 sprite 在 Phaser 里默认 origin 设为 `(0.5, 1)`（脚底），所以 trim+resize 后必须把"内容质心 y"对齐到 final 画布最底部。
- **anim_group**：manifest 里同一组动画帧用同一 `anim_group` 字段（如 `"tiezhu-walk"`），后处理时统一对齐。

---

## 19. 全局 palette swatch（第 0 张参考图）

风格统一的最强锚点不是文字"warm palette"，而是 **一张色板图作为所有下游生成的 reference**。

### 19.1 palette-master.png 生成 prompt

**`ref/palette-master.png`（1024×1024，opaque，最先生成）**：

```
[STYLE_BASE]
A reference color palette swatch chart, 1024x1024, opaque background.
Display the following named color swatches as labeled rectangles arranged
in a clean 4x6 grid. Each swatch is ~200x140 px with a small text label
below it in plain black sans-serif font. Background is neutral warm cream
#f4ecd8. The swatch colors are exactly:

Row 1 (skin/leather):
  1.1 skin warm  #e8c39c   - hero skin tone
  1.2 leather brown  #8a5a32   - armor straps
  1.3 boot dark  #3a2410   - footwear
  1.4 metal steel  #8a8e96   - sword/armor

Row 2 (signature accents):
  2.1 royal gold  #f2ca73   - crown / trim
  2.2 royal red   #b3261c   - cape / banners
  2.3 hero blue   #2a6ec8   - Ergou hood / mage robe
  2.4 hero silver-white #e8eef5 - Yueguang dress

Row 3 (magic / fx):
  3.1 ice blue    #b8d9ff   - frost effect
  3.2 magma orange #ff6b2a  - fire / lava
  3.3 magic purple #6a3a8a  - void / runes
  3.4 magic teal  #2a8a8a   - poison / nature

Row 4 (monsters):
  4.1 critter cream #fff3d6 - cute monster base
  4.2 grease pink  #e6a6a6  - meat monster
  4.3 shadow black #1a1a1f  - dark beast
  4.4 boss red core #d6422a - yeshi core glow

Row 5 (environment):
  5.1 grass golden #c9a04a  - plains
  5.2 forest moss  #4a6a3a  - forest
  5.3 lava black   #1a1010  - volcano rock
  5.4 snow white   #f0f6fa  - snow mountain

Row 6 (UI):
  6.1 wood dark    #3c2814  - panel
  6.2 wood mid     #5a3a1c  - button default
  6.3 trim gold    #f2ca73  - button trim
  6.4 danger red   #6a1d10  - danger button

Style: clean color chart, hand-painted swatches with subtle warm cream
texture, very small label text. NO photo, NO 3D, just a flat reference
sheet.

Avoid: <NEGATIVE_BASE 展开>, gradient backgrounds, drop shadows on
swatches, decorative borders.
```

### 19.2 reference 矩阵（哪些下游用哪张 ref）

| 下游资源 | 参考图（按顺序传入） |
|---|---|
| 英雄 master ref（§4.2）| `palette-master.png` |
| 英雄动作帧 | `palette-master.png` + `{hero}-master.png` + （非首帧时）`{hero}-{action}-01.png` |
| 塔主立绘 | `palette-master.png` |
| 塔 L1/L2/L3/attack | `palette-master.png` + `{tower}.png`（主立绘）+ `{tower}-l1.png`（如果在生成 L2/L3）|
| 塔分支 | `palette-master.png` + `{tower}.png` + `{tower}-l1.png` |
| 怪物 portrait | `palette-master.png` + （同族先做的那只 portrait，传 1 张作为族系视觉锚）|
| 怪物动画帧 | `palette-master.png` + `{monster}/portrait.png` + （非首帧时）`{monster}/walk-01.png` |
| 章节 Boss | `palette-master.png` + 章节地图（保证调色协调）|
| 章节地图 | `palette-master.png` |
| 漫画分镜 | `palette-master.png` + 出场英雄的 master ref（最多 4 张总数限制注意）|
| 立绘 / splash / menu | `palette-master.png` + 出场角色 master ref |
| 投射物 / 火花 / 光环 | `palette-master.png` |
| UI 按钮 / 面板 / 图标 | `palette-master.png` |

> **4 张参考上限**：edit 端点单次最多 4 张参考图。漫画分镜如果出场角色 ≥ 4 个（如 §9.2 `ch1-prologue-2` 有 Queen + 3 英雄 = 4 个），就把 `palette-master.png` 让出位置，只传 4 张角色 ref。

### 19.3 生成顺序总图

```
Stage 0: palette-master.png （1 张）
   ↓
Stage A1: 3 hero masters / 8 tower portraits / ~30 monster portraits
          / 5 boss portraits / 2 NPC portraits          （~48 张参考资产）
   ↓
Stage B: 所有"首帧"
          - 72 hero action-01
          - 8 tower L1
          - ~30 monster walk-01
          - 5 boss walk-01
          - 7 投射物 / 9 火花 frame 1 / 2 光环             （~125 张）
   ↓
Stage C: 所有"后续帧 / 后续等级 / 分支"
          - 216 hero action-02..04
          - 8 towers × (L2+L3+attack+branches)
          - ~30 monsters × (walk-02..04 + attack + death)
          - 5 boss × 后续帧
          - 多帧 fx frame 2..3
                                                          （~400 张）
   ↓
Stage D: 内容场景
          - 5 maps / 40 comics / 4 splash menu portraits
          - 4 UI buttons / 1 panel / 12 icons             （~62 张）
   ↓
后处理（§18） → 落到 src/assets/
```

---

## 20. 机器可读 manifest

agent 跑批的输入是 **`tools/assets-manifest.json`**：一个数组，每条对应一张图。本节定义 schema + 给出 **生成器脚本** `tools/build_manifest.py`，自动把这份文档里所有 LOCK / 模板展开为完整 manifest（最终 ~625 条）。

### 20.1 manifest schema

```jsonc
[
  {
    "id": "tiezhu-walk-01",                  // 全局唯一 ID
    "stage": "B",                             // Stage 0 / A / B / C / D，决定生成顺序
    "category": "hero-frame",                 // hero-master | hero-frame | hero-portrait |
                                              // tower-portrait | tower-stage | tower-branch |
                                              // monster-portrait | monster-frame | boss-frame |
                                              // projectile | fx-frame | aura |
                                              // map | comic | npc-portrait | splash | menu |
                                              // ui-button | ui-panel | ui-icon | palette
    "prompt": "Hand-drawn fantasy game art... Avoid: ...",  // 已完整拼好（含 STYLE_BASE / LOCK / NEGATIVE 全部）
    "api": {
      "size": "1024x1024",                    // §17.1
      "background": "transparent",             // 或 "opaque"
      "quality": "high",                       // 或 "medium"
      "n": 1
    },
    "refs": [                                  // /images/edits 端点的参考图（按顺序，最多 4 张）
      "ref/palette-master.png",
      "ref/tiezhu-master.png"
    ],
    "raw_path": "raw/tiezhu-walk-01.png",     // API 返回的原图存放位置
    "out_path": "src/assets/heroes/action-sheets/tiezhu-walk-01.png",
    "final_size": [96, 96],                    // 后处理目标 size
    "trim": true,                              // 是否 trim 透明边距
    "trim_padding": 2,
    "anim_group": "tiezhu-walk",               // 同组 anchor 对齐（§18.2 step 5）
    "anchor": "bottom-center",                 // 或 "center"
    "status": "pending"                         // pending | generated | postprocessed | failed
  }
]
```

### 20.2 manifest 示例（首 30 条，可直接喂 agent 跑 Stage 0 + A）

```json
[
  {
    "id": "palette-master",
    "stage": "0",
    "category": "palette",
    "prompt": "Hand-drawn fantasy game art, warm color palette, soft cel-shading, clean clear outlines, mild rim lighting, painterly textures. A reference color palette swatch chart, 1024x1024, opaque background. (展开见 §19.1) Avoid: ...",
    "api": { "size": "1024x1024", "background": "opaque", "quality": "high", "n": 1 },
    "refs": [],
    "raw_path": "raw/palette-master.png",
    "out_path": "ref/palette-master.png",
    "final_size": [1024, 1024],
    "trim": false,
    "status": "pending"
  },
  {
    "id": "tiezhu-master",
    "stage": "A",
    "category": "hero-master",
    "prompt": "(STYLE_BASE) (TIEZHU_LOCK §4.1.1) Master reference sheet of Tiezhu... (§4.2 完整 prompt) Avoid: ...",
    "api": { "size": "1024x1024", "background": "opaque", "quality": "high", "n": 4 },
    "refs": ["ref/palette-master.png"],
    "raw_path": "raw/tiezhu-master.png",
    "out_path": "ref/tiezhu-master.png",
    "final_size": [1024, 1024],
    "trim": false,
    "status": "pending"
  },
  { "id": "ergou-master", "stage": "A", "category": "hero-master", "prompt": "...§4.2 ergou...", "api": { "size": "1024x1024", "background": "opaque", "quality": "high", "n": 4 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/ergou-master.png", "out_path": "ref/ergou-master.png", "final_size": [1024, 1024], "trim": false, "status": "pending" },
  { "id": "yueguang-master", "stage": "A", "category": "hero-master", "prompt": "...§4.2 yueguang...", "api": { "size": "1024x1024", "background": "opaque", "quality": "high", "n": 4 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/yueguang-master.png", "out_path": "ref/yueguang-master.png", "final_size": [1024, 1024], "trim": false, "status": "pending" },

  { "id": "tower-arrow-portrait",     "stage": "A", "category": "tower-portrait", "prompt": "(STYLE_BASE) (TOWER_LOCK §5.1) ...arrow tower portrait... Avoid: ...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/arrow.png", "out_path": "src/assets/towers/arrow.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-mage-portrait",      "stage": "A", "category": "tower-portrait", "prompt": "...mage tower portrait...",  "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/mage.png", "out_path": "src/assets/towers/mage.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-artillery-portrait", "stage": "A", "category": "tower-portrait", "prompt": "...artillery tower portrait...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/artillery.png", "out_path": "src/assets/towers/artillery.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-barracks-portrait",  "stage": "A", "category": "tower-portrait", "prompt": "...barracks tower portrait...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/barracks.png", "out_path": "src/assets/towers/barracks.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-flame-portrait",     "stage": "A", "category": "tower-portrait", "prompt": "...flame tower portrait...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/flame.png", "out_path": "src/assets/towers/flame.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-frost-portrait",     "stage": "A", "category": "tower-portrait", "prompt": "...frost tower portrait...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/frost.png", "out_path": "src/assets/towers/frost.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-altar-portrait",     "stage": "A", "category": "tower-portrait", "prompt": "...altar tower portrait...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/altar.png", "out_path": "src/assets/towers/altar.png", "final_size": [256, 256], "trim": true, "status": "pending" },
  { "id": "tower-gold-portrait",      "stage": "A", "category": "tower-portrait", "prompt": "...gold tower portrait...", "api": { "size": "1024x1024", "background": "transparent", "quality": "high", "n": 1 }, "refs": ["ref/palette-master.png"], "raw_path": "raw/towers/gold.png", "out_path": "src/assets/towers/gold.png", "final_size": [256, 256], "trim": true, "status": "pending" }
]
```

（剩余 ~590 条由 §20.3 生成器自动展开。）

### 20.3 生成器脚本 `tools/build_manifest.py`

```python
"""
读取本文档（doc/AI_IMAGE_GENERATION_BRIEF.md）的关键结构化数据，
自动生成完整 assets-manifest.json。
"""
import json, pathlib, textwrap

# ---------------- 静态常量 ----------------

STYLE_BASE = (
    "Hand-drawn fantasy game art, warm color palette, soft cel-shading, "
    "clean clear outlines, mild rim lighting, painterly textures, slight "
    "2.5D top-down perspective for sprites, consistent with classic JRPG "
    "and indie tower-defense aesthetics; reference style: warm storybook "
    "illustration; no realism, no photo texture; medium saturation, no neon."
)

NEGATIVE = (
    "Avoid: text, letters, asian characters, signature, watermark, "
    "multiple subjects, 3d render, photo, thick oil paint, white border, "
    "grey border, transparency checker pattern, green spill on subject, "
    "drop shadow on ground, multiple characters, weapon swap, color drift."
)

LOCKS = {
    "tiezhu":  "Character: Tiezhu, a stocky Chinese-style young warrior...",  # 完整版从 §4.1.1 复制
    "ergou":   "...",  # §4.1.2
    "yueguang":"...",  # §4.1.3
    "queen":   "...",  # §10.1.1
    "yeshi":   "...",  # §10.1.2
}

PALETTE_REF = "ref/palette-master.png"

# ---------------- 数据定义 ----------------

HEROES   = ["tiezhu", "ergou", "yueguang"]
ACTIONS  = ["walk", "run", "attack", "cast", "ultimate", "defeated"]
HERO_ACTION_FRAMES = {a: 4 for a in ACTIONS}

TOWERS   = ["arrow", "mage", "artillery", "barracks", "flame", "frost", "altar", "gold"]
TOWER_STAGES = ["l1", "l2", "l3", "attack"]
TOWER_BRANCHES = {
    "arrow":     ["hawkeye", "burst"],
    "mage":      ["frost", "fire"],
    "artillery": ["howitzer", "shrapnel"],
    "barracks":  ["shield", "spear"],
    "flame":     [],
    "frost":     [],
    "altar":     ["heal", "rage"],
    "gold":      [],
}

MONSTERS = [
    # (id, family, tier_size)
    ("m01-marshmallow-rabbit", "01", 64),
    ("m01-cotton-puff",        "01", 64),
    ("m02-hyacinth-sprite",    "02", 64),
    ("m02-honey-snail",        "02", 64),
    ("m02-mushcap-imp",        "02", 64),
    ("m05-blob-yellow",        "05", 64),
    ("m05-ghost-kid",          "05", 64),
    ("m05-pink-slime",         "05", 64),
    ("m08-candy-cannoneer",    "08", 80),
    ("m08-spark-wisp",         "08", 80),
    ("m08-flame-sprite",       "08", 80),
    ("m03-clockwork-knight",   "03", 80),
    ("m03-crystal-dragonling", "03", 80),
    ("m03-jelly-king",         "03", 80),
    ("m04-grease-slime",       "04", 80),
    ("m04-meat-centipede",     "04", 80),
    ("m04-lard-bulldog",       "04", 80),
    ("m06-shadow-wolf",        "06", 128),
    ("m06-void-stalker",       "06", 128),
]
MONSTER_CREATURE_DESC = {  # 从 §6.3 抄过来
    "m01-marshmallow-rabbit": "a fluffy round-bodied marshmallow rabbit, two long floppy ears, sky-blue belly patch, big black bead eyes, soft pink nose, tiny white paws",
    "m01-cotton-puff":        "a cotton-puff sprite, ball of fluff with two small leaf hands and twig legs, smiling closed-eye face",
    # ... 此处每只怪物都填上 §6.3 里的英文描述
}
MONSTER_FAMILY_LOCK = {  # §6.2
    "01": "Cute fluffy fantasy creature, round body, large expressive eyes, soft pastel-warm colors, marshmallow / hamster aesthetic, harmless adorable look. Palette: cream, pink, sky blue, butter yellow.",
    "02": "Cute mid-size fantasy critter, slightly mischievous face, wind-spirit / flower-sprite aesthetic, small horns or leaves, soft warm colors. Palette: mint green, lavender, pale gold.",
    "03": "Mid-tier mythic creature with stronger silhouette: mechanical, dragonkin, or jellyfish-king aesthetic, glowing eyes, partial armor or plates. Palette: brass, deep teal, crystal blue, dark navy.",
    "04": "Greasy meat-monster: sausage-like body, centipede sections, or bulldog mass. Oily glistening skin highlights, vaguely gross but stylized. Palette: warm beige, pink, oily brown, sickly yellow.",
    "05": "Cartoon pixel-style cute creature with simple shapes (blob / ghost / critter), pure-color blocks, child-friendly silhouette. Palette: bright yellow, pure white, pure blue, pure pink.",
    "06": "Fierce dark fantasy beast: sharp teeth, tattered fur, glowing red or purple eyes, ominous silhouette, dramatic high-contrast lighting. Palette: shadow black, blood red, void purple, dim grey.",
    "08": "Stylized creature with attached visual effect (lightning sparks, fire embers, magic wisps). Candy-cannon / magical-wisp aesthetic, vibrant accent color glow around the body.",
}

BOSSES = [
    ("boss-warbear",     1, "A heavy plains warbear..."),
    ("boss-vinewood",    2, "A massive plant boss..."),
    ("boss-magmagolem",  3, "A towering lava golem..."),
    ("boss-frostknight", 4, "An icy lieutenant..."),
    ("boss-yeshi",       5, "Yeshi, the Devourer of Night..."),
]

PROJECTILES = [
    ("arrow",        32, "a slender wooden arrow pointing right..."),
    ("arrow-burst",  48, "an arrow with a glowing red-orange explosive tip..."),
    ("arrow-hawk",   32, "a slim sleek arrow with metallic head..."),
    ("magic-bolt",   32, "a glowing violet-blue magic orb..."),
    ("meteor",       64, "a burning meteor falling at 45 degrees..."),
    ("shrapnel",     32, "a single jagged piece of grey metal shrapnel..."),
    ("frost-shard",  32, "a pale icy-blue translucent crystal shard..."),
]

FX_SEQS = [
    ("flame-puff",  48, 3),
    ("hit-spark",   32, 3),
    ("block-spark", 32, 3),
]

AURAS = [
    ("slow-ring", 64, "pale ice-blue translucent ring with snowflake motifs..."),
    ("heal-ring", 64, "soft white-green translucent ring with leaf motifs..."),
]

MAPS = [
    (1, "golden grassland borderland at sunset hour..."),
    (2, "deep ancient forest at twilight..."),
    (3, "volcanic mountain road with magma cracks..."),
    (4, "northern snow-mountain pass during a light blizzard..."),
    (5, "deep underground abyss cavern with rune-stone pillars..."),
]

COMICS = [  # (filename, chapter, characters, panel desc)
    # 见 §9，每章 8 格，共 40 条
    ("ch1-prologue-1", 1, ["queen"], "Royal capital plaza at dawn..."),
    # ...（完整数据从 §9.2..§9.6 复制）
]

ICONS = [
    ("coin",                "a single round gold coin..."),
    ("blueprint",           "a tightly rolled blueprint scroll..."),
    ("blueprint-fragment",  "a torn jagged corner of blueprint paper..."),
    ("heart",               "a simple stylized round red heart..."),
    ("heart-shield",        "a red heart inside a steel shield..."),
    ("skill-tiezhu",        "top-down warhammer with golden aura..."),
    ("skill-ergou",         "three arrows in a fan pattern..."),
    ("skill-yueguang",      "glowing crescent moon with stars..."),
    ("equipment-weapon",    "two swords crossed in an X..."),
    ("equipment-armor",     "a round steel chestplate..."),
    ("equipment-trinket",   "a teardrop blue gemstone in gold setting..."),
    ("easter-egg",          "a small wrapped golden gift box..."),
]

BUTTONS = ["default", "hover", "disabled", "danger"]

# ---------------- 构建函数 ----------------

def make_entry(*, id, stage, category, prompt, size, bg, qual, refs,
               raw, out, final, trim=True, anim_group=None, anchor="bottom-center", n=1):
    return {
        "id": id, "stage": stage, "category": category,
        "prompt": prompt + " " + NEGATIVE,
        "api": {"size": size, "background": bg, "quality": qual, "n": n},
        "refs": refs,
        "raw_path": f"raw/{raw}",
        "out_path": out,
        "final_size": list(final),
        "trim": trim,
        "trim_padding": 2,
        "anim_group": anim_group,
        "anchor": anchor,
        "status": "pending",
    }

def build():
    out = []

    # Stage 0
    out.append(make_entry(
        id="palette-master", stage="0", category="palette",
        prompt=STYLE_BASE + " (palette swatch §19.1 完整文本)",
        size="1024x1024", bg="opaque", qual="high", refs=[],
        raw="palette-master.png", out=PALETTE_REF, final=(1024, 1024), trim=False,
    ))

    # Stage A: hero masters
    for hero in HEROES:
        out.append(make_entry(
            id=f"{hero}-master", stage="A", category="hero-master",
            prompt=f"{STYLE_BASE} {LOCKS[hero]} (master ref §4.2)",
            size="1024x1024", bg="opaque", qual="high", n=4,
            refs=[PALETTE_REF],
            raw=f"{hero}-master.png", out=f"ref/{hero}-master.png",
            final=(1024, 1024), trim=False,
        ))

    # Stage A: tower portraits
    for t in TOWERS:
        out.append(make_entry(
            id=f"tower-{t}-portrait", stage="A", category="tower-portrait",
            prompt=f"{STYLE_BASE} (TOWER_LOCK §5.1) {t} tower portrait (§5.3)",
            size="1024x1024", bg="transparent", qual="high",
            refs=[PALETTE_REF],
            raw=f"towers/{t}.png", out=f"src/assets/towers/{t}.png",
            final=(256, 256),
        ))

    # Stage A: monster portraits
    for mid, fam, _ in MONSTERS:
        out.append(make_entry(
            id=f"{mid}-portrait", stage="A", category="monster-portrait",
            prompt=f"{STYLE_BASE} {MONSTER_FAMILY_LOCK[fam]} portrait of {MONSTER_CREATURE_DESC.get(mid,'TBD')}",
            size="1024x1024", bg="transparent", qual="high",
            refs=[PALETTE_REF],
            raw=f"enemies/{mid}/portrait.png",
            out=f"src/assets/portraits/monsters/{mid}.png",
            final=(256, 256),
        ))

    # Stage A: boss portraits
    for bid, ch, desc in BOSSES:
        out.append(make_entry(
            id=f"{bid}-portrait", stage="A", category="boss-frame",
            prompt=f"{STYLE_BASE} {desc} portrait, 3/4 view",
            size="1024x1024", bg="transparent", qual="high",
            refs=[PALETTE_REF],
            raw=f"bosses/{bid}/portrait.png",
            out=f"src/assets/enemies/{bid}/portrait.png",
            final=(256, 256),
        ))

    # Stage B: hero action 01
    for hero in HEROES:
        for action in ACTIONS:
            out.append(make_entry(
                id=f"{hero}-{action}-01", stage="B", category="hero-frame",
                prompt=f"{STYLE_BASE} {LOCKS[hero]} action {action} frame 01 (§4.3)",
                size="1024x1024", bg="transparent", qual="high",
                refs=[PALETTE_REF, f"ref/{hero}-master.png"],
                raw=f"heroes/{hero}-{action}-01.png",
                out=f"src/assets/heroes/action-sheets/{hero}-{action}-01.png",
                final=(96, 96),
                anim_group=f"{hero}-{action}",
            ))

    # Stage B: tower L1
    for t in TOWERS:
        out.append(make_entry(
            id=f"tower-{t}-l1", stage="B", category="tower-stage",
            prompt=f"{STYLE_BASE} {t} tower L1 (§5.4)",
            size="1024x1024", bg="transparent", qual="high",
            refs=[PALETTE_REF, f"src/assets/towers/{t}.png"],
            raw=f"towers/{t}-l1.png", out=f"src/assets/towers/{t}-l1.png",
            final=(96, 96),
        ))

    # Stage B: monster walk-01
    for mid, fam, sz in MONSTERS:
        out.append(make_entry(
            id=f"{mid}-walk-01", stage="B", category="monster-frame",
            prompt=f"{STYLE_BASE} {MONSTER_FAMILY_LOCK[fam]} {MONSTER_CREATURE_DESC.get(mid,'')} walk frame 01 (§6.5)",
            size="1024x1024", bg="transparent", qual="high",
            refs=[PALETTE_REF, f"src/assets/portraits/monsters/{mid}.png"],
            raw=f"enemies/{mid}/walk-01.png",
            out=f"src/assets/enemies/{mid}/walk-01.png",
            final=(sz, sz),
            anim_group=f"{mid}-walk",
        ))

    # Stage B: projectiles (单帧)
    for pid, sz, desc in PROJECTILES:
        out.append(make_entry(
            id=f"proj-{pid}", stage="B", category="projectile",
            prompt=f"{STYLE_BASE} {desc} (§7.2)",
            size="1024x1024", bg="transparent", qual="medium",
            refs=[PALETTE_REF],
            raw=f"projectiles/{pid}.png",
            out=f"src/assets/projectiles/{pid}.png",
            final=(sz, sz),
            anchor="center",
        ))

    # Stage B/C: 多帧 fx
    for fid, sz, count in FX_SEQS:
        for i in range(1, count + 1):
            stage = "B" if i == 1 else "C"
            refs = [PALETTE_REF] if i == 1 else [PALETTE_REF, f"src/assets/projectiles/{fid}-1.png"]
            out.append(make_entry(
                id=f"fx-{fid}-{i}", stage=stage, category="fx-frame",
                prompt=f"{STYLE_BASE} {fid} frame {i} of {count} (§7.3)",
                size="1024x1024", bg="transparent", qual="medium",
                refs=refs,
                raw=f"fx/{fid}-{i}.png",
                out=f"src/assets/projectiles/{fid}-{i}.png",
                final=(sz, sz),
                anchor="center",
                anim_group=f"fx-{fid}",
            ))

    # Stage B: auras
    for aid, sz, desc in AURAS:
        out.append(make_entry(
            id=f"aura-{aid}", stage="B", category="aura",
            prompt=f"{STYLE_BASE} {desc} (§7.4)",
            size="1024x1024", bg="transparent", qual="medium",
            refs=[PALETTE_REF],
            raw=f"fx/{aid}.png",
            out=f"src/assets/projectiles/{aid}.png",
            final=(sz, sz),
            anchor="center",
        ))

    # Stage C: hero action 02..04
    for hero in HEROES:
        for action in ACTIONS:
            for f in (2, 3, 4):
                out.append(make_entry(
                    id=f"{hero}-{action}-{f:02d}", stage="C", category="hero-frame",
                    prompt=f"{STYLE_BASE} {LOCKS[hero]} action {action} frame {f:02d} (§4.3)",
                    size="1024x1024", bg="transparent", qual="high",
                    refs=[PALETTE_REF, f"ref/{hero}-master.png",
                          f"src/assets/heroes/action-sheets/{hero}-{action}-01.png"],
                    raw=f"heroes/{hero}-{action}-{f:02d}.png",
                    out=f"src/assets/heroes/action-sheets/{hero}-{action}-{f:02d}.png",
                    final=(96, 96),
                    anim_group=f"{hero}-{action}",
                ))

    # Stage C: tower L2/L3/attack
    for t in TOWERS:
        for stage in ["l2", "l3", "attack"]:
            out.append(make_entry(
                id=f"tower-{t}-{stage}", stage="C", category="tower-stage",
                prompt=f"{STYLE_BASE} {t} tower {stage} based on L1 footprint (§5.4)",
                size="1024x1024", bg="transparent", qual="high",
                refs=[PALETTE_REF, f"src/assets/towers/{t}.png",
                      f"src/assets/towers/{t}-l1.png"],
                raw=f"towers/{t}-{stage}.png",
                out=f"src/assets/towers/{t}-{stage}.png",
                final=(96, 96),
            ))
        for br in TOWER_BRANCHES[t]:
            out.append(make_entry(
                id=f"tower-{t}-branch-{br}", stage="C", category="tower-branch",
                prompt=f"{STYLE_BASE} {t} tower branch {br} (§5.5)",
                size="1024x1024", bg="transparent", qual="high",
                refs=[PALETTE_REF, f"src/assets/towers/{t}.png",
                      f"src/assets/towers/{t}-l1.png"],
                raw=f"towers/{t}-branch-{br}.png",
                out=f"src/assets/towers/{t}-branch-{br}.png",
                final=(96, 96),
            ))

    # Stage C: monster walk-02..04 + attack-01..03 + death-01..03
    for mid, fam, sz in MONSTERS:
        for f in (2, 3, 4):
            out.append(make_entry(
                id=f"{mid}-walk-{f:02d}", stage="C", category="monster-frame",
                prompt=f"{STYLE_BASE} {MONSTER_FAMILY_LOCK[fam]} {MONSTER_CREATURE_DESC.get(mid,'')} walk frame {f} (§6.5)",
                size="1024x1024", bg="transparent", qual="high",
                refs=[PALETTE_REF, f"src/assets/portraits/monsters/{mid}.png",
                      f"src/assets/enemies/{mid}/walk-01.png"],
                raw=f"enemies/{mid}/walk-{f:02d}.png",
                out=f"src/assets/enemies/{mid}/walk-{f:02d}.png",
                final=(sz, sz),
                anim_group=f"{mid}-walk",
            ))
        for act, prefix in [("attack", "attack"), ("death", "death")]:
            for f in (1, 2, 3):
                out.append(make_entry(
                    id=f"{mid}-{prefix}-{f:02d}", stage="C", category="monster-frame",
                    prompt=f"{STYLE_BASE} {MONSTER_FAMILY_LOCK[fam]} {MONSTER_CREATURE_DESC.get(mid,'')} {act} frame {f} (§6.5)",
                    size="1024x1024", bg="transparent", qual="high",
                    refs=[PALETTE_REF, f"src/assets/portraits/monsters/{mid}.png",
                          f"src/assets/enemies/{mid}/walk-01.png"],
                    raw=f"enemies/{mid}/{prefix}-{f:02d}.png",
                    out=f"src/assets/enemies/{mid}/{prefix}-{f:02d}.png",
                    final=(sz, sz),
                    anim_group=f"{mid}-{act}",
                ))

    # Stage D: maps
    for ch, desc in MAPS:
        out.append(make_entry(
            id=f"map-ch{ch}", stage="D", category="map",
            prompt=f"{STYLE_BASE} (HEAD-map §8.1) chapter {ch} theme: {desc}",
            size="1536x1024", bg="opaque", qual="high",
            refs=[PALETTE_REF],
            raw=f"maps/chapter-{ch}.png",
            out=f"src/assets/maps/chapter-{ch}.png",
            final=(1920, 1080), trim=False,
        ))

    # Stage D: comics
    for fname, ch, chars, desc in COMICS:
        refs = [PALETTE_REF] + [f"ref/{c}-master.png" for c in chars if c in LOCKS]
        refs = refs[:4]  # 4 张上限
        out.append(make_entry(
            id=fname, stage="D", category="comic",
            prompt=f"{STYLE_BASE} (HEAD-comic §9.1) {desc}",
            size="1024x1024", bg="opaque", qual="high",
            refs=refs,
            raw=f"comics/{fname}.png",
            out=f"src/assets/comics/{fname}.png",
            final=(1024, 1024), trim=False,
        ))

    # Stage D: NPC portraits + splash + menu
    out.append(make_entry(
        id="portrait-queen", stage="D", category="npc-portrait",
        prompt=f"{STYLE_BASE} {LOCKS['queen']} full body portrait (§10.2)",
        size="1024x1536", bg="opaque", qual="high",
        refs=[PALETTE_REF],
        raw="portraits/queen.png", out="src/assets/portraits/queen.png",
        final=(768, 1024), trim=False,
    ))
    out.append(make_entry(
        id="portrait-yeshi", stage="D", category="npc-portrait",
        prompt=f"{STYLE_BASE} {LOCKS['yeshi']} full body portrait (§10.2)",
        size="1024x1536", bg="opaque", qual="high",
        refs=[PALETTE_REF],
        raw="portraits/yeshi.png", out="src/assets/portraits/yeshi.png",
        final=(768, 1024), trim=False,
    ))
    out.append(make_entry(
        id="splash-main", stage="D", category="splash",
        prompt=f"{STYLE_BASE} splash screen composition (§10.2)",
        size="1536x1024", bg="opaque", qual="high",
        refs=[PALETTE_REF, "ref/tiezhu-master.png",
              "ref/ergou-master.png", "ref/yueguang-master.png"],
        raw="splash/splash_main.png", out="src/assets/splash/splash_main.png",
        final=(1920, 1080), trim=False,
    ))
    out.append(make_entry(
        id="menu-bg", stage="D", category="menu",
        prompt=f"{STYLE_BASE} main menu background (§10.2)",
        size="1536x1024", bg="opaque", qual="high",
        refs=[PALETTE_REF, "ref/tiezhu-master.png",
              "ref/ergou-master.png", "ref/yueguang-master.png"],
        raw="menu/menu_bg.png", out="src/assets/menu/menu_bg.png",
        final=(1920, 1080), trim=False,
    ))

    # Stage D: UI buttons / panel / icons
    for state in BUTTONS:
        out.append(make_entry(
            id=f"ui-btn-{state}", stage="D", category="ui-button",
            prompt=f"{STYLE_BASE} button state {state} (§11.1)",
            size="1024x1024", bg="transparent", qual="medium",
            refs=[PALETTE_REF],
            raw=f"ui/btn-{state}.png", out=f"src/assets/ui/btn-{state}.png",
            final=(256, 96), trim=True,
        ))
    out.append(make_entry(
        id="ui-panel-wood", stage="D", category="ui-panel",
        prompt=f"{STYLE_BASE} seamless wood plank texture (§11.2)",
        size="1024x1024", bg="opaque", qual="medium",
        refs=[PALETTE_REF],
        raw="ui/panel-wood.png", out="src/assets/ui/panel-wood.png",
        final=(512, 512), trim=False,
    ))
    for iid, desc in ICONS:
        out.append(make_entry(
            id=f"icon-{iid}", stage="D", category="ui-icon",
            prompt=f"{STYLE_BASE} icon: {desc} (§11.3)",
            size="1024x1024", bg="transparent", qual="medium",
            refs=[PALETTE_REF],
            raw=f"icons/{iid}.png", out=f"src/assets/icons/{iid}.png",
            final=(64, 64),
            anchor="center",
        ))

    return out

if __name__ == "__main__":
    manifest = build()
    pathlib.Path("tools/assets-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"wrote {len(manifest)} entries")
```

### 20.4 跑批主循环（消费 manifest）

```python
"""tools/run_batch.py — agent 主循环"""
import json, pathlib, time
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor

client = OpenAI()
MANIFEST = pathlib.Path("tools/assets-manifest.json")

def call_one(entry):
    if entry["status"] != "pending":
        return
    raw = pathlib.Path(entry["raw_path"])
    raw.parent.mkdir(parents=True, exist_ok=True)

    refs = [open(p, "rb") for p in entry["refs"] if pathlib.Path(p).exists()]
    try:
        if refs:
            resp = client.images.edit(
                model="gpt-img-2",
                image=refs if len(refs) > 1 else refs[0],
                prompt=entry["prompt"],
                size=entry["api"]["size"],
                background=entry["api"]["background"],
                quality=entry["api"]["quality"],
                n=entry["api"]["n"],
            )
        else:
            resp = client.images.generate(
                model="gpt-img-2",
                prompt=entry["prompt"],
                size=entry["api"]["size"],
                background=entry["api"]["background"],
                quality=entry["api"]["quality"],
                n=entry["api"]["n"],
            )
        # 保存（如果 n>1，目前简单存第 1 张；A 阶段建议手挑）
        import base64
        img_bytes = base64.b64decode(resp.data[0].b64_json)
        raw.write_bytes(img_bytes)
        entry["status"] = "generated"
    except Exception as e:
        entry["status"] = "failed"
        entry["error"] = str(e)
    finally:
        for r in refs:
            r.close()

def run():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    # 按 stage 顺序，stage 内并发 5
    for stage in ("0", "A", "B", "C", "D"):
        batch = [e for e in manifest if e["stage"] == stage]
        print(f"=== stage {stage}: {len(batch)} entries ===")
        with ThreadPoolExecutor(max_workers=5) as ex:
            list(ex.map(call_one, batch))
        # 写回 manifest 保存进度
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                            encoding="utf-8")
        # 在进入下一 stage 前跑后处理（让后续 stage 能用到后处理结果作为 ref）
        import subprocess
        subprocess.run(["python", "tools/postprocess.py",
                        str(MANIFEST)], check=True)

if __name__ == "__main__":
    run()
```

### 20.5 一次跑通的执行顺序

```powershell
# 1. 生成完整 manifest
python tools/build_manifest.py

# 2. 跑批（自动按 stage 0→A→B→C→D 顺序，每个 stage 后跑后处理）
python tools/run_batch.py

# 3. 抠图（如有绿幕桶）
python tools/postprocess.py tools/assets-manifest.json

# 4. 自检
bash tools/integrity_check.sh   # §16 各项验证
python tools/classify_bg.py     # §16.5 三态分类
```

跑完后 `src/assets/` 目录下应有 ≥ 600 张图，全部命名规范、尺寸正确、透明度合格、动画帧锚点对齐——可直接被 `src/scenes/GameScene.js` 加载。
