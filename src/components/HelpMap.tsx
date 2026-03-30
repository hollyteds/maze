import React from 'react';
import { GOAL, START } from '../game/constants';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';
import { Maze, PlayerState } from '../mazeUtils';

// ゴール有効時の色。赤で到達目標を強調する。
const GOAL_ACTIVE_COLOR = '#ff5c5c';
// ゴール無効時の色。無彩色でロック状態を示す。
const GOAL_INACTIVE_COLOR = '#9a9a9a';
// ゴール有効時の床ハイライト色。
const GOAL_ACTIVE_FLOOR_COLOR = 'rgba(255, 92, 92, 0.24)';
// ゴール無効時の床ハイライト色。
const GOAL_INACTIVE_FLOOR_COLOR = 'rgba(154, 154, 154, 0.24)';

// HelpMapコンポーネントの入力プロパティ。
type HelpMapProps = {
  // 表示対象の迷路データ。
  maze: Maze;
  // プレイヤー現在位置と向き。
  player: PlayerState;
  // 全チェックポイント座標。
  checkpoints: Checkpoint[];
  // 通過済みチェックポイント座標キー集合。
  passedCheckpointKeys: Set<string>;
  // ゴールが有効化済みかどうか。
  goalActive: boolean;
};

/**
 * ヘルプ用の2D俯瞰マップを描画する。
 * @param maze 迷路全体データ
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @returns 壁線・S/G・プレイヤー向きを描いたSVG
 */
export function HelpMap({ maze, player, checkpoints, passedCheckpointKeys, goalActive }: HelpMapProps) {
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

  /**
   * セル属性に応じて床色を返す。
   * @param x セルX座標
   * @param y セルY座標
   * @returns 床塗り色。対象外セルはnull
   */
  const getCellFloorColor = (x: number, y: number): string | null => {
    if (x === START.x && y === START.y) return 'rgba(140, 230, 255, 0.24)';
    if (x === GOAL.x && y === GOAL.y) return goalActive ? GOAL_ACTIVE_FLOOR_COLOR : GOAL_INACTIVE_FLOOR_COLOR;
    const checkpoint = checkpointMap.get(toCheckpointKey(x, y));
    if (!checkpoint) return null;
    const passed = passedCheckpointKeys.has(toCheckpointKey(checkpoint.x, checkpoint.y));
    return passed ? 'rgba(123, 181, 138, 0.24)' : 'rgba(255, 217, 140, 0.24)';
  };

  return (
    <svg width={width} height={height} style={{ background: '#031109', border: '1px solid #58d47f' }}>
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
        row.flatMap((cell, x) => {
          const x0 = pad + x * cellSize;
          const y0 = pad + y * cellSize;
          const x1 = x0 + cellSize;
          const y1 = y0 + cellSize;
          return [
            cell.walls.N ? <line key={`n-${x}-${y}`} x1={x0} y1={y0} x2={x1} y2={y0} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
            cell.walls.E ? <line key={`e-${x}-${y}`} x1={x1} y1={y0} x2={x1} y2={y1} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
            cell.walls.S ? <line key={`s-${x}-${y}`} x1={x0} y1={y1} x2={x1} y2={y1} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
            cell.walls.W ? <line key={`w-${x}-${y}`} x1={x0} y1={y0} x2={x0} y2={y1} stroke="#8cf4aa" strokeWidth={1.1} /> : null,
          ];
        })
      )}
      {checkpoints.map((checkpoint) => {
        // 各チェックポイントの通過状態を座標キーで判定する。
        const passed = passedCheckpointKeys.has(toCheckpointKey(checkpoint.x, checkpoint.y));
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
      <rect
        x={pad + START.x * cellSize + 4}
        y={pad + START.y * cellSize + 4}
        width={cellSize - 8}
        height={cellSize - 8}
        fill="none"
        stroke="#8ce6ff"
        strokeWidth={1.2}
      />
      <text
        x={pad + START.x * cellSize + cellSize / 2}
        y={pad + START.y * cellSize + cellSize / 2 + 4}
        fill="#8ce6ff"
        textAnchor="middle"
        fontSize="12"
      >
        S
      </text>
      <rect
        x={pad + GOAL.x * cellSize + 4}
        y={pad + GOAL.y * cellSize + 4}
        width={cellSize - 8}
        height={cellSize - 8}
        fill="none"
        stroke={goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR}
        strokeDasharray={goalActive ? undefined : '3 2'}
        strokeWidth={1.2}
      />
      <text
        x={pad + GOAL.x * cellSize + cellSize / 2}
        y={pad + GOAL.y * cellSize + cellSize / 2 + 4}
        fill={goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR}
        textAnchor="middle"
        fontSize="12"
      >
        G
      </text>
      <polygon points={playerTriangle} fill="#ffd98c" stroke="#ffe8be" strokeWidth={1} />
    </svg>
  );
}
