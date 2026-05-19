import type { EncodedPacket, NomaiLayoutPreset, NomaiTextBlock, NomaiWritingAge } from "../core/types";
import { XorShift32 } from "../core/prng";
import { escapeXml } from "../decode/svgDecoder";

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PolySpec {
  points: Point[];
  close: boolean;
}

interface GlyphSpec {
  name: string;
  coreDigit: string;
  core: PolySpec;
  annotations?: PolySpec[];
}

interface Coord {
  column: number;
  row: number;
}

interface GlyphCell extends Coord {
  id: number;
  glyph: GlyphSpec;
}

interface GlyphConnection {
  from: Coord;
  pointFrom: Point;
  to: Coord;
  pointTo: Point;
}

interface GlyphGrid {
  cells: GlyphCell[];
  connections: GlyphConnection[];
  columns: number;
}

interface PlacedGlyph extends GlyphCell {
  transform: Transform;
  core: PolySpec;
  annotations: PolySpec[];
}

interface PlacedConnection {
  start: Point;
  end: Point;
  fromId: string;
  toId: string;
}

interface Segment {
  start: Point;
  end: Point;
}

interface BoundedSegment extends Segment {
  bounds: Bounds;
}

interface SpiralPath {
  points: Point[];
  lengths: number[];
  totalLength: number;
  turns: number;
  period: number;
}

interface Transform {
  position: Point;
  angle: number;
  scale: number;
}

interface NomaiGlyphRenderOptions {
  textBlocks?: NomaiTextBlock[];
  layoutPreset?: NomaiLayoutPreset;
  writingAge?: NomaiWritingAge;
}

class NomaiOracle {
  private state: bigint;
  private readonly original: bigint;
  private completed = false;

  constructor(message: string, base = VISUAL_ORACLE_BASE) {
    const digits = Array.from(message || " ").map((char) => char.codePointAt(0) ?? 32);
    let value = 0n;
    let place = 1n;
    const radix = BigInt(base);
    for (const digit of digits) {
      value += BigInt(digit) * place;
      place *= radix;
    }
    this.state = value <= 0n ? 1n : value;
    this.original = this.state;
  }

  ask(count: number): number {
    if (count <= 0) return 0;
    const divisor = BigInt(count);
    const answer = Number(this.state % divisor);
    const next = this.state / divisor;
    if (next === 0n) {
      this.completed = true;
      this.state = this.original;
    } else {
      this.state = next;
    }
    return answer;
  }

  choose<T>(options: T[]): T {
    return options[this.ask(options.length)];
  }

  get isComplete(): boolean {
    return this.completed;
  }
}

const K = 20;
const ROWS = 3;
const MIDLINE = 1;
const DEFAULT_SPACING = 4 * K;
const VISUAL_ORACLE_BASE = 200_000;
const NOMA_TEXT_NEEDED_LENGTH_FACTOR = 3.5 * K;
const LUXOR_LOG_SPIRAL_A = 164;
const LUXOR_LOG_SPIRAL_B = 0.29;
const LUXOR_SPIRAL_STEP = 0.01;
const INITIAL_SPIRAL_PERIOD = Math.PI / 4;
const SPIRAL_PERIOD_INCREMENT = Math.PI / 24;
const PATH_GRID_MAX_SCALE = 2.0;
const MAX_COLLISION_EXTRA_PERIOD_STEPS = 72;
const STROKE = "#104e8b";
const BACKGROUND = "antiquewhite";
const TAU = Math.PI * 2;
const MAX_COLUMNS = 500;
const KNOWN_GLYPHS = createKnownGlyphs();

