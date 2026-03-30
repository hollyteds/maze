import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  createWireframeProjection,
  GLOW_COLOR,
  LINE_COLOR,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from '../game/WireframeProjection';
import { Checkpoint } from '../game/checkpointUtils';
import {
  ENABLE_WALL_DEBUG_LOG,
  GOAL,
  GOAL_ACTIVE_COLOR,
  GOAL_INACTIVE_COLOR,
  GOAL_PROMPT_TEXT_COLOR,
} from '../game/constants';
import { Maze, PlayerState } from '../mazeUtils';

// ゴール解放メッセージの点滅周期（秒）。小さいほど点滅が速くなる。
const GOAL_PROMPT_BLINK_DURATION_SEC = 0.9;
// 未解放ゴール警告専用の点滅周期（秒）。通常より短くして注意喚起を強める。
const GOAL_LOCKED_WARNING_BLINK_DURATION_SEC = 0.35;
// ゴール未解放時にゴール通過警告を表示する時間（ミリ秒）。
const GOAL_LOCKED_WARNING_DURATION_MS = 3000;

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
  // クリア済み状態。true のときは GOAL 表示に切り替える。
  finished: boolean;
};

/**
 * 1人称の3Dワイヤーフレームビューを描画する。
 * @param maze 迷路データ
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @param finished クリア済み状態
 * @returns 擬似透視を表現したSVGビュー
 */
