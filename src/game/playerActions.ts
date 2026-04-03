import { Direction, Maze, PlayerState } from '../mazeUtils';

// 現在向きに対する左方向の対応表。
export const LEFT_OF: Record<Direction, Direction> = {
  N: 'W',
  E: 'N',
  S: 'E',
  W: 'S',
};

// 現在向きに対する右方向の対応表。
export const RIGHT_OF: Record<Direction, Direction> = {
  N: 'E',
  E: 'S',
  S: 'W',
  W: 'N',
};

// 回転計算で使う方角順（時計回り）。
const DIRECTION_ORDER: Direction[] = ['N', 'E', 'S', 'W'];

/**
 * 向きに応じた前方1マスの座標を計算する。
 * @param x 現在セルX座標
 * @param y 現在セルY座標
 * @param dir 現在向き（N/E/S/W）
 * @returns 前方1マスの座標
 */
export const getForwardPosition = (
  x: number,
  y: number,
  dir: Direction
): { x: number; y: number } => {
  let nextX = x;
  let nextY = y;
  if (dir === 'N') nextY -= 1;
  if (dir === 'E') nextX += 1;
  if (dir === 'S') nextY += 1;
  if (dir === 'W') nextX -= 1;
  return { x: nextX, y: nextY };
};

/**
 * プレイヤーの向きを左右90度回転させる。
 * @param dir 現在向き（N/E/S/W）
 * @param turn 回転方向（left/right）
 * @returns 回転後の向き
 */
export const rotate = (dir: Direction, turn: 'left' | 'right'): Direction => {
  const index = DIRECTION_ORDER.indexOf(dir);
  return DIRECTION_ORDER[(index + (turn === 'left' ? 3 : 1)) % DIRECTION_ORDER.length];
};

/**
 * 前方に壁がない場合のみ1マス前進させる。
 * @param player 現在のプレイヤー座標と向き
 * @param maze 移動判定に使用する迷路データ
 * @returns 移動後のプレイヤー状態（移動不可なら元の状態）
 */
export const moveForward = (player: PlayerState, maze: Maze): PlayerState => {
  const { x, y, dir } = player;
  // 進行方向に壁がある場合は移動できない。
  if (maze[y][x].walls[dir]) return player;

  const next = getForwardPosition(x, y, dir);
  const nextX = next.x;
  const nextY = next.y;

  if (nextX < 0 || nextX >= maze[0].length || nextY < 0 || nextY >= maze.length) {
    return player;
  }
  return { ...player, x: nextX, y: nextY };
};
