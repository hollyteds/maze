// ========================================
// 迷路サイズ・進行
// ========================================
// 迷路の横マス数。表示難易度の基準値。
export const MAZE_WIDTH = 15;
// 迷路の縦マス数。表示難易度の基準値。
export const MAZE_HEIGHT = 15;

// ゴール表示を出口側へずらす比率。2D/3Dで同じ見え方を維持する。
export const GOAL_EXIT_MARKER_OFFSET_RATIO = 0.62;

// ゴール有効時の強調色。UI全体で共通利用する。
export const GOAL_ACTIVE_COLOR = '#ff5c5c';
// ゴール無効時の無彩色。UI全体で共通利用する。
export const GOAL_INACTIVE_COLOR = '#9a9a9a';
// 出口外側の床色。ゴール解放状態に関係なく常時表示する。
export const GOAL_OUTSIDE_FLOOR_COLOR = 'rgba(255, 92, 92, 0.32)';
// 上部ガイドテキストの通常色。警告表示と区別しない現在仕様に合わせる。
export const GOAL_PROMPT_TEXT_COLOR = '#cbffd9';
// カメラ移動アニメーション時間（ミリ秒）。入力ロック解除タイミングもこの値に同期する。
export const CAMERA_MOVE_DURATION_MS = 190;
// ゲームタイマー更新間隔（ミリ秒）。細かすぎる再描画を抑える。
export const TIMER_INTERVAL_MS = 50;

// ========================================
// ヘルプマップ操作・可視化モード
// ========================================
// ヘルプマップのデバッグ開示トグルキー。
export const MAP_DEBUG_REVEAL_KEY = 'd';
// 通常ヘルプマップのチェックポイント表示モード一覧。追加時は判定ロジックの対応更新が必要。
export const HELP_MAP_CHECKPOINT_VISIBILITY_MODES = {
  PASSED_ONLY: 'passed_only',
  ALL: 'all',
} as const;
// チェックポイント表示モード型。定数化して比較文字列の打ち間違いを防ぐ。
export type HelpMapCheckpointVisibilityMode =
  (typeof HELP_MAP_CHECKPOINT_VISIBILITY_MODES)[keyof typeof HELP_MAP_CHECKPOINT_VISIBILITY_MODES];
// 通常ヘルプマップでのチェックポイント表示モード。
// `passed_only` は通過済みのみ、`all` は全表示。値を変えると探索難易度と情報量が変わる。
export const HELP_MAP_CHECKPOINT_VISIBILITY_MODE: HelpMapCheckpointVisibilityMode =
  HELP_MAP_CHECKPOINT_VISIBILITY_MODES.PASSED_ONLY;

// 通常ヘルプマップのゴール表示モード一覧。追加時は判定ロジックの対応更新が必要。
export const HELP_MAP_GOAL_VISIBILITY_MODES = {
  PASSED_ONLY: 'passed_only',
  ACTIVE_OR_CLEARED: 'active_or_cleared',
  CLEARED_ONLY: 'cleared_only',
  ALWAYS: 'always',
} as const;
// ゴール表示モード型。定数化して比較文字列の打ち間違いを防ぐ。
export type HelpMapGoalVisibilityMode =
  (typeof HELP_MAP_GOAL_VISIBILITY_MODES)[keyof typeof HELP_MAP_GOAL_VISIBILITY_MODES];
// 通常ヘルプマップでのゴール表示モード。
// `passed_only` は出口セル通過後、`active_or_cleared` は解放後またはクリア後、`cleared_only` はクリア後のみ、`always` は常時表示。
export const HELP_MAP_GOAL_VISIBILITY_MODE: HelpMapGoalVisibilityMode =
  HELP_MAP_GOAL_VISIBILITY_MODES.PASSED_ONLY;

// ========================================
// 3Dビュー表示
// ========================================
// 3Dビューの壁判定デバッグログ出力フラグ。falseでconsoleログを停止する。
export const ENABLE_WALL_DEBUG_LOG = false;