export function MazeView3D({
  maze,
  player,
  checkpoints,
  passedCheckpointKeys,
  goalActive,
  finished,
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
  // ゴール解放メッセージの表示状態。
  const [showGoalPrompt, setShowGoalPrompt] = useState(false);
  // ゴール未解放で通過した際の警告表示状態。
  const [showGoalLockedWarning, setShowGoalLockedWarning] = useState(false);
  // ゴール有効化状態の前回値。false→true遷移を検出する。
  const previousGoalActiveRef = useRef(goalActive);
  // ゴール未解放通過警告の消去タイマーID。
  const goalLockedWarningTimerRef = useRef<number | null>(null);
  // 前フレーム位置。ゴールへの進入を検知する。
  const previousPlayerPosRef = useRef({ x: player.x, y: player.y });
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
      | { key: string; depth: number; kind: 'face'; part: string; points: string; fill: string }
      | {
          key: string;
          depth: number;
          kind: 'markerFrame';
          part: string;
          marker: (typeof projection.markers)[number];
        }
      | {
          key: string;
          depth: number;
          kind: 'markerText';
          part: string;
          marker: (typeof projection.markers)[number];
        };

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
      ...projection.markers.flatMap((marker, index) => [
        {
          key: `marker-frame-${index}`,
          depth: marker.depth,
          kind: 'markerFrame' as const,
          part: `marker-frame-${marker.label}`,
          marker,
        },
        {
          key: `marker-text-${index}`,
          depth: marker.depth,
          kind: 'markerText' as const,
          part: `marker-text-${marker.label}`,
          marker,
        },
      ]),
    ];
    const kindOrder: Record<Primitive['kind'], number> = {
      line: 0,
      floor: 1,
      face: 2,
      markerFrame: 3,
      markerText: 4,
    };
    // 同一depthでは側面壁を最前面にするための判定。
    const isSideWallPart = (part: string) => part.includes('-side-wall-');

    // 奥→手前の順で描画し、同深度では「線→床塗り→壁塗り」、
    // さらに側面壁だけは同深度の最上位へ押し上げる。
    return primitives.sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      const allowSideWallBiasA = a.kind === 'line' || a.kind === 'floor' || a.kind === 'face';
      const allowSideWallBiasB = b.kind === 'line' || b.kind === 'floor' || b.kind === 'face';
      if (allowSideWallBiasA && allowSideWallBiasB) {
        const sideWallBiasA = isSideWallPart(a.part) ? 1 : 0;
        const sideWallBiasB = isSideWallPart(b.part) ? 1 : 0;
        if (sideWallBiasA !== sideWallBiasB) return sideWallBiasA - sideWallBiasB;
      }
      return kindOrder[a.kind] - kindOrder[b.kind];
    });
  }, [projection.lines, projection.floorPatches, projection.faces, projection.markers]);
  // 同一内容のデバッグログを連続出力しないための前回スナップショット。
  const lastDebugSnapshotRef = useRef<string>('');

  useEffect(() => {
    const wasGoalActive = previousGoalActiveRef.current;
    previousGoalActiveRef.current = goalActive;
    // 新ゲーム開始などで未解放へ戻ったら表示をリセットする。
    if (!goalActive) {
      setShowGoalPrompt(false);
      return;
    }
    // チェックポイント達成でゴールが解放された瞬間のみ表示する。
    if (!wasGoalActive && goalActive && checkpoints.length > 0) {
      setShowGoalPrompt(true);
    }
    return;
  }, [goalActive, checkpoints.length]);

  useEffect(() => {
    const previousPos = previousPlayerPosRef.current;
    previousPlayerPosRef.current = { x: player.x, y: player.y };
    // 「未解放ゴールへの進入」時だけ警告を表示する。
    const enteredLockedGoal =
      !goalActive &&
      player.x === GOAL.x &&
      player.y === GOAL.y &&
      (previousPos.x !== GOAL.x || previousPos.y !== GOAL.y);
    if (!enteredLockedGoal) return;
    setShowGoalLockedWarning(true);
    if (goalLockedWarningTimerRef.current !== null) {
      window.clearTimeout(goalLockedWarningTimerRef.current);
    }
    goalLockedWarningTimerRef.current = window.setTimeout(() => {
      setShowGoalLockedWarning(false);
      goalLockedWarningTimerRef.current = null;
    }, GOAL_LOCKED_WARNING_DURATION_MS);
  }, [goalActive, player.x, player.y]);

  useEffect(() => {
    return () => {
      if (goalLockedWarningTimerRef.current !== null) {
        window.clearTimeout(goalLockedWarningTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !ENABLE_WALL_DEBUG_LOG) return;

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

  // 投影マーカー型の短縮名。色計算ヘルパーで使う。
  type ProjectionMarker = (typeof projection.markers)[number];

  /**
   * マーカー枠/文字の描画色をラベル別に返す。
   * @param marker 対象マーカー
   * @returns マーカーの表示色
   */
  const getMarkerColor = (marker: ProjectionMarker): string => {
    if (marker.label === 'G') {
      return marker.goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR;
    }
    if (marker.label === 'C') {
      return marker.checkpointPassed ? '#7bb58a' : '#ffd98c';
    }
    return '#8ce6ff';
  };

  /**
   * マーカー枠の塗り色をラベル別に返す。
   * @param marker 対象マーカー
   * @returns マーカー枠の塗り色
   */
  const getMarkerFrameFill = (marker: ProjectionMarker): string => {
    if (marker.label === 'S') return '#062218';
    if (marker.label === 'C') return marker.checkpointPassed ? '#1f3328' : '#3a2d14';
    return 'none';
  };

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
          ) : primitive.kind === 'markerFrame' ? (
            <rect
              key={primitive.key}
              x={primitive.marker.x - primitive.marker.size}
              y={primitive.marker.y - primitive.marker.size}
              width={primitive.marker.size * 2}
              height={primitive.marker.size * 2}
              fill={getMarkerFrameFill(primitive.marker)}
              stroke={getMarkerColor(primitive.marker)}
              strokeDasharray={
                primitive.marker.label === 'G' && !primitive.marker.goalActive ? '3 2' : undefined
              }
              strokeWidth={1.2}
            />
          ) : primitive.kind === 'markerText' ? (
            <text
              key={primitive.key}
              x={primitive.marker.x}
              y={primitive.marker.y + primitive.marker.size * 0.35}
              textAnchor="middle"
              fontSize={Math.max(9, primitive.marker.size * 1.05)}
              fontFamily='"Courier New", "Lucida Console", monospace'
              fill={getMarkerColor(primitive.marker)}
            >
              {primitive.marker.label === 'C'
                ? primitive.marker.checkpointNumber ?? 'C'
                : primitive.marker.label}
            </text>
          ) : (
            <polygon
              key={primitive.key}
              points={primitive.points}
              fill={primitive.fill}
            />
          )
        )}
      </g>
      {(showGoalPrompt || showGoalLockedWarning || finished) && (
        <text
          x={VIEWPORT_WIDTH / 2}
          y={30}
          textAnchor="middle"
          fontSize={15}
          fontFamily='"Courier New", "Lucida Console", monospace'
          fill={GOAL_PROMPT_TEXT_COLOR}
        >
          <animate
            attributeName="opacity"
            values="1;0.35;1"
            dur={`${showGoalLockedWarning ? GOAL_LOCKED_WARNING_BLINK_DURATION_SEC : GOAL_PROMPT_BLINK_DURATION_SEC}s`}
            repeatCount="indefinite"
          />
          {showGoalLockedWarning ? 'チェックポイントを回収せよ！' : finished ? 'GOAL！' : 'ゴールに向かえ！'}
        </text>
      )}
      <rect x={2} y={2} width={VIEWPORT_WIDTH - 4} height={VIEWPORT_HEIGHT - 4} fill="none" stroke={GLOW_COLOR} strokeOpacity={0.55} />
    </svg>
  );
}
