import { GoalExit, Maze, PlayerState } from '../mazeUtils';
import { getForwardPosition, rotate } from './playerActions';

// 前進入力解決結果。
export type ForwardResult = {
  nextPlayer: PlayerState;
  reachedGoal: boolean;
  attemptedLockedGoal: boolean;
};
// 移動/回転に利用する操作キー一覧。入力系追加時はここを基準に判定を揃える。
export const MOVE_CONTROL_KEYS = ['ArrowUp', 'ArrowLeft', 'ArrowRight'] as const;
// 移動/回転操作キーの型。
export type MoveControlKey = (typeof MOVE_CONTROL_KEYS)[number];

/**
 * 移動/回転に使う矢印キーかどうかを判定する。
 * @param key キー入力文字列
 * @returns 移動入力に使う矢印キーならtrue
 */
export const isMoveControlKey = (key: string): key is MoveControlKey =>
  MOVE_CONTROL_KEYS.includes(key as MoveControlKey);

/**
 * 座標が迷路範囲内かどうかを判定する。
 * @param x 判定対象X座標
 * @param y 判定対象Y座標
 * @param maze 迷路データ
 * @returns 範囲内なら true
 */
const isInsideMaze = (x: number, y: number, maze: Maze): boolean =>
  y >= 0 && y < maze.length && x >= 0 && x < (maze[0]?.length ?? 0);

/**
 * 前進入力の結果（通常移動/未解放ゴール試行/クリア）を解決する。
 * @param player 現在のプレイヤー状態
 * @param maze 迷路データ
 * @param goalExit ゴール出口セルと方向
 * @param goalActive ゴール有効化状態
 * @returns 前進解決結果
 */
const resolveForwardResult = (
  player: PlayerState,
  maze: Maze,
  goalExit: GoalExit,
  goalActive: boolean
): ForwardResult => {
  const { x, y, dir } = player;
  // 進行方向に壁がある場合は何も起きない。
  if (maze[y][x].walls[dir]) {
    return { nextPlayer: player, reachedGoal: false, attemptedLockedGoal: false };
  }

  const next = getForwardPosition(x, y, dir);
  if (isInsideMaze(next.x, next.y, maze)) {
    return {
      nextPlayer: { ...player, x: next.x, y: next.y },
      reachedGoal: false,
      attemptedLockedGoal: false,
    };
  }

  const isGoalExitAttempt = x === goalExit.x && y === goalExit.y && dir === goalExit.dir;
  if (!isGoalExitAttempt) {
    return { nextPlayer: player, reachedGoal: false, attemptedLockedGoal: false };
  }

  if (!goalActive) {
    return { nextPlayer: player, reachedGoal: false, attemptedLockedGoal: true };
  }
  // 解放済みなら迷路外座標へ進め、カメラも外側へ補間させる。
  return {
    nextPlayer: { ...player, x: next.x, y: next.y },
    reachedGoal: true,
    attemptedLockedGoal: false,
  };
};

/**
 * キー入力から次状態（移動/ゴール試行結果）を計算する。
 * @param key 押下キー
 * @param player 現在のプレイヤー状態
 * @param maze 迷路データ
 * @param goalExit ゴール出口セルと方向
 * @param goalActive ゴール有効化状態
 * @returns 次プレイヤー状態とゴール試行結果
 */
export const resolveNextPlayerState = (
  key: string,
  player: PlayerState,
  maze: Maze,
  goalExit: GoalExit,
  goalActive: boolean
): ForwardResult => {
  if (key === 'ArrowUp') return resolveForwardResult(player, maze, goalExit, goalActive);
  if (key === 'ArrowLeft') {
    return {
      nextPlayer: { ...player, dir: rotate(player.dir, 'left') },
      reachedGoal: false,
      attemptedLockedGoal: false,
    };
  }
  if (key === 'ArrowRight') {
    return {
      nextPlayer: { ...player, dir: rotate(player.dir, 'right') },
      reachedGoal: false,
      attemptedLockedGoal: false,
    };
  }
  return { nextPlayer: player, reachedGoal: false, attemptedLockedGoal: false };
};
