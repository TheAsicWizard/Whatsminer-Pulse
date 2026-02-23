import wolfHollowMapUrl from "@assets/2024-09-26_Wolf_Hollow_Site_Map_Layout_-_Cropped_-_Section_2_1771858299566.png";

export { wolfHollowMapUrl };

export type TemplatePosition = { x: number; y: number; rotation: number };

function generateRowPositions(
  startId: number,
  endId: number,
  y: number,
  xStart: number,
  xEnd: number,
  rotation: number = 0,
  excludeIds: number[] = []
): [string, TemplatePosition][] {
  const ids: number[] = [];
  for (let i = startId; i <= endId; i++) {
    if (!excludeIds.includes(i)) ids.push(i);
  }
  const count = ids.length;
  if (count === 0) return [];
  const spacing = count > 1 ? (xEnd - xStart) / (count - 1) : 0;
  return ids.map((id, idx) => {
    const name = `C${String(id).padStart(3, "0")}`;
    return [name, { x: xStart + spacing * idx, y, rotation }];
  });
}

function generateDiagonalRowPositions(
  startId: number,
  endId: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rotation: number
): [string, TemplatePosition][] {
  const ids: number[] = [];
  for (let i = startId; i <= endId; i++) ids.push(i);
  const count = ids.length;
  if (count === 0) return [];
  const xSpacing = count > 1 ? (x2 - x1) / (count - 1) : 0;
  const ySpacing = count > 1 ? (y2 - y1) / (count - 1) : 0;
  return ids.map((id, idx) => {
    const name = `C${String(id).padStart(3, "0")}`;
    return [name, { x: x1 + xSpacing * idx, y: y1 + ySpacing * idx, rotation }];
  });
}

const DIAGONAL_ANGLE = 325;

const allPositions: [string, TemplatePosition][] = [
  // Diagonal section: 70 containers (C000-C069), 6 rows
  // 4 rows of 14, then 2 rows of 7
  ...generateDiagonalRowPositions(0, 13, 5, 54, 35, 32, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(14, 27, 7.5, 58, 37.5, 36, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(28, 41, 10, 62, 40, 40, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(42, 55, 13, 67, 43, 44.5, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(56, 62, 15.5, 70, 32, 58, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(63, 69, 18.5, 75, 35, 62, DIAGONAL_ANGLE),

  // Horizontal section: 214 containers (C070-C284, excluding C246)
  // Top 10 rows: 14 containers each, paired in enclosures
  // Pair 1
  ...generateRowPositions(70, 83, 7, 47, 92),
  ...generateRowPositions(84, 97, 11, 47, 92),
  // Pair 2
  ...generateRowPositions(98, 111, 16, 47, 92),
  ...generateRowPositions(112, 125, 20, 47, 92),
  // Pair 3
  ...generateRowPositions(126, 139, 25, 47, 92),
  ...generateRowPositions(140, 153, 29, 47, 92),
  // Pair 4
  ...generateRowPositions(154, 167, 34, 47, 92),
  ...generateRowPositions(168, 181, 38, 47, 92),
  // Pair 5
  ...generateRowPositions(182, 195, 43, 47, 92),
  ...generateRowPositions(196, 209, 47, 47, 92),

  // Middle rows: 12 containers each
  ...generateRowPositions(210, 221, 53, 50, 90),
  ...generateRowPositions(222, 233, 58, 50, 90),

  // Narrower rows: 11 containers each
  ...generateRowPositions(234, 244, 64, 52, 88),
  ...generateRowPositions(245, 256, 70, 52, 88, 0, [246]),

  // Bottom rows: 10 containers each
  ...generateRowPositions(257, 266, 76, 54, 86),
  ...generateRowPositions(267, 276, 82, 54, 86),

  // Standalone bottom rows
  ...generateRowPositions(277, 280, 89, 50, 68),
  ...generateRowPositions(281, 284, 95, 60, 78),
];

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = Object.fromEntries(allPositions);

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}

export function getWolfHollowContainerNames(): string[] {
  return Object.keys(WOLF_HOLLOW_POSITIONS);
}