// 3Dビューの横幅（px）。UIレイアウトとキャンバスサイズの基準になる。
export const VIEWPORT_WIDTH = 760;
// 3Dビューの縦幅（px）。UIレイアウトとキャンバスサイズの基準になる。
export const VIEWPORT_HEIGHT = 380;
// タッチの横スワイプを回転入力として扱う最小移動量（px）。小さくすると誤回転が増える。
export const TOUCH_SWIPE_TURN_THRESHOLD_PX = 24;
// タップ判定で許容する最大移動量（px）。大きくするとスワイプ誤判定が増える。
export const TOUCH_TAP_MOVE_TOLERANCE_PX = 10;
// タップとして扱う最大接触時間（ms）。長くすると長押しでも前進しやすくなる。
export const TOUCH_TAP_MAX_DURATION_MS = 300;
// タッチ全画面UIのアクションボタン外寸（px）。誤タップを減らすため最小44px以上を確保する。
export const TOUCH_ACTION_BUTTON_SIZE_PX = 52;
// タッチ全画面UIの下部オーバーレイ余白（px）。情報表示とボタンの干渉を避ける。
export const TOUCH_OVERLAY_BOTTOM_PADDING_PX = 16;
// 縦向き時に横向きを促す案内文言。全画面モード中はこの文言のみ表示する。
export const TOUCH_LANDSCAPE_PROMPT_TEXT = '横向きにしてプレイしてください';
// タッチ全画面UIのステータス表示レイヤー。ポップアップより背面に固定する。
export const TOUCH_STATUS_OVERLAY_Z_INDEX = 12;
// タッチ全画面UIのアクションボタン既定レイヤー。通常時はポップアップ背面に置く。
export const TOUCH_ACTION_BUTTON_BASE_Z_INDEX = 14;
// マップ表示オーバーレイのレイヤー。
export const TOUCH_MAP_OVERLAY_Z_INDEX = 20;
// マップ表示中にMAPボタンだけ前面へ出すレイヤー。
export const TOUCH_MAP_BUTTON_ACTIVE_Z_INDEX = 24;
// 操作ヘルプ表示オーバーレイのレイヤー。
export const TOUCH_HELP_OVERLAY_Z_INDEX = 30;
// 操作ヘルプ表示中にHELPボタンだけ前面へ出すレイヤー。
export const TOUCH_HELP_BUTTON_ACTIVE_Z_INDEX = 34;
// タッチ全画面UIのRETRYボタンレイヤー。
export const TOUCH_RETRY_BUTTON_Z_INDEX = 22;
// 迷路ワイヤー/輪郭の基準色。
export const LINE_COLOR = '#9df7b5';
// ビュー外枠のグロー色。
export const GLOW_COLOR = '#58d47f';

// ========================================
// メッセージ演出
// ========================================
// ゴール解放メッセージの点滅周期（秒）。
export const GOAL_PROMPT_BLINK_DURATION_SEC = 0.9;
// 通常時メッセージの文字サイズ（px）。
export const GOAL_PROMPT_FONT_SIZE_PX = 15;
// クリア時「GOAL!」メッセージの文字サイズ（px）。通常時の2倍で中央演出に使う。
export const GOAL_CLEAR_FONT_SIZE_PX = GOAL_PROMPT_FONT_SIZE_PX * 2;
// ゴール解放時に表示する誘導メッセージ文言。
export const GOAL_PROMPT_TEXT = 'ゴールに向かえ！';
// ゴール未解放で出口を試行した際の警告メッセージ文言。
export const GOAL_LOCKED_WARNING_TEXT = 'チェックポイントを回収せよ！';
// クリア時に表示する完了メッセージ文言。
export const GOAL_CLEAR_TEXT = 'GOAL！';
// 未解放ゴール警告メッセージの点滅周期（秒）。
export const GOAL_LOCKED_WARNING_BLINK_DURATION_SEC = 0.35;
// ゴール未解放警告の表示時間（ミリ秒）。
export const GOAL_LOCKED_WARNING_DURATION_MS = 3000;

// ========================================
// ワールド座標・カメラ
// ========================================
// 1セルのワールドサイズ。迷路全体の縮尺を決める。
export const WORLD_CELL_SIZE = 0.8;
// 壁の高さ。値を増やすと圧迫感が増える。
export const WORLD_WALL_HEIGHT = 0.8;
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
export const CAMERA_BACK_OFFSET = 0.3;
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

// ========================================
// 壁・柱・床・マーカー
// ========================================
// 壁メッシュの基準塗り色。
export const WALL_FILL_COLOR = '#0b2117';
// 壁輪郭線色。ビュー全体のワイヤー色に合わせる。
export const WALL_EDGE_COLOR = LINE_COLOR;
// 柱の太さ。角で埋もれないよう壁厚よりわずかに太くする。
export const WALL_PILLAR_SIZE = WORLD_WALL_THICKNESS * 1.16;
// 解放済み出口を示す柱色。外周開口の目印になる。
export const GOAL_OPEN_PILLAR_COLOR = '#ff4a4a';
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
// マーカー柱の半径。
export const MARKER_RADIUS = 0.13;
// マーカー柱の高さ。
export const MARKER_HEIGHT = 0.24;

// ========================================
// ゴール出口ゲート
// ========================================
// 未解放出口を塞ぐ格子の縦棒本数。値を増やすと密度が上がる。
export const GOAL_GATE_BAR_COUNT = 6;
// 格子バーの太さ。太くすると閉塞感が増える。
export const GOAL_GATE_BAR_THICKNESS = WORLD_WALL_THICKNESS * 0.56;
// 格子バーの色。牢屋の金属感を優先する。
export const GOAL_GATE_BAR_COLOR = '#7e8f9c';
