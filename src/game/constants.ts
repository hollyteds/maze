import { Direction } from '../mazeUtils';

// 迷路の横マス数。表示難易度の基準値。
export const MAZE_WIDTH = 15;
// 迷路の縦マス数。表示難易度の基準値。
export const MAZE_HEIGHT = 15;

// プレイヤー開始位置。
export const START = { x: 0, y: 0 } as const;
// クリア判定に使うゴール位置。
export const GOAL = { x: MAZE_WIDTH - 1, y: MAZE_HEIGHT - 1 } as const;

// 方角コードをUI表示用の日本語ラベルへ変換する表。
export const DIRECTION_LABEL: Record<Direction, string> = {
  N: '北',
  E: '東',
  S: '南',
  W: '西',
};

// 3Dビューの壁判定デバッグログ出力フラグ。falseでconsoleログを停止する。
export const ENABLE_WALL_DEBUG_LOG = false;
