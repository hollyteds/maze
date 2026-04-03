import { WORLD_CELL_SIZE } from '../../game/constants';
import { GoalExit } from '../../mazeUtils';
import { toWorldX, toWorldZ } from './worldCoordinates';

// 柱グリッド座標。
type GridPoint = {
  x: number;
  z: number;
};

/**
 * 出口開口位置（壁境界中心）をワールド座標で返す。
 * @param goalExit ゴール出口情報
 * @returns 開口中心のワールド座標
 */
export const getGoalOpeningCenter = (goalExit: GoalExit): { x: number; z: number } => {
  let x = toWorldX(goalExit.x);
  let z = toWorldZ(goalExit.y);
  if (goalExit.dir === 'N') z = goalExit.y * WORLD_CELL_SIZE;
  if (goalExit.dir === 'S') z = (goalExit.y + 1) * WORLD_CELL_SIZE;
  if (goalExit.dir === 'W') x = goalExit.x * WORLD_CELL_SIZE;
  if (goalExit.dir === 'E') x = (goalExit.x + 1) * WORLD_CELL_SIZE;
  return { x, z };
};

/**
 * 出口開口を構成する2本の柱グリッド座標を返す。
 * @param goalExit ゴール出口情報
 * @returns 開口両端の柱グリッド座標配列
 */
export const getGoalPillarPoints = (goalExit: GoalExit): GridPoint[] => {
  if (goalExit.dir === 'N') return [{ x: goalExit.x, z: goalExit.y }, { x: goalExit.x + 1, z: goalExit.y }];
  if (goalExit.dir === 'S') {
    return [{ x: goalExit.x, z: goalExit.y + 1 }, { x: goalExit.x + 1, z: goalExit.y + 1 }];
  }
  if (goalExit.dir === 'W') return [{ x: goalExit.x, z: goalExit.y }, { x: goalExit.x, z: goalExit.y + 1 }];
  return [{ x: goalExit.x + 1, z: goalExit.y }, { x: goalExit.x + 1, z: goalExit.y + 1 }];
};
