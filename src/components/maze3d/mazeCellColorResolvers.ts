import * as THREE from 'three';
import { toCheckpointKey } from '../../game/checkpointUtils';
import {
  CHECKPOINT_CLEARED_COLOR,
  CHECKPOINT_CLEARED_WALL_COLOR,
  CHECKPOINT_PENDING_COLOR,
  CHECKPOINT_PENDING_WALL_COLOR,
  FLOOR_BASE_COLOR,
} from '../../game/constants';

/**
 * CSSカラー文字列をThree.js用の色+透明度へ変換する。
 * @param color CSSカラー（`#rrggbb` / `rgb(...)` / `rgba(...)`）
 * @returns Three.js描画で使う色情報
 */
export const toThreeColorInfo = (
  color: string
): { color: THREE.ColorRepresentation; opacity: number } => {
  const rgbaMatch =
    color.match(
      /^rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/i
    ) ??
    color.match(/^rgb\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/i);

  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const alpha = rgbaMatch[4] ? Number(rgbaMatch[4]) : 1;
    return {
      color: new THREE.Color(r / 255, g / 255, b / 255),
      opacity: Number.isFinite(alpha) ? alpha : 1,
    };
  }

  const threeColor = new THREE.Color();
  threeColor.setStyle(color);
  return { color: threeColor, opacity: 1 };
};

/**
 * 床色をセル属性から決定する。
 * @param cellX セルX座標
 * @param cellY セルY座標
 * @param checkpointKeySet チェックポイント存在キー集合
 * @param passedCheckpointKeys 通過済みチェックポイントキー集合
 * @returns 床色文字列
 */
export const resolveFloorColor = (
  cellX: number,
  cellY: number,
  checkpointKeySet: Set<string>,
  passedCheckpointKeys: Set<string>
): string => {
  const key = toCheckpointKey(cellX, cellY);
  if (!checkpointKeySet.has(key)) return FLOOR_BASE_COLOR;
  return passedCheckpointKeys.has(key)
    ? 'rgba(123, 181, 138, 0.24)'
    : 'rgba(255, 217, 140, 0.24)';
};

/**
 * マーカー柱の色をセル属性から決定する。
 * @param cellX セルX座標
 * @param cellY セルY座標
 * @param checkpointKeySet チェックポイント存在キー集合
 * @param passedCheckpointKeys 通過済みチェックポイントキー集合
 * @returns マーカー色。不要ならnull
 */
export const resolveMarkerColor = (
  cellX: number,
  cellY: number,
  checkpointKeySet: Set<string>,
  passedCheckpointKeys: Set<string>
): string | null => {
  const key = toCheckpointKey(cellX, cellY);
  if (!checkpointKeySet.has(key)) return null;
  return passedCheckpointKeys.has(key) ? CHECKPOINT_CLEARED_COLOR : CHECKPOINT_PENDING_COLOR;
};

/**
 * 壁色強調の対象セル色を返す（チェックポイントのみ）。
 * @param cellX セルX座標
 * @param cellY セルY座標
 * @param checkpointKeySet チェックポイント存在キー集合
 * @param passedCheckpointKeys 通過済みチェックポイントキー集合
 * @returns 強調色。対象外セルならnull
 */
export const resolveWallAccentColor = (
  cellX: number,
  cellY: number,
  checkpointKeySet: Set<string>,
  passedCheckpointKeys: Set<string>
): string | null => {
  const key = toCheckpointKey(cellX, cellY);
  if (!checkpointKeySet.has(key)) return null;
  return passedCheckpointKeys.has(key)
    ? CHECKPOINT_CLEARED_WALL_COLOR
    : CHECKPOINT_PENDING_WALL_COLOR;
};