export function renderNomaiGlyphGraphSvg(packet: EncodedPacket, visualText: string, options: NomaiGlyphRenderOptions = {}): string {
  const message = visualTextForUpstreamDraw(visualText, options.textBlocks);
  const oracle = new NomaiOracle(message, VISUAL_ORACLE_BASE);
  const grid = gridFromOracle(oracle);
  const layout = layoutPathGrid(grid, packet.envelope.handwriting, packet.envelope.seed);
  const allPoints = [
    ...layout.glyphs.flatMap((glyph) => [
      ...glyph.core.points,
      ...glyph.annotations.flatMap((annotation) => annotation.points)
    ]),
    ...layout.connections.flatMap((connection) => [connection.start, connection.end])
  ];
  const bounds = boundsForPoints(allPoints);
  const padding = Math.max(12 * K + (ROWS - 1) * 4 * K * 2 * PATH_GRID_MAX_SCALE, 0.05 * (bounds.maxX - bounds.minX), 0.05 * (bounds.maxY - bounds.minY));
  const width = Math.ceil(bounds.maxX - bounds.minX + padding);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding);
  const offset = {
    x: padding / 2 - bounds.minX,
    y: padding / 2 - bounds.minY
  };
  const metadata = escapeXml(JSON.stringify({
    tokenStream: packet.tokenStream,
    envelope: packet.envelope,
    checksum: packet.checksum,
    renderer: "NomaiTextJlUpstreamPortV1",
    upstreamProject: "evanfields/NomaiText.jl",
    upstreamBehavior: "draw_spiral",
    layoutBase: "NomaiText.jl:PathGridLayout",
    visibleGrammar: "nomai-text-jl-known-glyph-polygons",
    paragraphRingMode: "disabled",
    layoutTuning: "nomai-text-jl-pathgrid-strict-v1",
    oracleBase: VISUAL_ORACLE_BASE,
    collisionPolicy: "period-grow-and-safe-connector",
    spiralTurns: layout.spiralTurns,
    spiralPeriod: layout.spiralPeriod,
    collisionExtraPeriodSteps: layout.collisionExtraPeriodSteps,
    collisionCount: layout.collisionCount,
    glyphCount: layout.glyphs.length,
    connectionCount: layout.connections.length,
    columns: grid.columns
  }));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" data-nomai-renderer="nomai-text-jl-upstream-port-v1" data-upstream-project="evanfields/NomaiText.jl" data-upstream-behavior="draw_spiral" data-layout-base="NomaiText.jl:PathGridLayout" data-visible-grammar="nomai-text-jl-known-glyph-polygons" data-paragraph-ring-mode="disabled" data-layout-tuning="nomai-text-jl-pathgrid-strict-v1" data-oracle-base="${VISUAL_ORACLE_BASE}" data-collision-policy="period-grow-and-safe-connector" data-spiral-period="${fmt(layout.spiralPeriod)}" data-collision-extra-period-steps="${layout.collisionExtraPeriodSteps}" data-spiral-turns="${fmt(layout.spiralTurns)}" data-upstream-stroke="dodgerblue4" data-nomai-token-stream="${escapeXml(packet.tokenStream)}">`,
    `<metadata type="application/nomai+json">${metadata}</metadata>`,
    `<rect width="100%" height="100%" fill="${BACKGROUND}"/>`,
    `<g stroke="${STROKE}" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">`,
    layout.glyphs.map((glyph) => renderPlacedGlyph(glyph, offset)).join("\n"),
    layout.connections.map((connection) => renderPlacedConnection(connection, offset)).join("\n"),
    `</g>`,
    `</svg>`
  ].join("\n");
}

function visualTextForUpstreamDraw(visualText: string, textBlocks: NomaiTextBlock[] | undefined): string {
  if (textBlocks?.length) {
    return textBlocks.map((block) => block.text).join("\n\n") || " ";
  }
  return visualText || " ";
}

function gridFromOracle(oracle: NomaiOracle): GlyphGrid {
  const cells = new Map<string, GlyphCell>();
  const connections: GlyphConnection[] = [];
  const paths: Coord[][] = [[], []];
  let nextId = 0;

  while (!oracle.isComplete && maxColumn(cells) < MAX_COLUMNS) {
    if (cells.size === 0) {
      const coord = { column: 0, row: MIDLINE };
      cells.set(coordKey(coord), { ...coord, id: nextId++, glyph: cloneGlyph(oracle.choose(KNOWN_GLYPHS)) });
      for (const path of paths) path.push(coord);
      continue;
    }

    const heads = paths.map((path) => path[path.length - 1]);
    const nextPoints = heads.map((head) => nextGridPoint(oracle, head)).sort((a, b) => a.row - b.row);
    for (let index = 0; index < paths.length; index += 1) {
      paths[index].push(nextPoints[index]);
    }
    for (const point of uniqueCoords(nextPoints)) {
      if (!cells.has(coordKey(point))) {
        cells.set(coordKey(point), { ...point, id: nextId++, glyph: cloneGlyph(oracle.choose(KNOWN_GLYPHS)) });
      }
    }
    for (const [from, to] of uniqueCoordPairs(heads, nextPoints)) {
      const fromGlyph = cells.get(coordKey(from));
      const toGlyph = cells.get(coordKey(to));
      if (!fromGlyph || !toGlyph) continue;
      const [pointFrom, pointTo] = shortestConnection(oracle, allGlyphPoints(fromGlyph.glyph), allGlyphPoints(toGlyph.glyph), {
        x: DEFAULT_SPACING * (to.column - from.column),
        y: DEFAULT_SPACING * (to.row - from.row)
      });
      connections.push({ from, pointFrom, to, pointTo });
    }
  }

  const values = [...cells.values()].sort((a, b) => a.column - b.column || a.row - b.row);
  return {
    cells: values,
    connections,
    columns: maxColumn(cells) + 1
  };
}

