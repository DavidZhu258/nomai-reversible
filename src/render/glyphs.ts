export interface Point {
  x: number;
  y: number;
}

export interface GlyphSpec {
  strokes: Point[][];
  dots: Point[];
}

const coreShapes: Point[][][] = [
  [[{ x: -10, y: 0 }, { x: 10, y: 0 }]],
  [[{ x: -8, y: 8 }, { x: 0, y: -8 }, { x: 8, y: 8 }]],
  [[{ x: -8, y: -8 }, { x: 8, y: -8 }, { x: 8, y: 8 }, { x: -8, y: 8 }, { x: -8, y: -8 }]],
  [[{ x: 0, y: -10 }, { x: 10, y: -3 }, { x: 6, y: 9 }, { x: -6, y: 9 }, { x: -10, y: -3 }, { x: 0, y: -10 }]],
  [[{ x: 0, y: -11 }, { x: 9, y: -5 }, { x: 9, y: 5 }, { x: 0, y: 11 }, { x: -9, y: 5 }, { x: -9, y: -5 }, { x: 0, y: -11 }]],
  [[{ x: -10, y: -5 }, { x: -4, y: -10 }, { x: 4, y: -10 }, { x: 10, y: -5 }, { x: 10, y: 5 }, { x: 4, y: 10 }, { x: -4, y: 10 }, { x: -10, y: 5 }, { x: -10, y: -5 }]],
  [[{ x: -10, y: 8 }, { x: -2, y: -8 }, { x: 10, y: -8 }]],
  [[{ x: -10, y: -8 }, { x: 0, y: 8 }, { x: 10, y: -8 }]],
  [[{ x: -10, y: 0 }, { x: -3, y: -8 }, { x: 6, y: -3 }, { x: 10, y: 8 }]],
  [[{ x: -9, y: -9 }, { x: 9, y: 9 }], [{ x: 9, y: -9 }, { x: -9, y: 9 }]],
  [[{ x: -10, y: 7 }, { x: -2, y: 0 }, { x: -10, y: -7 }], [{ x: 0, y: 0 }, { x: 11, y: 0 }]],
  [[{ x: -11, y: -5 }, { x: -2, y: -10 }, { x: 8, y: -4 }, { x: 2, y: 2 }, { x: 10, y: 9 }]],
  [[{ x: -10, y: 0 }, { x: -3, y: -7 }, { x: 5, y: -5 }, { x: 10, y: 0 }, { x: 5, y: 5 }, { x: -3, y: 7 }, { x: -10, y: 0 }]],
  [[{ x: -8, y: -8 }, { x: -8, y: 8 }, { x: 8, y: 8 }]],
  [[{ x: -10, y: -6 }, { x: 0, y: -10 }, { x: 10, y: -6 }, { x: 3, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 10 }, { x: -10, y: 6 }]],
  [[{ x: -10, y: 0 }, { x: -4, y: -8 }, { x: 4, y: -8 }, { x: 10, y: 0 }, { x: 4, y: 8 }, { x: -4, y: 8 }, { x: -10, y: 0 }]]
];

export const KNOWN_GLYPHS: GlyphSpec[] = Array.from({ length: 33 }, (_, index) => {
  const base = coreShapes[index % coreShapes.length];
  const annotation = Math.floor(index / coreShapes.length);
  const dots: Point[] = [];
  const strokes = base.map((stroke) => stroke.map((point) => ({ ...point })));

  if (annotation === 1) {
    dots.push({ x: 0, y: -15 });
  } else if (annotation === 2) {
    dots.push({ x: -13, y: 13 }, { x: 13, y: -13 });
  }

  return { strokes, dots };
});

