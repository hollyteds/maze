import { Direction } from '../mazeUtils';

// 迷路の横マス数。表示難易度の基準値。
export const MAZE_WIDTH = 24;
// 迷路の縦マス数。表示難易度の基準値。
export const MAZE_HEIGHT = 16;

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

// ゴール有効時の強調色。UI全体で共通利用する。
export const GOAL_ACTIVE_COLOR = '#ff5c5c';
// ゴール無効時の無彩色。UI全体で共通利用する。
export const GOAL_INACTIVE_COLOR = '#9a9a9a';
// ゴール有効時の床ハイライト色。3D/2Dの床強調を揃える。
export const GOAL_ACTIVE_FLOOR_COLOR = 'rgba(255, 92, 92, 0.24)';
// ゴール無効時の床ハイライト色。ロック状態の床色を揃える。
export const GOAL_INACTIVE_FLOOR_COLOR = 'rgba(154, 154, 154, 0.24)';
// 上部ガイドテキストの通常色。警告表示と区別しない現在仕様に合わせる。
export const GOAL_PROMPT_TEXT_COLOR = '#cbffd9';
// カメラ移動アニメーション時間（ミリ秒）。入力ロック解除タイミングもこの値に同期する。
export const CAMERA_MOVE_DURATION_MS = 190;

// 3Dビューの壁判定デバッグログ出力フラグ。falseでconsoleログを停止する。
export const ENABLE_WALL_DEBUG_LOG = false;
