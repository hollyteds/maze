import * as THREE from 'three';
import { WALL_PILLAR_TEXTURE_HEIGHT, WALL_PILLAR_TEXTURE_WIDTH } from '../../game/constants';

// 柱テクスチャのキャッシュ。再生成を避けて描画更新時の負荷を抑える。
let wallPillarTextureCache: THREE.CanvasTexture | null = null;

/**
 * 柱へ貼るシームレステクスチャを生成する。
 * @returns 生成したCanvasTexture
 */
const createWallPillarTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = WALL_PILLAR_TEXTURE_WIDTH;
  canvas.height = WALL_PILLAR_TEXTURE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    const fallbackTexture = new THREE.CanvasTexture(canvas);
    fallbackTexture.colorSpace = THREE.SRGBColorSpace;
    return fallbackTexture;
  }

  const gradient = context.createLinearGradient(0, 0, 0, WALL_PILLAR_TEXTURE_HEIGHT);
  gradient.addColorStop(0, '#8db89a');
  gradient.addColorStop(0.5, '#7aa58a');
  gradient.addColorStop(1, '#6f977f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WALL_PILLAR_TEXTURE_WIDTH, WALL_PILLAR_TEXTURE_HEIGHT);

  // 列方向は均一色のまま、横帯だけを重ねて柱の縦シーム感を抑える。
  for (let y = 0; y < WALL_PILLAR_TEXTURE_HEIGHT; y += 8) {
    context.fillStyle = y % 16 === 0 ? 'rgba(18, 32, 24, 0.18)' : 'rgba(224, 255, 232, 0.06)';
    context.fillRect(0, y, WALL_PILLAR_TEXTURE_WIDTH, 1);
  }

  for (let y = 0; y < WALL_PILLAR_TEXTURE_HEIGHT; y += 2) {
    const alpha = 0.015 + Math.random() * 0.02;
    context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    context.fillRect(0, y, WALL_PILLAR_TEXTURE_WIDTH, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

/**
 * 柱テクスチャを取得する（未生成なら生成してキャッシュする）。
 * @returns 柱描画に使うCanvasTexture
 */
export const getWallPillarTexture = (): THREE.CanvasTexture => {
  if (!wallPillarTextureCache) {
    wallPillarTextureCache = createWallPillarTexture();
  }
  return wallPillarTextureCache;
};
