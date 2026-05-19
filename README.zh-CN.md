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

## 项目目标

很多虚构文字生成器只关注视觉效果，或者只关注语言规则。Nomai Reversible 的目标稍微不同：尽量保留 Nomai 螺旋文字的观感，同时保证生成结果可以机器反解。

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
3. 下载 SVG，或者复制 SVG / token。
4. 在 decoder 区域粘贴 SVG / token，也可以上传生成的 `.svg` 文件。
5. 解码回原始文本。

## 文本字段说明

`Text to encode and decode` 是核心文本。它决定可见的 Nomai 图形，也决定 decoder 恢复出的结果。

`English reading metadata` 是可选字段。你可以把它当作英文读音、英文翻译或阅读备注。它会被保存到 metadata 中，但不会改变 Nomai 图形。

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
