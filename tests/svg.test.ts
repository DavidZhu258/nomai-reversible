import { describe, expect, test } from "vitest";
import { decodeNomaiSvg } from "../src/decode/svgDecoder";
import { renderNomaiSvg } from "../src/render/svgRenderer";

describe("NomaiText.jl upstream-style SVG rendering and decoding", () => {
  test("renders a metadata-backed NomaiText.jl draw_spiral style SVG that decodes exactly", () => {
    const svg = renderNomaiSvg("Hello Nomai! How are you?", {
      pivotEnglish: "Hello Nomai! How are you?",
      sourceLang: "en",
      seed: 47,
      handwriting: 0.2,
      style: "nomai-text-jl"
    });
    const decoded = decodeNomaiSvg(svg);

    expect(decoded.originalText).toBe("Hello Nomai! How are you?");
    expect(decoded.checksumOk).toBe(true);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<metadata");
    expect(svg).toContain("data-nomai-token-stream");
    expect(svg).toContain('data-nomai-renderer="nomai-text-jl-upstream-port-v1"');
    expect(svg).toContain('data-upstream-project="evanfields/NomaiText.jl"');
    expect(svg).toContain('data-upstream-behavior="draw_spiral"');
    expect(svg).toContain('data-layout-base="NomaiText.jl:PathGridLayout"');
    expect(svg).toContain('data-visible-grammar="nomai-text-jl-known-glyph-polygons"');
    expect(svg).toContain('data-paragraph-ring-mode="disabled"');
    expect(svg).toContain('data-layout-tuning="nomai-text-jl-pathgrid-strict-v1"');
    expect(svg).toContain('data-oracle-base="200000"');
    expect(svg).toContain('data-collision-policy="period-grow-and-safe-connector"');
    expect(svg).toContain('data-spiral-period="');
    expect(svg).toContain('data-collision-extra-period-steps="');
    expect(svg).toContain('data-spiral-turns="');
    expect(svg).toContain('class="nomai-text-jl-glyph"');
    expect(svg).toContain('class="nomai-text-jl-connector"');
    expect(svg).toContain('class="nomai-text-jl-vertex-circle"');
    expect(svg).toContain('data-upstream-stroke="dodgerblue4"');
    expect(svg).toContain('stroke="#104e8b"');
    expect(svg).toContain('fill="antiquewhite"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).not.toContain('data-visible-grammar="branch-leaf-param-v1"');
    expect(svg).not.toContain('centered-regular-spiral-v3');
    expect(svg).not.toContain('data-digit-visual-mode="hidden-in-branch-parameters"');
    expect(svg).not.toContain('class="nomai-leaf-cluster"');
    expect(svg).not.toContain('class="nomai-leaf-stroke"');
    expect(svg).not.toContain('class="nomai-paragraph-ring"');
    expect(svg).not.toContain('data-nomai-renderer="glyph-graph-v2"');
  });

  test("treats blank-line text as one upstream spiral rather than custom paragraph rings", () => {
    const text = [
      "First sentence. Same upstream draw call.",
      "Second paragraph remains inside the same draw_spiral output.",
      "Third paragraph does not create a custom chained ring."
    ].join("\n\n");
    const svg = renderNomaiSvg(text, { seed: 91, handwriting: 0.14, style: "nomai-text-jl" });

    expect(decodeNomaiSvg(svg).originalText).toBe(text);
    expect(svg).toContain('data-paragraph-ring-mode="disabled"');
    expect(svg).toContain('data-upstream-behavior="draw_spiral"');
    expect(count(svg, 'class="nomai-text-jl-glyph"')).toBeGreaterThan(10);
    expect(svg).not.toContain('data-outer-contact-kind="endpoint-to-previous-interior"');
    expect(svg).not.toContain('data-growth-direction=');
    expect(svg).not.toContain('class="nomai-paragraph-ring"');
  });

  test("uses upstream polygon glyphs and annotations instead of dense branch leaves", () => {
    const svg = renderNomaiSvg("The renderer should be boringly faithful to the open source output.", {
      seed: 313,
      handwriting: 0.18,
      style: "nomai-text-jl"
    });
    const glyphs = count(svg, 'class="nomai-text-jl-glyph"');
    const annotations = count(svg, 'class="nomai-text-jl-annotation"');
    const vertexCircles = count(svg, 'class="nomai-text-jl-vertex-circle"');

    expect(glyphs).toBeGreaterThan(8);
    expect(annotations).toBeGreaterThan(0);
    expect(vertexCircles).toBeGreaterThan(glyphs);
    expect(svg).toContain('data-source-glyph="');
    expect(svg).toContain('data-core-digit="digit');
    expect(svg).not.toContain('nomai-micro-branch');
    expect(svg).not.toContain('nomai-branch-knot');
  });

  test("keeps the strict NomaiText spiral collision-free without custom overlap nudging", () => {
    const text = [
      "First paragraph. Same upstream draw call.",
      "Second paragraph remains inside the same draw_spiral output.",
      "Third paragraph does not create a custom chained ring."
    ].join("\n\n");
    const svg = renderNomaiSvg(text, { seed: 91, handwriting: 0, style: "nomai-text-jl" });
    const connectorStats = connectorLengthStats(svg);
    const density = svgArea(svg) / count(svg, 'class="nomai-text-jl-glyph"');

    expect(countOverlappingGlyphBoxes(svg)).toBe(0);
    expect(countPathSegmentConflicts(svg)).toBe(0);
    expect(svg).toContain('data-layout-tuning="nomai-text-jl-pathgrid-strict-v1"');
    expect(svg).not.toContain("avoidGlyphCollisions");
    expect(collisionExtraPeriodSteps(svg)).toBeLessThan(12);
    expect(connectorStats.max).toBeLessThan(260);
    expect(connectorStats.average).toBeLessThan(150);
    expect(density).toBeLessThan(180000);
  });

  test("keeps handwritten output regular without segment conflicts", () => {
    const text = [
      "First paragraph. Same upstream draw call.",
      "Second paragraph remains inside the same draw_spiral output.",
      "Third paragraph does not create a custom chained ring."
    ].join("\n\n");
    const svg = renderNomaiSvg(text, { seed: 91, handwriting: 0.16, style: "nomai-text-jl" });

    expect(countPathSegmentConflicts(svg)).toBe(0);
  });

  test("uses original text for visible Nomai geometry and keeps English reading as metadata", () => {
    const first = renderNomaiSvg("你好，Nomai。今天适合看星星。", {
      pivotEnglish: "Hello, Nomai. Today is good for watching stars.",
      sourceLang: "zh-Hans",
      seed: 47,
      handwriting: 0,
      style: "nomai-text-jl"
    });
    const second = renderNomaiSvg("你好，Nomai。今天适合看星星。", {
      pivotEnglish: "Completely different English reading.",
      sourceLang: "zh-Hans",
      seed: 47,
      handwriting: 0,
      style: "nomai-text-jl"
    });
    const differentOriginal = renderNomaiSvg("不同的原文必须改变图形。", {
      pivotEnglish: "Hello, Nomai. Today is good for watching stars.",
      sourceLang: "zh-Hans",
      seed: 47,
      handwriting: 0,
      style: "nomai-text-jl"
    });

    expect(stripVariableMetadata(first)).toBe(stripVariableMetadata(second));
    expect(stripVariableMetadata(first)).not.toBe(stripVariableMetadata(differentOriginal));
    expect(decodeNomaiSvg(second).originalText).toBe("你好，Nomai。今天适合看星星。");
    expect(decodeNomaiSvg(second).pivotEnglish).toBe("Completely different English reading.");
  });

  test("adds more centered spiral turns as original text gets longer", () => {
    const shortSvg = renderNomaiSvg("Nomai", { seed: 47, handwriting: 0, style: "nomai-text-jl" });
    const longSvg = renderNomaiSvg("Nomai ".repeat(80), { seed: 47, handwriting: 0, style: "nomai-text-jl" });

    expect(spiralTurns(longSvg)).toBeGreaterThan(spiralTurns(shortSvg));
    expect(spiralPeriod(longSvg)).toBeGreaterThan(spiralPeriod(shortSvg));
    expect(decodeNomaiSvg(longSvg).originalText).toBe("Nomai ".repeat(80));
  });

  test("uses Unicode-safe visual oracle base and decodes Chinese sample exactly", () => {
    const text = "你好，Nomai。今天适合看星星。";
    const svg = renderNomaiSvg(text, {
      sourceLang: "zh-Hans",
      pivotEnglish: "Hello, Nomai. Today is good for watching stars.",
      seed: 47,
      handwriting: 0,
      style: "nomai-text-jl"
    });

    expect(svg).toContain('data-oracle-base="200000"');
    expect(svg).toContain('data-layout-tuning="nomai-text-jl-pathgrid-strict-v1"');
    expect(countPathSegmentConflicts(svg)).toBe(0);
    expect(decodeNomaiSvg(svg).originalText).toBe(text);
  });

  test("seed only affects upstream-style drawing when handwriting is enabled", () => {
    const text = "The same message should use the same upstream-style glyph layout.";
    const first = renderNomaiSvg(text, { seed: 1, handwriting: 0, style: "nomai-text-jl" });
    const second = renderNomaiSvg(text, { seed: 999, handwriting: 0, style: "nomai-text-jl" });
    const handwritten = renderNomaiSvg(text, { seed: 999, handwriting: 0.35, style: "nomai-text-jl" });

    expect(stripTokenMetadata(first)).toBe(stripTokenMetadata(second));
    expect(stripTokenMetadata(first)).not.toBe(stripTokenMetadata(handwritten));
    expect(decodeNomaiSvg(first).originalText).toBe(text);
    expect(decodeNomaiSvg(second).originalText).toBe(text);
    expect(decodeNomaiSvg(handwritten).originalText).toBe(text);
  });
});

function count(text: string, pattern: string): number {
  return text.split(pattern).length - 1;
}

function stripTokenMetadata(svg: string): string {
  return svg
    .replace(/data-nomai-token-stream="[^"]+"/g, 'data-nomai-token-stream="TOKEN"')
    .replace(/<metadata type="application\/nomai\+json">.*?<\/metadata>/s, "<metadata>METADATA</metadata>");
}

function stripVariableMetadata(svg: string): string {
  return svg
    .replace(/data-nomai-token-stream="[^"]+"/g, 'data-nomai-token-stream="TOKEN"')
    .replace(/<metadata type="application\/nomai\+json">.*?<\/metadata>/s, "<metadata>METADATA</metadata>");
}

function spiralTurns(svg: string): number {
  const match = svg.match(/data-spiral-turns="(\d+(?:\.\d+)?)"/);
  if (!match) throw new Error("No spiral turn metadata found");
  return Number(match[1]);
}

function spiralPeriod(svg: string): number {
  const match = svg.match(/data-spiral-period="(\d+(?:\.\d+)?)"/);
  if (!match) throw new Error("No spiral period metadata found");
  return Number(match[1]);
}

function collisionExtraPeriodSteps(svg: string): number {
  const match = svg.match(/data-collision-extra-period-steps="(\d+)"/);
  if (!match) throw new Error("No collision period metadata found");
  return Number(match[1]);
}

function countOverlappingGlyphBoxes(svg: string): number {
  const boxes = [...svg.matchAll(/<path class="nomai-text-jl-glyph"[^>]*d="([^"]+)"/g)]
    .map((match) => boundsForPath(match[1]));
  let overlaps = 0;
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left];
      const b = boxes[right];
      if (a.maxX > b.minX && b.maxX > a.minX && a.maxY > b.minY && b.maxY > a.minY) {
        overlaps += 1;
      }
    }
  }
  return overlaps;
}

