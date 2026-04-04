import {
  GOAL_ACTIVE_COLOR,
  GOAL_EXIT_MARKER_OFFSET_RATIO,
  GOAL_INACTIVE_COLOR,
  HELP_MAP_CHECKPOINT_VISIBILITY_MODE,
  HELP_MAP_GOAL_VISIBILITY_MODE,
} from '../game/constants';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';
import { HelpMapVisibilityPolicy } from '../game/helpMapVisibilityPolicy';
import { GoalExit, Maze, PlayerState } from '../mazeUtils';

// HelpMapコンポーネントの入力プロパティ。
type HelpMapProps = {
  // 表示対象の迷路データ。
  maze: Maze;
  // ゴール出口（セル座標と外向き方向）。
  goalExit: GoalExit;
  // プレイヤー現在位置と向き。
  player: PlayerState;
  // 全チェックポイント座標。
  checkpoints: Checkpoint[];
  // 通過済みチェックポイント座標キー集合。
  passedCheckpointKeys: Set<string>;
  // 訪問済みセル座標キー集合。
  visitedCellKeys: Set<string>;
  // 未訪問領域も含めて全体を表示するデバッグフラグ。
  revealHiddenMapForDebug: boolean;
  // ゴールが有効化済みかどうか。
  goalActive: boolean;
  // クリア済みかどうか。
  finished: boolean;
  // 表示可能な最大横幅（px）。指定時は比率維持で縮小する。
  maxDisplayWidthPx?: number;
  // 表示可能な最大縦幅（px）。指定時は比率維持で縮小する。
  maxDisplayHeightPx?: number;
};

/**
 * ヘルプ用の2D俯瞰マップを描画する。
 * @param maze 迷路全体データ
 * @param goalExit ゴール出口（セル座標と外向き方向）
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param visitedCellKeys 訪問済みセル座標キー集合
 * @param revealHiddenMapForDebug 未訪問領域を表示するデバッグフラグ
 * @param goalActive ゴール有効化状態
 * @param finished クリア済み状態
 * @param maxDisplayWidthPx 表示可能な最大横幅（px）
 * @param maxDisplayHeightPx 表示可能な最大縦幅（px）
 * @returns 壁線・チェックポイント・ゴール・プレイヤー向きを描いたSVG
 */
