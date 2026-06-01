<div align="center">

[英文版](README.md)

# 🌌 Nomai Reversible
### 可逆 Nomai 螺旋文字生成器

<p>
  <sub><em>“宇宙很古老，而且很大。我们的种族存在的时间，不过是宇宙打了个盹的功夫。<br/>但这不意味着我们的存在没有意义。”</em></sub><br/>
  <sub><em>“我从未见过你的同族。能与你交谈是我的荣幸。”</em></sub>
</p>

![Nomai 示例](examples/hello.svg)

</div>

Nomai Reversible 是一个开源的 Nomai 风格文字工具。它可以把任意 Unicode 文本生成类似 Nomai 螺旋墙文的 SVG 图像，并且可以把本工具生成的 SVG 精确解码回原始文本。

本项目的视觉灵感来自《Outer Wilds》的 Nomai 文字，以及 Evan Fields 的优秀开源项目 [NomaiText.jl](https://github.com/evanfields/NomaiText.jl)。本项目不是 Outer Wilds、Mobius Digital 或 NomaiText.jl 的官方项目。

## 项目简介

### 起因

我们最初想做的事情很简单：让任何语言都能和 Nomai 文字“互通”。也就是说，中文、英文、日文、emoji 或混合 Unicode 文本，都可以生成类似游戏原文的 Nomai 螺旋文字；生成后的图像又可以被 decoder 精确还原成原文。

这个目标背后有两个动机：一是《Outer Wilds》里的 Nomai 文字非常有辨识度，螺旋、分支、点线结构很适合做成可分享的视觉语言；二是普通的“外星文字生成器”往往只能生成一张好看的图，无法可靠解码。我们希望它既像 Nomai，又能真正被机器读回去。

### 遇到的问题

真正研究后会发现，Nomai 文字并不是一个现成的、可以直接查表翻译的自然语言系统。游戏里的文本由翻译工具显示为玩家语言，但墙面上的 Nomai 图形本身更接近美术化的书写系统：有螺旋、分支、作者对话痕迹和一致的视觉语法，却没有公开的官方音素表、词典或语法。

社区也有类似结论。比如 [YanWittmann/ow-written-nomai-lang](https://github.com/YanWittmann/ow-written-nomai-lang) 在 README 中说明，它生成的是“类似 Nomai 语言”的图像，因为游戏并没有真正可翻译的 Nomai 语言；该项目转而采用 Reddit 用户提出的音素映射方案。Evan Fields 的 [NomaiText.jl](https://github.com/evanfields/NomaiText.jl) / [Nomai Writing](https://nomai-writing.com/) 则选择另一条路线：把任意 Unicode 文本编码成大整数，再用这个整数驱动 glyph、连接和螺旋排版。

所以本项目遇到的核心问题不是“缺一个字体”，而是三件事同时成立很难：

- **视觉要像游戏原文**：不能只把字母换成奇怪符号，需要有 Nomai 式螺旋、分支和点线结构。
- **内容要支持全世界语言**：不能只支持英文或 ASCII，必须能处理中文、日文、emoji 等 Unicode。
- **结果要完全可逆**：生成图像后，还要能稳定恢复原始文本，而不是只得到一张无法读回去的装饰图。

### 我们的解决方案

Nomai Reversible 最终采用“视觉仿真 + 可逆编码”的折中方案：

1. 原始文本先进入稳定的 JSON envelope，保留文本、seed、handwriting 等信息。
2. envelope 被编码成 `NOMAI1-*` token，并带 CRC32 checksum。
3. 原始文本同时被转换成大整数 oracle，用来驱动 NomaiText.jl 风格的 glyph 选择、glyph-grid 排布和连接点选择。
4. 渲染器把 glyph grid 排版到类 Luxor logarithmic spiral 上，生成 Nomai 风格 SVG。
5. SVG 内写入 metadata 和 token；可选再加入右下角小 QR，以及网页中的独立 `Token QR`。
6. decoder 不依赖截图 OCR，而是从 SVG metadata、`NOMAI1-*` token 或 QR 链接中恢复原文。

这样做的结果是：视觉上尽量接近 NomaiText.jl / 游戏墙文的风格，功能上又能保证本工具生成的内容可以 100% 反解。它不是“破解官方 Nomai 语言”，而是一个开源、可 fork、可修改的可逆 Nomai 风格文字系统。

### 最终成果展示

当前版本已经提供一个可用的 Web 和 CLI 工具：

- 在线体验：[https://nomai.uk/](https://nomai.uk/)
- 输入任意语言文本，生成 Nomai 螺旋 SVG。
- 保存 SVG 到本地，或复制 SVG / token。
- 从 SVG、`NOMAI1-*` token、右下角 QR、独立 `Token QR` 或图库二维码图片解码回原文。
- Web 界面支持中文 / English 切换。
- 默认使用 Unicode 友好的 base `200000`，适合中文、emoji、日文等混合文本。
- 生成的 SVG 仍然是一张可分享的 Nomai 风格图像，但同时保留可逆 metadata。

也就是说，生成的 SVG 不只是装饰图。每个 SVG 都带有 `NOMAI1-*` token 和 metadata，decoder 可以用它们恢复原始 Unicode 文本。

## 特性

- **可逆输出**：从本工具生成的 SVG 或 `NOMAI1-*` token 恢复原文。
- **支持 Unicode**：可以编码中文、英文、日文、emoji 和混合语言文本。
- **NomaiText.jl 风格渲染**：使用 glyph grid、polygon glyph、annotation、外圈放大和类 Luxor logarithmic spiral。
- **碰撞保护**：通过全局增加 spiral period 和安全连接点选择，减少或避免笔画重叠。
- **Web 和 CLI**：既可以用浏览器界面快速试验，也可以用命令行批量生成。
- **可自由修改**：MIT License，TypeScript 代码量较小，适合 fork 和二次开发。

## 快速开始

```powershell
npm install
npm test
npm run build
npm run dev
```

然后打开：

```text
http://127.0.0.1:5173/
```

## 命令行

生成 SVG：

```powershell
npm run cli -- encode "Hello Nomai!" --out examples\hello.svg
```

生成包含 SVG 和 token 的 JSON：

```powershell
npm run cli -- encode "你好，Nomai。今天适合看星星。" --json
```

从 SVG 解码：

```powershell
npm run cli -- decode examples\hello.svg
```

从 token 解码：

```powershell
npm run cli -- decode NOMAI1-...
```

## 网页流程

1. 输入需要编码的文本。
2. 根据需要调整 seed 或 handwriting。
3. 如果希望手机相机扫描 token，可以打开 `Camera QR`，SVG 右下角会带一个小 QR，网页里也会显示独立 `Token QR`。
4. 保存 SVG 到本地，或者复制 SVG / token。
5. 在 decoder 区域粘贴 SVG / token，上传生成的 `.svg` 文件，或者从图库选择二维码图片。
6. 也可以点击 `Scan Camera`，用摄像头对准 `Camera QR`；扫到的 token 或扫码链接会自动导入并解码。
7. 解码回原始文本。

## 文本字段说明

`Text` 是唯一核心文本。你可以在这里输入中文、英文、日文、emoji 或混合语言 Unicode 文本；它决定可见的 Nomai 图形，也决定 decoder 恢复出的结果。

网页界面不再单独显示 English reading 字段。旧 SVG 解码时仍然可以读出已有的读音或翻译 metadata，但新网页输出只由这个多语言文本字段驱动。

网页界面可以在中文和英文之间切换，不会把两个语言硬混在同一个控件里。

`Camera QR` 是可选项。它会在 SVG 右下角加入一个较小的 QR 层，同时在网页里显示一个更大的独立 `Token QR`。QR 内容是 `https://nomai.uk/#nomai=...` 扫码链接，所以手机系统相机也可以直接打开 decoder。无论是否开启，SVG metadata 仍然保留。

`Scan Camera` 会在浏览器中读取这个 QR，并从裸 token 或扫码链接中提取 `NOMAI1-*` token 自动导入 decoder。摄像头权限在 `localhost` 可用；手机浏览器通常需要 HTTPS。decoder 也可以扫描从图库选择的本地二维码图片。

## 工作原理

1. 原始文本被保存到稳定的 JSON envelope。
2. envelope 被编码成带 CRC32 checksum 的 `NOMAI1-*` token。
3. 原始文本被转换成一个大整数 oracle。
4. oracle 驱动 glyph 选择、glyph-grid 位置和连接点选择。
5. glyph grid 被排版到类 Luxor logarithmic spiral 上，并渲染成 SVG。
6. decoder 从 SVG metadata 或 token 中恢复 envelope，再恢复原文。

## 渲染说明

当前渲染器是 NomaiText.jl 风格 `draw_spiral` 流程的 TypeScript 端口。它使用：

- Unicode 友好的视觉 oracle base：`200000`；
- 三行 glyph grid；
- polygon glyph 和 annotation；
- 类 `PathGridLayout` 的缩放、间距和方向规则；
- 基于 Luxor `spiral(164, .29, log=true)` 行为的 logarithmic spiral；
- 在需要更多间距时，通过全局增加 period 处理碰撞。

运行时不需要安装 Julia。

## 限制

- 可逆性只适用于本项目生成的 SVG / token。
- 不支持从任意截图、PNG 或手绘图像 OCR 回原文。
- 这是粉丝向文字系统，不是游戏官方可翻译 Nomai 语言。
- SVG 是主要输出格式。普通字体和普通输入法不能直接排版完整螺旋文字。

## 后续方向

- 改进长文本的视觉密度。
- 增加精选示例和视觉回归测试。
- 探索线性 token 字体和 Keyman 输入法资源。
- 可选接入开源翻译或音标工具，用于阅读 metadata。

## 致谢

- 视觉和算法灵感：[evanfields/NomaiText.jl](https://github.com/evanfields/NomaiText.jl)
- 社区参考：[YanWittmann/ow-written-nomai-lang](https://github.com/YanWittmann/ow-written-nomai-lang)
- 原始虚构文字美术：《Outer Wilds》与 Mobius Digital

## 许可证

MIT。见 [LICENSE](LICENSE)。
