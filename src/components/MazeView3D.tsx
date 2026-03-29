import React, { useEffect, useMemo, useRef } from 'react';
import {
  createWireframeProjection,
  GLOW_COLOR,
  LINE_COLOR,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from '../game/WireframeProjection';
import { Maze, PlayerState } from '../mazeUtils';

// MazeView3Dコンポーネントの入力プロパティ。
type MazeView3DProps = {
  // 投影元となる迷路データ。
  maze: Maze;
  // 投影元となるプレイヤー位置と向き。
  player: PlayerState;
};

/**
 * 1人称の3Dワイヤーフレームビューを描画する。
 * @param maze 迷路データ
 * @param player プレイヤー位置と向き
 * @returns 擬似透視を表現したSVGビュー
 */
export function MazeView3D({ maze, player }: MazeView3DProps) {
  // 迷路や位置が変わったときのみ投影データを再計算する。
  const projection = useMemo(
    () => createWireframeProjection(maze, player),
    [maze, player.x, player.y, player.dir]
  );
  // 同一内容のデバッグログを連続出力しないための前回スナップショット。
  const lastDebugSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    // 描画データの内訳を可視化するための開発用ログ情報を作る。
    const { lines, faces, wallJudgements } = projection;
    const currentCell = maze[player.y]?.[player.x];
    const debugLines = lines.map((line) => ({
      part: line.part,
      x1: Number(line.x1.toFixed(1)),
      y1: Number(line.y1.toFixed(1)),
      x2: Number(line.x2.toFixed(1)),
      y2: Number(line.y2.toFixed(1)),
      width: line.width,
    }));
    const partCounts = debugLines.reduce<Record<string, number>>((acc, line) => {
      acc[line.part] = (acc[line.part] || 0) + 1;
      return acc;
    }, {});
    const facePartCounts = faces.reduce<Record<string, number>>((acc, face) => {
      acc[face.part] = (acc[face.part] || 0) + 1;
      return acc;
    }, {});
    const debugPayload = {
      player,
      currentCellWalls: currentCell?.walls,
      wallJudgements,
      faceCount: faces.length,
      facePartCounts,
      lineCount: debugLines.length,
      partCounts,
      lines: debugLines,
    };
    const snapshot = JSON.stringify({
      player,
      currentCellWalls: currentCell?.walls,
      wallJudgements,
      facePartCounts,
      partCounts,
    });
    // 同じ状態ならログ出力を抑制してノイズを減らす。
    if (lastDebugSnapshotRef.current === snapshot) return;
    lastDebugSnapshotRef.current = snapshot;
    console.log('[MazeView3D] wall-debug', debugPayload);
  }, [maze, player.x, player.y, player.dir, projection]);

  return (
    <svg width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} style={{ background: '#020503', borderRadius: 4, display: 'block' }}>
      <defs>
        <pattern id="scanline" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#020503" />
          <line x1="0" y1="0.5" x2="4" y2="0.5" stroke="#06180d" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} fill="url(#scanline)" />
      {[...projection.faces]
        .sort((a, b) => b.depth - a.depth)
        .map((face, index) => <polygon key={`face-${index}`} points={face.points} fill={face.fill} />)}
      <rect x={2} y={2} width={VIEWPORT_WIDTH - 4} height={VIEWPORT_HEIGHT - 4} fill="none" stroke={GLOW_COLOR} strokeOpacity={0.55} />
      {projection.lines.map((line, index) => (
        <line
          key={index}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={LINE_COLOR}
          strokeWidth={line.width}
          strokeLinecap="round"
        />
      ))}
      {projection.markers.map((marker, index) => (
        <g key={`marker-${index}`}>
          <rect
            x={marker.x - marker.size}
            y={marker.y - marker.size}
            width={marker.size * 2}
            height={marker.size * 2}
            fill="none"
            stroke={marker.label === 'G' ? '#cbffd9' : '#8ce6ff'}
            strokeWidth={1.2}
          />
          <text
            x={marker.x}
            y={marker.y + marker.size * 0.35}
            textAnchor="middle"
            fontSize={Math.max(10, marker.size * 1.1)}
            fontFamily='"Courier New", "Lucida Console", monospace'
            fill={marker.label === 'G' ? '#cbffd9' : '#8ce6ff'}
          >
            {marker.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
