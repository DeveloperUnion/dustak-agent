// 実 ImageModel API クライアント。
// API: https://jvxqvfx3pv.ap-northeast-1.awsapprunner.com/api/detect
// プロジェクト本体: ../../ImageModel/image-model
//
// CORS 制約があるため、ブラウザからは直接叩かず Next.js の /api/detect 経由でプロキシする。

export interface DetectedItem {
  id: number;
  name: string;
  info: string;
  color: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface DetectResponse {
  items: DetectedItem[];
}

export const IMAGE_MODEL_BASE_URL =
  process.env.IMAGE_MODEL_BASE_URL ?? 'https://jvxqvfx3pv.ap-northeast-1.awsapprunner.com';
