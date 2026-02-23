import wolfHollowMapUrl from "@assets/2024-09-26_Wolf_Hollow_Site_Map_Layout_-_Cropped_-_Section_2_1771858299566.png";

export { wolfHollowMapUrl };

export type TemplatePosition = { x: number; y: number; rotation: number };

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = {
  // Right section: 4 rows × 8 columns (32 containers, 0° rotation)
  // Row 1
  C188: { x: 38, y: 8, rotation: 0 },
  C209: { x: 45, y: 8, rotation: 0 },
  C223: { x: 52, y: 8, rotation: 0 },
  C224: { x: 59, y: 8, rotation: 0 },
  C226: { x: 66, y: 8, rotation: 0 },
  C239: { x: 73, y: 8, rotation: 0 },
  C241: { x: 80, y: 8, rotation: 0 },
  C242: { x: 87, y: 8, rotation: 0 },
  // Row 2
  C245: { x: 38, y: 18, rotation: 0 },
  C247: { x: 45, y: 18, rotation: 0 },
  C248: { x: 52, y: 18, rotation: 0 },
  C249: { x: 59, y: 18, rotation: 0 },
  C250: { x: 66, y: 18, rotation: 0 },
  C251: { x: 73, y: 18, rotation: 0 },
  C252: { x: 80, y: 18, rotation: 0 },
  C253: { x: 87, y: 18, rotation: 0 },
  // Row 3
  C254: { x: 38, y: 28, rotation: 0 },
  C255: { x: 45, y: 28, rotation: 0 },
  C256: { x: 52, y: 28, rotation: 0 },
  C257: { x: 59, y: 28, rotation: 0 },
  C258: { x: 66, y: 28, rotation: 0 },
  C259: { x: 73, y: 28, rotation: 0 },
  C260: { x: 80, y: 28, rotation: 0 },
  C261: { x: 87, y: 28, rotation: 0 },
  // Row 4
  C262: { x: 38, y: 38, rotation: 0 },
  C263: { x: 45, y: 38, rotation: 0 },
  C264: { x: 52, y: 38, rotation: 0 },
  C265: { x: 59, y: 38, rotation: 0 },
  C266: { x: 66, y: 38, rotation: 0 },
  C267: { x: 73, y: 38, rotation: 0 },
  C268: { x: 80, y: 38, rotation: 0 },
  C269: { x: 87, y: 38, rotation: 0 },

  // Left section: 3 diagonal rows × 5 (15 containers, 315° rotation)
  // Each diagonal row runs upper-right to lower-left with step (-5%, +8%)
  // Rows offset by (+4%, +9%) from each other
  // Diagonal row 1 (C270-C274)
  C270: { x: 24, y: 20, rotation: 315 },
  C271: { x: 19, y: 28, rotation: 315 },
  C272: { x: 14, y: 36, rotation: 315 },
  C273: { x: 9, y: 44, rotation: 315 },
  C274: { x: 4, y: 52, rotation: 315 },
  // Diagonal row 2 (C275-C279)
  C275: { x: 28, y: 29, rotation: 315 },
  C276: { x: 23, y: 37, rotation: 315 },
  C277: { x: 18, y: 45, rotation: 315 },
  C278: { x: 13, y: 53, rotation: 315 },
  C279: { x: 8, y: 61, rotation: 315 },
  // Diagonal row 3 (C280-C284)
  C280: { x: 32, y: 38, rotation: 315 },
  C281: { x: 27, y: 46, rotation: 315 },
  C282: { x: 22, y: 54, rotation: 315 },
  C283: { x: 17, y: 62, rotation: 315 },
  C284: { x: 12, y: 70, rotation: 315 },
};

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}
