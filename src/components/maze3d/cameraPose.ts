import { CAMERA_BACK_OFFSET } from '../../game/constants';
import { PlayerState } from '../../mazeUtils';
import { toWorldX, toWorldZ } from './worldCoordinates';

// カメラ補間で扱う姿勢値（平面位置+方位）。
export type CameraPose = {
  x: number;
  z: number;
  yaw: number;
};

// 平面方向ベクトル（XZ）。
type XZVector = {
  x: number;
  z: number;
};

/**
 * プレイヤー方角をThree.jsのY回転角へ変換する。
 * @param dir 方角コード（N/E/S/W）
 * @returns カメラのyaw角（ラジアン）
 */
const toCameraYaw = (dir: PlayerState['dir']): number => {
  if (dir === 'N') return 0;
  if (dir === 'E') return -Math.PI / 2;
  if (dir === 'S') return Math.PI;
  return Math.PI / 2;
};

/**
 * プレイヤー向きの前方ベクトルを返す。
 * @param dir 方角コード（N/E/S/W）
 * @returns XZ平面の前方単位ベクトル
 */
const toForwardVector = (dir: PlayerState['dir']): XZVector => {
  if (dir === 'N') return { x: 0, z: -1 };
  if (dir === 'E') return { x: 1, z: 0 };
  if (dir === 'S') return { x: 0, z: 1 };
  return { x: -1, z: 0 };
};

/**
 * 方角つきプレイヤー状態をカメラ姿勢へ変換する。
 * @param player プレイヤー座標と向き
 * @returns カメラ配置に使う姿勢値
 */
export const toCameraPose = (player: PlayerState): CameraPose => ({
  x: toWorldX(player.x) - toForwardVector(player.dir).x * CAMERA_BACK_OFFSET,
  z: toWorldZ(player.y) - toForwardVector(player.dir).z * CAMERA_BACK_OFFSET,
  yaw: toCameraYaw(player.dir),
});

/**
 * 角度を -PI..PI の範囲へ正規化する。
 * @param angle 正規化前の角度（ラジアン）
 * @returns 正規化後角度
 */
const normalizeAngle = (angle: number): number => {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
};

/**
 * fromからtoへ最短回転で到達する角度差を返す。
 * @param from 開始角度（ラジアン）
 * @param to 目標角度（ラジアン）
 * @returns 最短角度差（ラジアン）
 */
export const getShortestAngleDelta = (from: number, to: number): number =>
  normalizeAngle(to - from);

/**
 * イージング付き補間係数を返す。
 * @param t 0..1 の時間進捗
 * @returns 0..1 のイージング済み係数
 */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
