import React, { useEffect, useId, useMemo, useRef } from 'react';
import {
  createWireframeProjection,
  GLOW_COLOR,
  LINE_COLOR,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from '../game/WireframeProjection';
import { Checkpoint } from '../game/checkpointUtils';
import { Maze, PlayerState } from '../mazeUtils';

// MazeView3Dコンポーネントの入力プロパティ。
type MazeView3DProps = {
  // 投影元となる迷路データ。
  maze: Maze;
  // 投影元となるプレイヤー位置と向き。
  player: PlayerState;
  // 全チェックポイント座標。
  checkpoints: Checkpoint[];
  // 通過済みチェックポイント座標キー集合。
  passedCheckpointKeys: Set<string>;
  // ゴール有効化状態。
  goalActive: boolean;
};

/**
 * 1人称の3Dワイヤーフレームビューを描画する。
 * @param maze 迷路データ
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @returns 擬似透視を表現したSVGビュー
 */
export function MazeView3D({
  maze,
  player,
  checkpoints,
  passedCheckpointKeys,
  goalActive,
}: MazeView3DProps) {
  // SVGのクリップパスID。複数描画時のID衝突を避ける。
  const clipPathId = useId();
  // 迷路や位置が変わったときのみ投影データを再計算する。
  const projection = useMemo(
    () =>
      createWireframeProjection(
        maze,
        player,
        checkpoints,
        passedCheckpointKeys,
        goalActive
      ),
    [maze, player.x, player.y, player.dir, checkpoints, passedCheckpointKeys, goalActive]
  );
  // 深度ごとに重なり順を統一する描画要素。
  const layeredPrimitives = useMemo(() => {
    type Primitive =
      | {
          key: string;
          depth: number;
          kind: 'line';
          part: string;
          line: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            width: number;
          };
        }
      | { key: string; depth: number; kind: 'floor'; part: string; points: string; fill: string }
      | { key: string; depth: number; kind: 'face'; part: string; points: string; fill: string };

    const primitives: Primitive[] = [
      ...projection.lines.map((line, index) => ({
        key: `line-${index}`,
        depth: line.depth,
        kind: 'line' as const,
        part: line.part,
        line: line,
      })),
      ...projection.floorPatches.map((patch, index) => ({
        key: `floor-${index}`,
        depth: patch.depth,
        kind: 'floor' as const,
        part: patch.part,
        points: patch.points,
        fill: patch.fill,
      })),
      ...projection.faces.map((face, index) => ({
        key: `face-${index}`,
        depth: face.depth,
        kind: 'face' as const,
        part: face.part,
        points: face.points,
        fill: face.fill,
      })),
    ];
    const kindOrder: Record<Primitive['kind'], number> = {
      line: 0,
      floor: 1,
      face: 2,
    };
    // 同一depthでは側面壁を最前面にするための判定。
    const isSideWallPart = (part: string) => part.includes('-side-wall-');

    // 奥→手前の順で描画し、同深度では「線→床塗り→壁塗り」、
    // さらに側面壁だけは同深度の最上位へ押し上げる。
    return primitives.sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      const sideWallBiasA = isSideWallPart(a.part) ? 1 : 0;
      const sideWallBiasB = isSideWallPart(b.part) ? 1 : 0;
      if (sideWallBiasA !== sideWallBiasB) return sideWallBiasA - sideWallBiasB;
      return kindOrder[a.kind] - kindOrder[b.kind];
    });
  }, [projection.lines, projection.floorPatches, projection.faces]);
  // 同一内容のデバッグログを連続出力しないための前回スナップショット。
  const lastDebugSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    // 描画データの内訳を可視化するための開発用ログ情報を作る。
    const { lines, faces, wallJudgements } = projection;
    const currentCell = maze[player.y]?.[player.x];
    const debugLines = lines.map((line) => ({
      part: line.part,
      depth: line.depth,
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
        <clipPath id={clipPathId} clipPathUnits="userSpaceOnUse">
          <rect x={0} y={0} width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} fill="url(#scanline)" />
      <g clipPath={`url(#${clipPathId})`}>
        {layeredPrimitives.map((primitive) =>
          primitive.kind === 'line' ? (
            <line
              key={primitive.key}
              x1={primitive.line.x1}
              y1={primitive.line.y1}
              x2={primitive.line.x2}
              y2={primitive.line.y2}
              stroke={LINE_COLOR}
              strokeWidth={primitive.line.width}
              strokeLinecap="round"
            />
          ) : (
            <polygon
              key={primitive.key}
              points={primitive.points}
              fill={primitive.fill}
            />
          )
        )}
        {projection.markers.map((marker, index) => (
          <g key={`marker-${index}`}>
            <rect
              x={marker.x - marker.size}
              y={marker.y - marker.size}
              width={marker.size * 2}
              height={marker.size * 2}
              fill="none"
              stroke={
                marker.label === 'G'
                  ? marker.goalActive
                    ? '#cbffd9'
                    : '#ff9f9f'
                  : marker.label === 'C'
                    ? marker.checkpointPassed
                      ? '#7bb58a'
                      : '#ffd98c'
                    : '#8ce6ff'
              }
              strokeDasharray={marker.label === 'G' && !marker.goalActive ? '3 2' : undefined}
              strokeWidth={1.2}
            />
            <text
              x={marker.x}
              y={marker.y + marker.size * 0.35}
              textAnchor="middle"
              fontSize={Math.max(9, marker.size * 1.05)}
              fontFamily='"Courier New", "Lucida Console", monospace'
              fill={
                marker.label === 'G'
                  ? marker.goalActive
                    ? '#cbffd9'
                    : '#ff9f9f'
                  : marker.label === 'C'
                    ? marker.checkpointPassed
                      ? '#7bb58a'
                      : '#ffd98c'
                    : '#8ce6ff'
              }
            >
              {marker.label === 'C' ? marker.checkpointNumber ?? 'C' : marker.label}
            </text>
          </g>
        ))}
      </g>
      <rect x={2} y={2} width={VIEWPORT_WIDTH - 4} height={VIEWPORT_HEIGHT - 4} fill="none" stroke={GLOW_COLOR} strokeOpacity={0.55} />
    </svg>
  );
}
