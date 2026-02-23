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
  // ═══════════════════════════════════════════════════════
  // DIAGONAL SECTION: 70 containers (C000-C069)
  // 4 rows of 14 + 2 rows of 7, angled at 325°
  // Each row runs from lower-left to upper-right
  // ═══════════════════════════════════════════════════════

  // Row 1 (C000-C013): topmost diagonal row
  ...generateDiagonalRowPositions(0, 13,   8, 28,  36, 45, DIAGONAL_ANGLE),
  // Row 2 (C014-C027): paired with row 1
  ...generateDiagonalRowPositions(14, 27,  10, 32,  38, 49, DIAGONAL_ANGLE),

  // Row 3 (C028-C041): second pair
  ...generateDiagonalRowPositions(28, 41,   6, 40,  34, 57, DIAGONAL_ANGLE),
  // Row 4 (C042-C055): paired with row 3
  ...generateDiagonalRowPositions(42, 55,   8, 44,  36, 61, DIAGONAL_ANGLE),

  // Row 5 (C056-C062): bottom short rows (7 containers)
  ...generateDiagonalRowPositions(56, 62,   5, 53,  17, 62, DIAGONAL_ANGLE),
  // Row 6 (C063-C069): paired with row 5
  ...generateDiagonalRowPositions(63, 69,   7, 57,  19, 66, DIAGONAL_ANGLE),

  // ═══════════════════════════════════════════════════════
  // HORIZONTAL SECTION: 214 containers (C070-C284, excl C246)
  // Paired rows in enclosures, tapering toward bottom
  // ═══════════════════════════════════════════════════════

  // Pair 1 (C070-C097)
  ...generateRowPositions(70,  83,   7,  44, 94),
  ...generateRowPositions(84,  97,  11,  44, 94),

  // Pair 2 (C098-C125)
  ...generateRowPositions(98, 111,  17,  44, 94),
  ...generateRowPositions(112, 125, 21,  44, 94),

  // Pair 3 (C126-C153)
  ...generateRowPositions(126, 139, 27,  44, 94),
  ...generateRowPositions(140, 153, 31,  44, 94),

  // Pair 4 (C154-C181)
  ...generateRowPositions(154, 167, 37,  44, 94),
  ...generateRowPositions(168, 181, 41,  44, 94),

  // Pair 5 (C182-C209)
  ...generateRowPositions(182, 195, 47,  44, 94),
  ...generateRowPositions(196, 209, 51,  44, 94),

  // Narrowing rows: 12 containers each
  ...generateRowPositions(210, 221, 58,  48, 92),
  ...generateRowPositions(222, 233, 63,  48, 92),

  // 11 containers each
  ...generateRowPositions(234, 244, 69,  50, 90),
  ...generateRowPositions(245, 256, 74,  50, 90, 0, [246]),

  // 10 containers each
  ...generateRowPositions(257, 266, 80,  52, 88),
  ...generateRowPositions(267, 276, 85,  52, 88),

  // Bottom rows: 4 containers each
  ...generateRowPositions(277, 280, 91,  48, 62),
  ...generateRowPositions(281, 284, 96,  55, 69),
];

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = Object.fromEntries(allPositions);

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}

export function getWolfHollowContainerNames(): string[] {
  return Object.keys(WOLF_HOLLOW_POSITIONS);
}
