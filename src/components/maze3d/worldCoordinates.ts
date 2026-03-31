import { WORLD_CELL_SIZE } from '../../game/constants';

/**
 * セルX座標をワールドXへ変換する。
 * @param cellX 迷路セルのX座標
 * @returns セル中心のワールドX座標
 */
export const toWorldX = (cellX: number): number => (cellX + 0.5) * WORLD_CELL_SIZE;

/**
 * セルY座標をワールドZへ変換する。
 * @param cellY 迷路セルのY座標
 * @returns セル中心のワールドZ座標
 */
export const toWorldZ = (cellY: number): number => (cellY + 0.5) * WORLD_CELL_SIZE;
