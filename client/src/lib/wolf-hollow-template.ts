import wolfHollowMapUrl from "@assets/2024-09-26_Wolf_Hollow_Site_Map_Layout_-_Cropped_-_Section_2_1771858299566.png";

export { wolfHollowMapUrl };

export type TemplatePosition = { x: number; y: number; rotation: number };

const WOLF_HOLLOW_POSITIONS: Record<string, TemplatePosition> = {
  C188: { x: 48, y: 10, rotation: 0 },
  C209: { x: 54.5, y: 10, rotation: 0 },
  C223: { x: 61, y: 10, rotation: 0 },
  C224: { x: 67.5, y: 10, rotation: 0 },
  C226: { x: 74, y: 10, rotation: 0 },
  C239: { x: 80.5, y: 10, rotation: 0 },
  C241: { x: 87, y: 10, rotation: 0 },
  C242: { x: 93.5, y: 10, rotation: 0 },

  C245: { x: 48, y: 18, rotation: 0 },
  C247: { x: 54.5, y: 18, rotation: 0 },
  C248: { x: 61, y: 18, rotation: 0 },
  C249: { x: 67.5, y: 18, rotation: 0 },
  C250: { x: 74, y: 18, rotation: 0 },
  C251: { x: 80.5, y: 18, rotation: 0 },
  C252: { x: 87, y: 18, rotation: 0 },
  C253: { x: 93.5, y: 18, rotation: 0 },

  C254: { x: 48, y: 26, rotation: 0 },
  C255: { x: 54.5, y: 26, rotation: 0 },
  C256: { x: 61, y: 26, rotation: 0 },
  C257: { x: 67.5, y: 26, rotation: 0 },
  C258: { x: 74, y: 26, rotation: 0 },
  C259: { x: 80.5, y: 26, rotation: 0 },
  C260: { x: 87, y: 26, rotation: 0 },
  C261: { x: 93.5, y: 26, rotation: 0 },

  C262: { x: 48, y: 34, rotation: 0 },
  C263: { x: 54.5, y: 34, rotation: 0 },
  C264: { x: 61, y: 34, rotation: 0 },
  C265: { x: 67.5, y: 34, rotation: 0 },
  C266: { x: 74, y: 34, rotation: 0 },
  C267: { x: 80.5, y: 34, rotation: 0 },
  C268: { x: 87, y: 34, rotation: 0 },
  C269: { x: 93.5, y: 34, rotation: 0 },

  C270: { x: 29, y: 36, rotation: 315 },
  C271: { x: 25, y: 40, rotation: 315 },
  C272: { x: 21, y: 44, rotation: 315 },
  C273: { x: 17, y: 48, rotation: 315 },
  C274: { x: 13, y: 52, rotation: 315 },

  C275: { x: 31, y: 44, rotation: 315 },
  C276: { x: 27, y: 48, rotation: 315 },
  C277: { x: 23, y: 52, rotation: 315 },
  C278: { x: 19, y: 56, rotation: 315 },
  C279: { x: 15, y: 60, rotation: 315 },

  C280: { x: 33, y: 52, rotation: 315 },
  C281: { x: 29, y: 56, rotation: 315 },
  C282: { x: 25, y: 60, rotation: 315 },
  C283: { x: 21, y: 64, rotation: 315 },
  C284: { x: 17, y: 68, rotation: 315 },
};

export function getWolfHollowTemplate(): Map<string, TemplatePosition> {
  return new Map(Object.entries(WOLF_HOLLOW_POSITIONS));
}
