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
  ...generateDiagonalRowPositions(0, 13, 5, 54, 35, 32, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(14, 27, 7.5, 58, 37.5, 36, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(28, 41, 10, 62, 40, 40, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(42, 55, 13, 67, 43, 44.5, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(56, 63, 15.5, 70, 35, 55.5, DIAGONAL_ANGLE),
  ...generateDiagonalRowPositions(64, 71, 18.5, 75, 38, 59.5, DIAGONAL_ANGLE),

  ...generateRowPositions(72, 87, 10, 47, 90),
  ...generateRowPositions(88, 107, 17, 45, 90),
  ...generateRowPositions(108, 127, 24, 45, 90),
  ...generateRowPositions(128, 147, 31, 45, 90),
  ...generateRowPositions(148, 167, 38, 45, 90),
  ...generateRowPositions(168, 187, 45, 45, 90),

  ["C188", { x: 92, y: 48, rotation: 90 }],

  ...generateRowPositions(189, 207, 52, 47, 88),

  ["C208", { x: 91, y: 55, rotation: 90 }],
  ["C209", { x: 93.5, y: 55, rotation: 90 }],
  ["C210", { x: 96, y: 55, rotation: 90 }],

  ...generateRowPositions(211, 224, 60, 53, 84),

  ["C225", { x: 86, y: 62, rotation: 90 }],
  ["C226", { x: 88.5, y: 62, rotation: 90 }],

  ...generateRowPositions(227, 242, 68, 53, 86),
  ...generateRowPositions(243, 252, 75, 56, 82, 0, [246]),
  ...generateRowPositions(253, 262, 82, 56, 82),
  ...generateRowPositions(263, 270, 89, 58, 80),
];

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = Object.fromEntries(allPositions);

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}

export function getWolfHollowContainerNames(): string[] {
  return Object.keys(WOLF_HOLLOW_POSITIONS);
}