function nextGridPoint(oracle: NomaiOracle, head: Coord): Coord {
  const rows = head.row === 0 ? [0, 1] : head.row === ROWS - 1 ? [ROWS - 2, ROWS - 1] : [head.row - 1, head.row, head.row + 1];
  return {
    column: head.column + 1,
    row: oracle.choose(rows)
  };
}

function layoutPathGrid(grid: GlyphGrid, handwriting: number, seed: number): { glyphs: PlacedGlyph[]; connections: PlacedConnection[]; spiralTurns: number; spiralPeriod: number; collisionExtraPeriodSteps: number; collisionCount: number } {
  let lastLayout: { glyphs: PlacedGlyph[]; connections: PlacedConnection[]; spiralTurns: number; spiralPeriod: number; collisionExtraPeriodSteps: number; collisionCount: number } | null = null;
  for (let extraPeriodSteps = 0; extraPeriodSteps <= MAX_COLLISION_EXTRA_PERIOD_STEPS; extraPeriodSteps += 1) {
    const path = buildUpstreamSpiralPath(grid.columns, extraPeriodSteps);
    const placed = placeGridOnPath(grid, path, handwriting, seed);
    const collisionCount = countLayoutConflicts(placed.glyphs, placed.connections, 1);
    lastLayout = {
      ...placed,
      spiralTurns: path.turns,
      spiralPeriod: path.period,
      collisionExtraPeriodSteps: extraPeriodSteps,
      collisionCount
    };
    if (collisionCount === 0) return lastLayout;
  }
  if (lastLayout) return lastLayout;
  throw new Error("Unable to build Nomai layout");
}

function placeGridOnPath(grid: GlyphGrid, path: SpiralPath, handwriting: number, seed: number): { glyphs: PlacedGlyph[]; connections: PlacedConnection[] } {
  const pathBounds = boundsForPoints(path.points);
  const pathMidpoint = {
    x: (pathBounds.minX + pathBounds.maxX) / 2,
    y: (pathBounds.minY + pathBounds.maxY) / 2
  };
  const transforms = new Map<string, Transform>();
  const lastColumnIndex = Math.max(0, grid.columns - 1);
  const scaleDelta = lastColumnIndex > 0 ? (PATH_GRID_MAX_SCALE - 1) / lastColumnIndex : 0;
  const totalSegmentLength = lastColumnIndex + 0.5 * lastColumnIndex * lastColumnIndex * scaleDelta;
  const handwritingRng = new XorShift32(seed);
  for (const cell of grid.cells) {
    const cumulativeSegmentLength = cell.column + 0.5 * cell.column * cell.column * scaleDelta;
    const k = totalSegmentLength > 0 ? cumulativeSegmentLength / totalSegmentLength : 0;
    const scaleHere = 1 + cell.column * scaleDelta;
    const scale = 1 + (PATH_GRID_MAX_SCALE - 1) * k;
    const sample = samplePath(path, k);
    const radialOffset = rotate({ x: 0, y: (cell.row - (ROWS - 1)) * 3 * K * scaleHere }, sample.angle);
    let transform: Transform = {
      position: subtract(add(sample.point, radialOffset), pathMidpoint),
      angle: sample.angle,
      scale
    };
    transform = applyRegularHandwriting(transform, handwriting, handwritingRng);
    transforms.set(coordKey(cell), transform);
  }

  const glyphs = grid.cells.map((cell) => {
    const transform = transforms.get(coordKey(cell))!;
    return {
      ...cell,
      transform,
      core: transformPoly(cell.glyph.core, transform),
      annotations: glyphAnnotations(cell.glyph).map((annotation) => transformPoly(annotation, transform))
    };
  });
  const glyphByCoord = new Map(glyphs.map((glyph) => [coordKey(glyph), glyph]));
  const glyphBlockers = glyphs.flatMap(glyphSegments).map(toBoundedSegment);
  const connectionBlockers: BoundedSegment[] = [];
  const connections: PlacedConnection[] = [];
  for (const connection of grid.connections) {
    const from = glyphByCoord.get(coordKey(connection.from));
    const to = glyphByCoord.get(coordKey(connection.to));
    if (!from || !to) continue;
    const [start, end] = cleanPlacedConnection(from, to, glyphBlockers, connectionBlockers);
    const placedConnection = {
      start,
      end,
      fromId: String(from.id),
      toId: String(to.id)
    };
    connections.push(placedConnection);
    connectionBlockers.push(toBoundedSegment({ start, end }));
  }
  return { glyphs, connections };
}

