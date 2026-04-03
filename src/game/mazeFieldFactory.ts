import { MAZE_HEIGHT, MAZE_WIDTH } from './constants';
import { Checkpoint, generateCheckpoints, toCheckpointKey } from './checkpointUtils';
import {
  GoalExit,
  generateMaze,
  getRandomGoalExit,
  getRandomStartPosition,
  Maze,
  MazePosition,
} from '../mazeUtils';

// 初期生成フィールド一式。
export type GameField = {
  maze: Maze;
  checkpoints: Checkpoint[];
  startPosition: MazePosition;
  goalExit: GoalExit;
};

/**
 * 初期ゲーム状態（迷路とチェックポイント）を生成する。
 * @returns 新規迷路と開始位置・出口情報・チェックポイント配列
 */
export const createGameField = (): GameField => {
  const maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT);
  const goalExit = getRandomGoalExit(maze, []);
  const startPosition = getRandomStartPosition(maze, [{ x: goalExit.x, y: goalExit.y }]);
  const checkpoints = generateCheckpoints(maze, [{ x: goalExit.x, y: goalExit.y }, startPosition]);
  return { maze, checkpoints, startPosition, goalExit };
};

/**
 * 訪問済みセル集合の初期値（開始セルのみ）を返す。
 * @param startPosition 開始セル座標
 * @returns 開始セル座標キーだけを含む集合
 */
export const createInitialVisitedCellKeys = (startPosition: MazePosition): Set<string> =>
  new Set([toCheckpointKey(startPosition.x, startPosition.y)]);
