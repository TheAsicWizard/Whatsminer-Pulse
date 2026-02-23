import wolfHollowMapUrl from "@assets/2024-09-26_Wolf_Hollow_Site_Map_Layout_-_Cropped_-_Section_2_1771858299566.png";

export { wolfHollowMapUrl };

export type TemplatePosition = { x: number; y: number; rotation: number };

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = {
  // Right section: 4 rows × 8 columns (32 containers, 0° rotation)
  // Positions matched to actual container locations on reference image
  // Row 1 (top row, inside cyan outline area)
  C188: { x: 43, y: 13, rotation: 0 },
  C209: { x: 49.5, y: 13, rotation: 0 },
  C223: { x: 55.5, y: 13, rotation: 0 },
  C224: { x: 61.5, y: 13, rotation: 0 },
  C226: { x: 67.5, y: 13, rotation: 0 },
  C239: { x: 74, y: 13, rotation: 0 },
  C241: { x: 80, y: 13, rotation: 0 },
  C242: { x: 86, y: 13, rotation: 0 },
  // Row 2 (inside purple/green outline area)
  C245: { x: 43, y: 22, rotation: 0 },
  C247: { x: 49.5, y: 22, rotation: 0 },
  C248: { x: 55.5, y: 22, rotation: 0 },
  C249: { x: 61.5, y: 22, rotation: 0 },
  C250: { x: 67.5, y: 22, rotation: 0 },
  C251: { x: 74, y: 22, rotation: 0 },
  C252: { x: 80, y: 22, rotation: 0 },
  C253: { x: 86, y: 22, rotation: 0 },
  // Row 3 (yellow/red outline area)
  C254: { x: 43, y: 31, rotation: 0 },
  C255: { x: 49.5, y: 31, rotation: 0 },
  C256: { x: 55.5, y: 31, rotation: 0 },
  C257: { x: 61.5, y: 31, rotation: 0 },
  C258: { x: 67.5, y: 31, rotation: 0 },
  C259: { x: 74, y: 31, rotation: 0 },
  C260: { x: 80, y: 31, rotation: 0 },
  C261: { x: 86, y: 31, rotation: 0 },
  // Row 4 (bottom row of right section)
  C262: { x: 43, y: 40, rotation: 0 },
  C263: { x: 49.5, y: 40, rotation: 0 },
  C264: { x: 55.5, y: 40, rotation: 0 },
  C265: { x: 61.5, y: 40, rotation: 0 },
  C266: { x: 67.5, y: 40, rotation: 0 },
  C267: { x: 74, y: 40, rotation: 0 },
  C268: { x: 80, y: 40, rotation: 0 },
  C269: { x: 86, y: 40, rotation: 0 },

  // Left diagonal section: 3 rows × 5 (15 containers, 315° rotation)
  // Positioned to match diagonal container locations on reference image
  // Within-row step: (-5%, +5%) following the NW-SE diagonal
  // Between-row offset: (-3%, +8%) stacking rows down-left

  // Diagonal row 1 (uppermost/rightmost)
  C270: { x: 30, y: 28, rotation: 315 },
  C271: { x: 25, y: 33, rotation: 315 },
  C272: { x: 20, y: 38, rotation: 315 },
  C273: { x: 15, y: 43, rotation: 315 },
  C274: { x: 10, y: 48, rotation: 315 },
  // Diagonal row 2 (middle)
  C275: { x: 27, y: 36, rotation: 315 },
  C276: { x: 22, y: 41, rotation: 315 },
  C277: { x: 17, y: 46, rotation: 315 },
  C278: { x: 12, y: 51, rotation: 315 },
  C279: { x: 7, y: 56, rotation: 315 },
  // Diagonal row 3 (bottommost/leftmost)
  C280: { x: 24, y: 44, rotation: 315 },
  C281: { x: 19, y: 49, rotation: 315 },
  C282: { x: 14, y: 54, rotation: 315 },
  C283: { x: 9, y: 59, rotation: 315 },
  C284: { x: 4, y: 64, rotation: 315 },
};

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}