function buildUpstreamSpiralPath(columns: number, extraPeriodSteps: number): SpiralPath {
  const neededLength = NOMA_TEXT_NEEDED_LENGTH_FACTOR * Math.max(1, columns);
  let period = INITIAL_SPIRAL_PERIOD;
  let path = pathWithLengths(sampleLuxorLogSpiral(period));
  while (path.totalLength < neededLength) {
    period += SPIRAL_PERIOD_INCREMENT;
    path = pathWithLengths(sampleLuxorLogSpiral(period));
  }
  period += extraPeriodSteps * SPIRAL_PERIOD_INCREMENT;
  path = pathWithLengths(sampleLuxorLogSpiral(period));
  const rotationNeeded = Math.PI - mod(period, TAU);
  const rotatedPoints = path.points.map((point) => rotate(point, rotationNeeded));
  return { ...pathWithLengths(rotatedPoints), turns: period / TAU, period };
}

function sampleLuxorLogSpiral(period: number): Point[] {
  const points: Point[] = [];
  for (let t = 0; t <= period + 0.0000001; t += LUXOR_SPIRAL_STEP) {
    const radius = LUXOR_LOG_SPIRAL_A * Math.exp(t * LUXOR_LOG_SPIRAL_B);
    points.push({ x: radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  return points;
}

function pathWithLengths(points: Point[]): { points: Point[]; lengths: number[]; totalLength: number } {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]));
  }
  return { points, lengths, totalLength: lengths[lengths.length - 1] };
}

function samplePath(path: { points: Point[]; lengths: number[]; totalLength: number }, k: number): { point: Point; angle: number } {
  const clampedK = clamp(k, 0, 1);
  const center = Math.abs(clampedK - 0.5) < 0.01 ? 0.51 : 0.5;
  const delta = 0.001 * Math.sign(center - clampedK || 1);
  const firstK = clamp(Math.min(clampedK, clampedK + delta), 0, 1);
  const secondK = clamp(Math.max(clampedK, clampedK + delta), 0, 1);
  const pointA = pointAtPathFraction(path, firstK);
  const pointB = pointAtPathFraction(path, secondK);
  const point = firstK === clampedK ? pointA : pointB;
  return { point, angle: Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) };
}