function connectorLengthStats(svg: string): { max: number; average: number } {
  const lengths = [...svg.matchAll(/<path class="nomai-text-jl-connector"[^>]*d="M (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) L (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)"/g)]
    .map((match) => Math.hypot(Number(match[3]) - Number(match[1]), Number(match[4]) - Number(match[2])));
  return {
    max: Math.max(...lengths),
    average: lengths.reduce((sum, value) => sum + value, 0) / lengths.length
  };
}

interface Segment {
  pathIndex: number;
  start: Point2d;
  end: Point2d;
}

interface Point2d {
  x: number;
  y: number;
}

function countPathSegmentConflicts(svg: string): number {
  const paths = [...svg.matchAll(/<path class="[^"]+"[^>]*d="([^"]+)"/g)]
    .map((match, pathIndex) => ({
      pathIndex,
      points: pathPoints(match[1]),
      closed: match[1].endsWith(" Z")
    }));
  const segments = paths.flatMap((path) => pathSegments(path.pathIndex, path.points, path.closed));
  let intersections = 0;
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      if (segments[left].pathIndex === segments[right].pathIndex) continue;
      if (segmentsConflict(segments[left], segments[right])) {
        intersections += 1;
      }
    }
  }
  return intersections;
}

function pathSegments(pathIndex: number, points: Point2d[], closed: boolean): Segment[] {
  const segments: Segment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    segments.push({ pathIndex, start: points[index - 1], end: points[index] });
  }
  if (closed && points.length > 2) {
    segments.push({ pathIndex, start: points[points.length - 1], end: points[0] });
  }
  return segments;
}

