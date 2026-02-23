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
  ...generateDiagonalRowPositions(0, 13, 8.5, 52, 36.5, 32, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(14, 27, 11, 55, 38.5, 36, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(28, 41, 14, 59, 41.5, 39, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(42, 55, 17.5, 63, 44, 42, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(56, 63, 20, 66.5, 39, 53.5, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(64, 71, 23, 72, 42, 58, DIAGONAL_ANGLE),

  ...generateRowPositions(72, 87, 24.2, 48, 89),
  ...generateRowPositions(88, 107, 28.5, 46, 89),
  ...generateRowPositions(108, 127, 33.2, 46, 89),
  ...generateRowPositions(128, 147, 38.0, 46, 89),
  ...generateRowPositions(148, 167, 44.5, 46, 89),
  ...generateRowPositions(168, 187, 49.5, 46, 89),

  ["C188", { x: 90.5, y: 52, rotation: 90 }],

  ...generateRowPositions(189, 207, 56, 51, 87),

  ["C208", { x: 89, y: 58, rotation: 90 }],
  ["C209", { x: 90.5, y: 58, rotation: 90 }],
  ["C210", { x: 92, y: 58, rotation: 90 }],

  ...generateRowPositions(211, 224, 63, 56, 83),

  ["C225", { x: 85, y: 64, rotation: 90 }],
  ["C226", { x: 86.5, y: 64, rotation: 90 }],

  ...generateRowPositions(227, 242, 69.5, 56, 84),
  ...generateRowPositions(243, 252, 73, 59, 82, 0, [246]),
  ...generateRowPositions(253, 262, 77.5, 59, 82),
  ...generateRowPositions(263, 270, 83, 61, 80),
];

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = Object.fromEntries(allPositions);

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}

export function getWolfHollowContainerNames(): string[] {
  return Object.keys(WOLF_HOLLOW_POSITIONS);
}