function pointAtPathFraction(path: { points: Point[]; lengths: number[]; totalLength: number }, k: number): Point {
  const target = clamp(k, 0, 1) * path.totalLength;
  let low = 1;
  let high = path.lengths.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (path.lengths[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const index = Math.max(1, low);
  const beforeLength = path.lengths[index - 1];
  const afterLength = path.lengths[index];
  const segmentT = (target - beforeLength) / Math.max(0.0001, afterLength - beforeLength);
  const before = path.points[index - 1];
  const after = path.points[index];
  return {
    x: before.x + (after.x - before.x) * segmentT,
    y: before.y + (after.y - before.y) * segmentT
  };
}

function renderPlacedGlyph(glyph: PlacedGlyph, offset: Point): string {
  const parts = [
    renderPoly(glyph.core, offset, "nomai-text-jl-glyph", glyph, "core"),
    ...vertexCircles(glyph.core).map((point) => renderVertexCircle(point, offset, glyph)),
  ];
  for (const annotation of glyph.annotations) {
    parts.push(renderPoly(annotation, offset, "nomai-text-jl-annotation", glyph, "annotation"));
    parts.push(...vertexCircles(annotation).map((point) => renderVertexCircle(point, offset, glyph)));
  }
  return parts.join("\n");
}

function renderPoly(poly: PolySpec, offset: Point, className: string, glyph: PlacedGlyph, part: string): string {
  const points = poly.points.map((point) => add(point, offset));
  const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${fmt(point.x)} ${fmt(point.y)}`).join(" ") + (poly.close ? " Z" : "");
  return `<path class="${className}" data-source-glyph="${glyph.glyph.name}" data-core-digit="${glyph.glyph.coreDigit}" data-glyph-part="${part}" d="${d}"/>`;
}

function renderVertexCircle(point: Point, offset: Point, glyph: PlacedGlyph): string {
  const p = add(point, offset);
  return `<circle class="nomai-text-jl-vertex-circle" data-source-glyph="${glyph.glyph.name}" data-core-digit="${glyph.glyph.coreDigit}" cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="5" fill="${STROKE}" stroke="none"/>`;
}

function renderPlacedConnection(connection: PlacedConnection, offset: Point): string {
  const start = add(connection.start, offset);
  const end = add(connection.end, offset);
  return `<path class="nomai-text-jl-connector" data-from-node="${connection.fromId}" data-to-node="${connection.toId}" d="M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(end.x)} ${fmt(end.y)}"/>${renderConnectionCircle(start)}${renderConnectionCircle(end)}`;
}

function renderConnectionCircle(point: Point): string {
  return `<circle class="nomai-text-jl-vertex-circle" cx="${fmt(point.x)}" cy="${fmt(point.y)}" r="5" fill="${STROKE}" stroke="none"/>`;
}

function createKnownGlyphs(): GlyphSpec[] {
  const core = createCoreGlyphs();
  const known = [...core];
  const byDigit = (digit: number) => core[digit];

  for (const [digit, a, b, scale] of [
    [3, 2, 3, 0.7],
    [7, 2, 3, 0.9],
    [9, 0, 1, 0.9],
    [10, 3, 4, 0.9],
    [11, 0, 1, 0.9],
    [15, 5, 0, 0.9]
  ] as const) {
    const g = byDigit(digit);
    known.push(scaleGlyph(withAnnotation(g, computeSquare(g.core.points[a], g.core.points[b]), "square"), scale));
  }

  for (const [digit, indexes, label] of [
    [0, [1, 2, 3], "spike-upper-right"],
    [1, [0, 1, 2], "spike-lower-left"],
    [2, [1, 2, 3], "spike-lower-left"],
    [4, [2, 3, 4], "spike-top"],
    [4, [4, 0, 1], "spike-bottom"],
    [4, [3, 4, 0], "spike-right"]
  ] as const) {
    const g = byDigit(digit);
    const pts = indexes.map((index) => g.core.points[index]);
    known.push(withAnnotation(g, computeSpike(pts[0], pts[1], pts[2]), label));
  }

  for (const [digit, indexes, label] of [
    [0, [0, 1, 2, 3], "horns-upper"],
    [1, [0, 1, 2, 3], "horns-left"],
    [2, [0, 1, 2, 3], "horns-lower"],
    [3, [2, 3, 0, 1], "horns-right"]
  ] as const) {
    const g = byDigit(digit);
    const pts = indexes.map((index) => g.core.points[index]);
    known.push(withAnnotation(g, computeHorns(pts[0], pts[1], pts[2], pts[3]), label));
  }

  const g15 = byDigit(15);
  const pentagon = ngon(5, Math.sqrt(0.5 + Math.sqrt(5) / 10) * K, Math.PI / 2);
  const minX = Math.min(...pentagon.map((point) => point.x));
  const shiftedPentagon = pentagon.map((point) => ({ x: point.x + K * 1.35 - minX, y: point.y }));
  known.push(scaleGlyph(withAnnotation(g15, { points: shiftedPentagon, close: true }, "right-pentagon"), 0.65));
  return known;
}

function createCoreGlyphs(): GlyphSpec[] {
  const squareRadius = Math.sqrt(2) * K / 2;
  const square = [0, 1, 2, 3].map((index) => polar(squareRadius, Math.PI / 4 + Math.PI / 2 * index));
  const pentagonRadius = Math.sqrt(0.5 + Math.sqrt(5) / 10) * K;
  const pentagon = ngon(5, pentagonRadius, Math.PI / 2);
  const hex = ngon(6, K, Math.PI / 6);
  return [
    glyph("digit0", [square[1], square[2], square[3], square[0]], false),
    glyph("digit1", square, false),
    glyph("digit2", [square[3], square[0], square[1], square[2]], false),
    glyph("digit3", square, true),
    glyph("digit4", pentagon, true),
    glyph("digit5", hex.slice(1, 4), false),
    glyph("digit6", hex.slice(0, 3), false),
    glyph("digit7", hex.slice(1, 5), false),
    glyph("digit8", hex.slice(0, 4), false),
    glyph("digit9", [hex[5], hex[0], hex[1], hex[2]], false),
    glyph("digit10", hex.slice(0, 5), false),
    glyph("digit11", [hex[5], hex[0], hex[1], hex[2], hex[3]], false),
    glyph("digit12", hex, false),
    glyph("digit13", [hex[5], hex[0], hex[1], hex[2], hex[3], hex[4]], false),
    glyph("digit14", [hex[4], hex[5], hex[0], hex[1], hex[2], hex[3]], false),
    glyph("digit15", hex, true)
  ];
}

function glyph(name: string, points: Point[], close: boolean): GlyphSpec {
  return { name, coreDigit: name, core: { points, close } };
}

function withAnnotation(glyphSpec: GlyphSpec, annotation: PolySpec | PolySpec[], label: string): GlyphSpec {
  return {
    name: `${glyphSpec.coreDigit}-${label}`,
    coreDigit: glyphSpec.coreDigit,
    core: clonePoly(glyphSpec.core),
    annotations: (Array.isArray(annotation) ? annotation : [annotation]).map(clonePoly)
  };
}

function computeSquare(ptA: Point, ptB: Point): PolySpec {
  const ptC = rotateAround(ptA, ptB, Math.PI / 2);
  const ptD = rotateAround(ptB, ptA, -Math.PI / 2);
  return {
    points: [ptA, ptD, ptC, ptB],
    close: false
  };
}

function computeSpike(ptA: Point, ptB: Point, ptC: Point, length = 3 * K / 4): PolySpec {
  return { points: [ptB, computeSpikePoint(ptA, ptB, ptC, length)], close: false };
}

function computeSpikePoint(ptA: Point, ptB: Point, ptC: Point, length: number): Point {
  const fullAngle = signedAngle(subtract(ptC, ptB), subtract(ptA, ptB));
  const dist = Math.max(0.0001, distance(ptA, ptB));
  const linePoint = add(ptB, scalePoint(subtract(ptA, ptB), length / dist));
  return rotateAround(linePoint, ptB, fullAngle / 2);
}

function computeHorns(ptA: Point, ptB: Point, ptC: Point, ptD: Point, length = 0.75 * K): PolySpec[] {
  return [
    {
      points: [computeSpikePoint(ptA, ptB, ptC, length), ptB],
      close: false
    },
    {
      points: [ptC, computeSpikePoint(ptB, ptC, ptD, length)],
      close: false
    }
  ];
}

function shortestConnection(oracle: NomaiOracle, ptsA: Point[], ptsB: Point[], offset: Point, threshold = 0.01): [Point, Point] {
  let bestDistance = Number.POSITIVE_INFINITY;
  let pairs: Array<[Point, Point]> = [];
  for (const ptA of ptsA) {
    for (const ptB of ptsB) {
      const current = distance(ptA, add(ptB, offset));
      if (current <= bestDistance - threshold) {
        pairs = [[ptA, ptB]];
      } else if (current < bestDistance + threshold) {
        pairs.push([ptA, ptB]);
      }
      bestDistance = Math.min(bestDistance, current);
    }
  }
  return oracle.choose(pairs);
}

function allGlyphPoints(glyphSpec: GlyphSpec): Point[] {
  return [...glyphSpec.core.points, ...glyphAnnotations(glyphSpec).flatMap((annotation) => annotation.points)];
}

function allPlacedGlyphPoints(glyph: PlacedGlyph): Point[] {
  return [...glyph.core.points, ...glyph.annotations.flatMap((annotation) => annotation.points)];
}

function glyphAnnotations(glyphSpec: GlyphSpec): PolySpec[] {
  return glyphSpec.annotations ?? [];
}

function shortestPlacedConnection(from: PlacedGlyph, to: PlacedGlyph): [Point, Point] {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPair: [Point, Point] = [from.core.points[0], to.core.points[0]];
  for (const ptA of allPlacedGlyphPoints(from)) {
    for (const ptB of allPlacedGlyphPoints(to)) {
      const current = distance(ptA, ptB);
      if (current < bestDistance) {
        bestDistance = current;
        bestPair = [ptA, ptB];
      }
    }
  }
  return bestPair;
}

function cleanPlacedConnection(from: PlacedGlyph, to: PlacedGlyph, glyphBlockers: BoundedSegment[], connectionBlockers: BoundedSegment[]): [Point, Point] {
  const candidates: Array<[Point, Point]> = [];
  for (const ptA of allPlacedGlyphPoints(from)) {
    for (const ptB of allPlacedGlyphPoints(to)) {
      candidates.push([ptA, ptB]);
    }
  }
  candidates.sort((left, right) => distance(left[0], left[1]) - distance(right[0], right[1]));
  for (const [start, end] of candidates) {
    const candidate = toBoundedSegment({ start, end });
    if (!boundedSegmentConflicts(candidate, glyphBlockers) && !boundedSegmentConflicts(candidate, connectionBlockers)) {
      return [start, end];
    }
  }
  return shortestPlacedConnection(from, to);
}

function boundedSegmentConflicts(candidate: BoundedSegment, blockers: BoundedSegment[]): boolean {
  return blockers.some((blocker) => boundsTouchOrOverlap(candidate.bounds, blocker.bounds) && segmentsConflict(candidate, blocker));
}

function countLayoutConflicts(glyphs: PlacedGlyph[], connections: PlacedConnection[], stopAfter = Number.POSITIVE_INFINITY): number {
  const segments = [
    ...glyphs.flatMap(glyphSegments),
    ...connections.map((connection) => ({ start: connection.start, end: connection.end }))
  ].map(toBoundedSegment);
  let conflicts = 0;
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      if (!boundsTouchOrOverlap(segments[left].bounds, segments[right].bounds)) continue;
      if (segmentsConflict(segments[left], segments[right])) {
        conflicts += 1;
        if (conflicts >= stopAfter) return conflicts;
      }
    }
  }
  return conflicts + countOverlappingCoreGlyphBounds(glyphs, stopAfter - conflicts);
}

function countOverlappingCoreGlyphBounds(glyphs: PlacedGlyph[], stopAfter = Number.POSITIVE_INFINITY): number {
  const boxes = glyphs.map((glyph) => boundsForPoints(glyph.core.points));
  let overlaps = 0;
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      if (boundsOverlap(boxes[left], boxes[right])) {
        overlaps += 1;
        if (overlaps >= stopAfter) return overlaps;
      }
    }
  }
  return overlaps;
}

function glyphSegments(glyph: PlacedGlyph): Segment[] {
  return [
    ...polySegments(glyph.core),
    ...glyph.annotations.flatMap(polySegments)
  ];
}

function toBoundedSegment(segment: Segment): BoundedSegment {
  return { ...segment, bounds: boundsForPoints([segment.start, segment.end]) };
}

function polySegments(poly: PolySpec): Segment[] {
  const segments: Segment[] = [];
  for (let index = 1; index < poly.points.length; index += 1) {
    segments.push({ start: poly.points[index - 1], end: poly.points[index] });
  }
  if (poly.close && poly.points.length > 2) {
    segments.push({ start: poly.points[poly.points.length - 1], end: poly.points[0] });
  }
  return segments;
}

function segmentsConflict(left: Segment, right: Segment): boolean {
  if (collinearOverlap(left, right)) return true;
  if (sharesEndpoint(left, right)) return false;
  const leftStart = signedArea(left.start, left.end, right.start);
  const leftEnd = signedArea(left.start, left.end, right.end);
  const rightStart = signedArea(right.start, right.end, left.start);
  const rightEnd = signedArea(right.start, right.end, left.end);
  return leftStart * leftEnd < -0.000001 && rightStart * rightEnd < -0.000001;
}

function collinearOverlap(left: Segment, right: Segment): boolean {
  if (
    Math.abs(signedArea(left.start, left.end, right.start)) > 0.000001 ||
    Math.abs(signedArea(left.start, left.end, right.end)) > 0.000001
  ) {
    return false;
  }
  const dx = left.end.x - left.start.x;
  const dy = left.end.y - left.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.000001) return false;
  const project = (point: Point) => ((point.x - left.start.x) * dx + (point.y - left.start.y) * dy) / len;
  const rightRange = [project(right.start), project(right.end)].sort((a, b) => a - b);
  const overlap = Math.min(len, rightRange[1]) - Math.max(0, rightRange[0]);
  return overlap > 0.8;
}

function sharesEndpoint(left: Segment, right: Segment): boolean {
  return [left.start, left.end].some((leftPoint) =>
    [right.start, right.end].some((rightPoint) => distance(leftPoint, rightPoint) < 0.8)
  );
}

function signedArea(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function applyRegularHandwriting(transform: Transform, handwriting: number, rng: XorShift32): Transform {
  if (handwriting <= 0) return transform;
  const tangent = rotate({ x: 1, y: 0 }, transform.angle);
  const normal = rotate(tangent, Math.PI / 2);
  const displacement = add(
    scalePoint(tangent, K * 0.35 * handwriting * rngGaussian(rng)),
    scalePoint(normal, K * 0.25 * handwriting * rngGaussian(rng))
  );
  return {
    position: add(transform.position, displacement),
    angle: transform.angle + 0.08 * handwriting * rngGaussian(rng),
    scale: transform.scale * Math.max(0.94, 1 + 0.04 * handwriting * rngGaussian(rng))
  };
}

function vertexCircles(poly: PolySpec): Point[] {
  return poly.close ? poly.points : poly.points.slice(1, -1);
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.maxX > b.minX && b.maxX > a.minX && a.maxY > b.minY && b.maxY > a.minY;
}

function boundsTouchOrOverlap(a: Bounds, b: Bounds): boolean {
  const epsilon = 0.000001;
  return a.maxX + epsilon >= b.minX && b.maxX + epsilon >= a.minX && a.maxY + epsilon >= b.minY && b.maxY + epsilon >= a.minY;
}

function transformPoly(poly: PolySpec, transform: Transform): PolySpec {
  return {
    points: poly.points.map((point) => transformPoint(point, transform)),
    close: poly.close
  };
}

function transformPoint(point: Point, transform: Transform): Point {
  return add(transform.position, rotate(scalePoint(point, transform.scale), transform.angle));
}

function mapGlyphPoints(glyphSpec: GlyphSpec, mapper: (point: Point) => Point): GlyphSpec {
  return {
    ...glyphSpec,
    core: { points: glyphSpec.core.points.map(mapper), close: glyphSpec.core.close },
    annotations: glyphSpec.annotations?.map((annotation) => ({
      points: annotation.points.map(mapper),
      close: annotation.close
    }))
  };
}

function scaleGlyph(glyphSpec: GlyphSpec, amount: number): GlyphSpec {
  return mapGlyphPoints(glyphSpec, (point) => scalePoint(point, amount));
}

function cloneGlyph(glyphSpec: GlyphSpec): GlyphSpec {
  return {
    ...glyphSpec,
    core: clonePoly(glyphSpec.core),
    annotations: glyphSpec.annotations?.map(clonePoly)
  };
}

function clonePoly(poly: PolySpec): PolySpec {
  return { points: poly.points.map((point) => ({ ...point })), close: poly.close };
}

function uniqueCoords(coords: Coord[]): Coord[] {
  const seen = new Set<string>();
  const result: Coord[] = [];
  for (const coord of coords) {
    const key = coordKey(coord);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(coord);
  }
  return result;
}

function uniqueCoordPairs(from: Coord[], to: Coord[]): Array<[Coord, Coord]> {
  const seen = new Set<string>();
  const result: Array<[Coord, Coord]> = [];
  for (let index = 0; index < from.length; index += 1) {
    const key = `${coordKey(from[index])}>${coordKey(to[index])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([from[index], to[index]]);
  }
  return result;
}

function maxColumn(cells: Map<string, GlyphCell>): number {
  return cells.size ? Math.max(...[...cells.values()].map((cell) => cell.column)) : -1;
}

function coordKey(coord: Coord): string {
  return `${coord.column},${coord.row}`;
}

function boundsForPoints(points: Point[]): Bounds {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function rngGaussian(rng: XorShift32): number {
  const u = Math.max(0.000001, rng.next());
  const v = Math.max(0.000001, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function ngon(count: number, radius: number, startAngle: number): Point[] {
  return Array.from({ length: count }, (_, index) => polar(radius, startAngle + index * TAU / count));
}

function polar(radius: number, angle: number): Point {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function rotate(point: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  };
}

function rotateAround(point: Point, center: Point, angle: number): Point {
  return add(center, rotate(subtract(point, center), angle));
}

function signedAngle(a: Point, b: Point): number {
  return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scalePoint(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(point: Point): Point | null {
  const len = Math.hypot(point.x, point.y);
  if (len < 0.0001) return null;
  return { x: point.x / len, y: point.y / len };
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