function pathPoints(pathData: string): Point2d[] {
  const values = [...pathData.matchAll(/-?\d+(?:\.\d+)?/g)].map((value) => Number(value[0]));
  const points: Point2d[] = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  return points;
}

function segmentsConflict(left: Segment, right: Segment): boolean {
  if (collinearOverlap(left, right)) return true;
  if (sharesEndpoint(left, right)) return false;
  const leftStart = orientation(left.start, left.end, right.start);
  const leftEnd = orientation(left.start, left.end, right.end);
  const rightStart = orientation(right.start, right.end, left.start);
  const rightEnd = orientation(right.start, right.end, left.end);
  return leftStart * leftEnd < -0.000001 && rightStart * rightEnd < -0.000001;
}

function collinearOverlap(left: Segment, right: Segment): boolean {
  if (
    Math.abs(orientation(left.start, left.end, right.start)) > 0.000001 ||
    Math.abs(orientation(left.start, left.end, right.end)) > 0.000001
  ) {
    return false;
  }
  const dx = left.end.x - left.start.x;
  const dy = left.end.y - left.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.000001) return false;
  const project = (point: Point2d) => ((point.x - left.start.x) * dx + (point.y - left.start.y) * dy) / length;
  const leftRange = [0, length];
  const rightRange = [project(right.start), project(right.end)].sort((a, b) => a - b);
  const overlap = Math.min(leftRange[1], rightRange[1]) - Math.max(leftRange[0], rightRange[0]);
  return overlap > 0.8;
}

function sharesEndpoint(left: Segment, right: Segment): boolean {
  return [left.start, left.end].some((leftPoint) =>
    [right.start, right.end].some((rightPoint) =>
      Math.hypot(leftPoint.x - rightPoint.x, leftPoint.y - rightPoint.y) < 0.8
    )
  );
}

function orientation(a: Point2d, b: Point2d, c: Point2d): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function svgArea(svg: string): number {
  const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!match) throw new Error("No SVG viewBox found");
  return Number(match[1]) * Number(match[2]);
}

function boundsForPath(pathData: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const values = [...pathData.matchAll(/-?\d+(?:\.\d+)?/g)].map((value) => Number(value[0]));
  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}