export function HelpMap({
  maze,
  goalExit,
  player,
  checkpoints,
  passedCheckpointKeys,
  visitedCellKeys,
  revealHiddenMapForDebug,
  goalActive,
  finished,
  maxDisplayWidthPx,
  maxDisplayHeightPx,
}: HelpMapProps) {
  // 1マスの描画サイズ（px）。
  const cellSize = 22;
  // マップ外周の余白（px）。
  const pad = 14;
  // マップ本体の横幅（px）。
  const mapWidth = maze[0].length * cellSize;
  // マップ本体の縦幅（px）。
  const mapHeight = maze.length * cellSize;
  // SVG全体の横幅（余白込み）。
  const width = mapWidth + pad * 2;
  // SVG全体の縦幅（余白込み）。
  const height = mapHeight + pad * 2;
  // 指定された表示上限に合わせた縮小率。未指定時は等倍表示。
  const widthScale = maxDisplayWidthPx ? maxDisplayWidthPx / width : 1;
  const heightScale = maxDisplayHeightPx ? maxDisplayHeightPx / height : 1;
  // 比率を崩さないよう縦横の最小縮小率を適用し、拡大はしない。
  const displayScale = Math.min(1, widthScale, heightScale);
  // 実表示横幅（px）。
  const displayWidth = width * displayScale;
  // 実表示縦幅（px）。
  const displayHeight = height * displayScale;

  // プレイヤー三角形の中心X。
  const px = pad + player.x * cellSize + cellSize / 2;
  // プレイヤー三角形の中心Y。
  const py = pad + player.y * cellSize + cellSize / 2;
  // 向きに応じた三角形頂点座標。
  const playerTriangle =
    player.dir === 'N'
      ? `${px},${py - 6} ${px - 5},${py + 5} ${px + 5},${py + 5}`
      : player.dir === 'E'
        ? `${px + 6},${py} ${px - 5},${py - 5} ${px - 5},${py + 5}`
        : player.dir === 'S'
          ? `${px},${py + 6} ${px - 5},${py - 5} ${px + 5},${py - 5}`
          : `${px - 6},${py} ${px + 5},${py - 5} ${px + 5},${py + 5}`;
  // チェックポイント座標をキーで引けるように変換する。
  const checkpointMap = new Map(
    checkpoints.map((checkpoint) => [toCheckpointKey(checkpoint.x, checkpoint.y), checkpoint])
  );
  // ゴール表示を出口方向へ少しずらす量（px）。
  const goalOffset = cellSize * GOAL_EXIT_MARKER_OFFSET_RATIO;
  // ゴール出口セル中心X。
  const goalCellCenterX = pad + goalExit.x * cellSize + cellSize / 2;
  // ゴール出口セル中心Y。
  const goalCellCenterY = pad + goalExit.y * cellSize + cellSize / 2;
  // ゴール表示中心X（出口方向へオフセット）。
  const goalMarkerX =
    goalCellCenterX + (goalExit.dir === 'E' ? goalOffset : goalExit.dir === 'W' ? -goalOffset : 0);
  // ゴール表示中心Y（出口方向へオフセット）。
  const goalMarkerY =
    goalCellCenterY + (goalExit.dir === 'S' ? goalOffset : goalExit.dir === 'N' ? -goalOffset : 0);
  // ゴール出口に面した外周セルを通過済みかどうか。
  const passedGoalEdgeCell = visitedCellKeys.has(toCheckpointKey(goalExit.x, goalExit.y));
  // 表示可否判定をポリシークラスへ集約し、描画ロジックを簡潔に保つ。
  const visibilityPolicy = new HelpMapVisibilityPolicy({
    revealHiddenMapForDebug,
    checkpointVisibilityMode: HELP_MAP_CHECKPOINT_VISIBILITY_MODE,
    goalVisibilityMode: HELP_MAP_GOAL_VISIBILITY_MODE,
  });
  // 現在の設定に基づき、通常ヘルプマップでゴールを表示するか判定する。
  const showGoalMarker = visibilityPolicy.shouldShowGoal({
    passedGoalEdgeCell,
    goalActive,
    finished,
  });

  /**
   * セルが訪問済み（またはデバッグ全表示）かを判定する。
   * @param x セルX座標
   * @param y セルY座標
   * @returns 表示対象なら true
   */
  const isCellRevealed = (x: number, y: number): boolean =>
    revealHiddenMapForDebug || visitedCellKeys.has(toCheckpointKey(x, y));

  /**
   * ヘルプマップ上で壁線を描くべきか判定する。
   * @param x 対象セルX座標
   * @param y 対象セルY座標
   * @param dir 判定方向（N/E/S/W）
   * @returns 壁線を描画すべきなら true
   */
  const shouldDrawWallLine = (
    x: number,
    y: number,
    dir: keyof Maze[number][number]['walls']
  ): boolean => {
    const cell = maze[y][x];
    // 通常モードでも仮想壁は置かず、実壁だけ描画する。
    // なぜ必要か: 未訪問領域手前の分岐形状（壁なし開口）を正しく見せるため。
    return cell.walls[dir];
  };

  /**
   * セル属性に応じて床色を返す。
   * @param x セルX座標
   * @param y セルY座標
   * @returns 床塗り色。対象外セルはnull
   */
  const getCellFloorColor = (x: number, y: number): string | null => {
    const checkpoint = checkpointMap.get(toCheckpointKey(x, y));
    if (!checkpoint) return null;
    const passed = passedCheckpointKeys.has(toCheckpointKey(checkpoint.x, checkpoint.y));
    // passed_only設定では未通過CPの床色も含めて非表示にする。
    if (!visibilityPolicy.shouldShowCheckpoint(passed)) return null;
    return passed ? 'rgba(123, 181, 138, 0.24)' : 'rgba(255, 217, 140, 0.24)';
  };

  return (
    <svg
      width={displayWidth}
      height={displayHeight}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#031109', border: '1px solid #58d47f', display: 'block' }}
    >
      <rect x={0} y={0} width={width} height={height} fill="#031109" />
      {maze.flatMap((row, y) =>
        row.map((_, x) => {
          // 特殊セルだけ床色を塗る。
          const floorColor = getCellFloorColor(x, y);
          if (!floorColor) return null;
          return (
            <rect
              key={`floor-${x}-${y}`}
              x={pad + x * cellSize + 1.2}
              y={pad + y * cellSize + 1.2}
              width={cellSize - 2.4}
              height={cellSize - 2.4}
              fill={floorColor}
            />
          );
        })
      )}
      {maze.flatMap((row, y) =>
        row.flatMap((_, x) => {
          // 未訪問セルは非表示にし、通った道のみ表示する。
          if (!isCellRevealed(x, y)) return [];
          const x0 = pad + x * cellSize;
          const y0 = pad + y * cellSize;
          const x1 = x0 + cellSize;
          const y1 = y0 + cellSize;
          return [
            shouldDrawWallLine(x, y, 'N') ? <line key={`n-${x}-${y}`} x1={x0} y1={y0} x2={x1} y2={y0} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
            shouldDrawWallLine(x, y, 'E') ? <line key={`e-${x}-${y}`} x1={x1} y1={y0} x2={x1} y2={y1} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
            shouldDrawWallLine(x, y, 'S') ? <line key={`s-${x}-${y}`} x1={x0} y1={y1} x2={x1} y2={y1} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
            shouldDrawWallLine(x, y, 'W') ? <line key={`w-${x}-${y}`} x1={x0} y1={y0} x2={x0} y2={y1} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
          ];
        })
      )}
      {checkpoints.map((checkpoint) => {
        // 各チェックポイントの通過状態を座標キーで判定する。
        const checkpointKey = toCheckpointKey(checkpoint.x, checkpoint.y);
        const passed = passedCheckpointKeys.has(checkpointKey);
        // 非デバッグ時は設定に応じて未通過チェックポイントを隠す。
        if (!visibilityPolicy.shouldShowCheckpoint(passed)) return null;
        const cx = pad + checkpoint.x * cellSize + cellSize / 2;
        const cy = pad + checkpoint.y * cellSize + cellSize / 2;
        return (
          <g key={`checkpoint-${checkpoint.id}`}>
            <circle
              cx={cx}
              cy={cy}
              r={5}
              fill={passed ? 'rgba(123,181,138,0.32)' : 'rgba(255,217,140,0.25)'}
              stroke={passed ? '#7bb58a' : '#ffd98c'}
              strokeWidth={1}
            />
            <text
              x={cx}
              y={cy + 3}
              fill={passed ? '#7bb58a' : '#ffd98c'}
              textAnchor="middle"
              fontSize={checkpoint.id >= 10 ? '7' : '8'}
            >
              {checkpoint.id}
            </text>
          </g>
        );
      })}
      {showGoalMarker && (
        <>
          <line
            x1={goalCellCenterX}
            y1={goalCellCenterY}
            x2={goalMarkerX}
            y2={goalMarkerY}
            stroke={goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR}
            strokeWidth={1.1}
            strokeDasharray={goalActive ? undefined : '3 2'}
          />
          <circle
            cx={goalMarkerX}
            cy={goalMarkerY}
            r={6.5}
            fill="none"
            stroke={goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR}
            strokeWidth={1.2}
            strokeDasharray={goalActive ? undefined : '3 2'}
          />
          <text
            x={goalMarkerX}
            y={goalMarkerY + 4}
            fill={goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR}
            textAnchor="middle"
            fontSize="12"
          >
            G
          </text>
        </>
      )}
      <polygon points={playerTriangle} fill="#ffd98c" stroke="#ffe8be" strokeWidth={1} />
    </svg>
  );
}
