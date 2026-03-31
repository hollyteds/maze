// 迷路の横マス数。表示難易度の基準値。
export const MAZE_WIDTH = 10;
// 迷路の縦マス数。表示難易度の基準値。
export const MAZE_HEIGHT = 10;

// プレイヤー開始位置。
export const START = { x: 0, y: 0 } as const;
// クリア判定に使うゴール位置。
export const GOAL = { x: MAZE_WIDTH - 1, y: MAZE_HEIGHT - 1 } as const;

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
// ゲームタイマー更新間隔（ミリ秒）。細かすぎる再描画を抑える。
export const TIMER_INTERVAL_MS = 50;
// ヘルプマップのデバッグ開示トグルキー。
export const MAP_DEBUG_REVEAL_KEY = 'd';

// 3Dビューの壁判定デバッグログ出力フラグ。falseでconsoleログを停止する。
export const ENABLE_WALL_DEBUG_LOG = false;

// 3Dビューの横幅（px）。UIレイアウトとキャンバスサイズの基準になる。
export const VIEWPORT_WIDTH = 760;
// 3Dビューの縦幅（px）。UIレイアウトとキャンバスサイズの基準になる。
export const VIEWPORT_HEIGHT = 380;
// 迷路ワイヤー/輪郭の基準色。
export const LINE_COLOR = '#9df7b5';
// ビュー外枠のグロー色。
export const GLOW_COLOR = '#58d47f';

// ゴール解放メッセージの点滅周期（秒）。
export const GOAL_PROMPT_BLINK_DURATION_SEC = 0.9;
// 未解放ゴール警告メッセージの点滅周期（秒）。
export const GOAL_LOCKED_WARNING_BLINK_DURATION_SEC = 0.35;
// ゴール未解放警告の表示時間（ミリ秒）。
export const GOAL_LOCKED_WARNING_DURATION_MS = 3000;

// 1セルのワールドサイズ。迷路全体の縮尺を決める。
export const WORLD_CELL_SIZE = .8;
// 壁の高さ。値を増やすと圧迫感が増える。
export const WORLD_WALL_HEIGHT = .8;
// 壁の厚み。現行基準(0.08)の1/4にして細い壁表現へ寄せる。
export const WORLD_WALL_THICKNESS = 0.08 * 0.25;
// 床面の基準Y座標。
export const WORLD_FLOOR_Y = 0;
// 床面をわずかに浮かせる量。Z-fightingを抑える。
export const WORLD_FLOOR_ELEVATION = 0.002;

// 視点の高さ。壁高さの半分に固定する。
export const CAMERA_EYE_HEIGHT = WORLD_WALL_HEIGHT / 1.8;
// 視点の俯き角（ラジアン）。0で地面と平行。
export const CAMERA_PITCH_RAD = 0;
// カメラ後退量。値を増やすと視点が手前へ下がる。
export const CAMERA_BACK_OFFSET = .3;
// パースカメラの視野角（度）。
export const CAMERA_FOV_DEG = 74;
// パースカメラのニアクリップ。
export const CAMERA_NEAR = 0.02;
// パースカメラのファークリップ。
export const CAMERA_FAR = 35;
// フォグ開始距離。
export const CAMERA_FOG_NEAR = 0;
// フォグ終了距離。
export const CAMERA_FOG_FAR = 6;

// 壁メッシュの基準塗り色。
export const WALL_FILL_COLOR = '#0b2117';
// 壁輪郭線色。ビュー全体のワイヤー色に合わせる。
export const WALL_EDGE_COLOR = LINE_COLOR;
// 柱の太さ。角で埋もれないよう壁厚よりわずかに太くする。
export const WALL_PILLAR_SIZE = WORLD_WALL_THICKNESS * 1.16;
// 柱テクスチャの横解像度。
export const WALL_PILLAR_TEXTURE_WIDTH = 8;
// 柱テクスチャの縦解像度。
export const WALL_PILLAR_TEXTURE_HEIGHT = 128;

// 通常床の色。
export const FLOOR_BASE_COLOR = '#05130d';
// 通常床の不透明度。
export const FLOOR_BASE_OPACITY = 0.74;
// 未通過チェックポイントの強調色（マーカー/床側）。
export const CHECKPOINT_PENDING_COLOR = '#ffd98c';
// 通過済みチェックポイントの強調色（マーカー/床側）。
export const CHECKPOINT_CLEARED_COLOR = '#7bb58a';
// 未通過チェックポイントの壁面専用色（暗色）。
export const CHECKPOINT_PENDING_WALL_COLOR = '#8f7642';
// 通過済みチェックポイントの壁面専用色（暗色）。
export const CHECKPOINT_CLEARED_WALL_COLOR = '#4f7660';
// スタート地点の壁強調色（少し暗めの青）。
export const START_WALL_ACCENT_COLOR = '#5f90a5';
// ゴール有効時の壁面専用色（暗色）。
export const GOAL_ACTIVE_WALL_COLOR = '#8d2f2f';
// ゴール無効時の壁面専用色（暗色）。
export const GOAL_INACTIVE_WALL_COLOR = '#5f5f5f';

// マーカー柱の半径。
export const MARKER_RADIUS = 0.13;
// マーカー柱の高さ。
export const MARKER_HEIGHT = 0.24;
