import React from 'react';
import { GOAL, START } from '../game/constants';
import { Maze, PlayerState } from '../mazeUtils';

// HelpMapコンポーネントの入力プロパティ。
type HelpMapProps = {
  // 表示対象の迷路データ。
  maze: Maze;
  // プレイヤー現在位置と向き。
  player: PlayerState;
};

/**
 * ヘルプ用の2D俯瞰マップを描画する。
 * @param maze 迷路全体データ
 * @param player プレイヤー位置と向き
 * @returns 壁線・S/G・プレイヤー向きを描いたSVG
 */
export function HelpMap({ maze, player }: HelpMapProps) {
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

  return (
    <svg width={width} height={height} style={{ background: '#031109', border: '1px solid #58d47f' }}>
      <rect x={0} y={0} width={width} height={height} fill="#031109" />
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
        stroke="#cbffd9"
        strokeWidth={1.2}
      />
      <text
        x={pad + GOAL.x * cellSize + cellSize / 2}
        y={pad + GOAL.y * cellSize + cellSize / 2 + 4}
        fill="#cbffd9"
        textAnchor="middle"
        fontSize="12"
      >
        G
      </text>
      <polygon points={playerTriangle} fill="#ffd98c" stroke="#ffe8be" strokeWidth={1} />
    </svg>
  );
}
