import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';
import {
  ENABLE_WALL_DEBUG_LOG,
  CAMERA_MOVE_DURATION_MS,
  GOAL,
  GOAL_ACTIVE_COLOR,
  GOAL_ACTIVE_FLOOR_COLOR,
  GOAL_INACTIVE_COLOR,
  GOAL_INACTIVE_FLOOR_COLOR,
  GOAL_PROMPT_TEXT_COLOR,
  START,
} from '../game/constants';
import { GLOW_COLOR, LINE_COLOR, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../game/WireframeProjection';
import { Maze, PlayerState } from '../mazeUtils';

// ゴール解放メッセージの点滅周期（秒）。小さいほど点滅が速くなる。
const GOAL_PROMPT_BLINK_DURATION_SEC = 0.9;
// 未解放ゴール警告専用の点滅周期（秒）。通常より短くして注意喚起を強める。
const GOAL_LOCKED_WARNING_BLINK_DURATION_SEC = 0.35;
// ゴール未解放時にゴール通過警告を表示する時間（ミリ秒）。
const GOAL_LOCKED_WARNING_DURATION_MS = 3000;

// 1セルのワールドサイズ。迷路全体スケールに直結する。
const WORLD_CELL_SIZE = 1;
// 壁の高さ。値を増やすと圧迫感が増える。
const WORLD_WALL_HEIGHT = 1.12;
// 壁の厚み。薄くしすぎるとカメラ接近時の見えが不安定になる。
const WORLD_WALL_THICKNESS = 0.08;
// 床面の高さ。0を基準に全オブジェクトを配置する。
const WORLD_FLOOR_Y = 0;
// 床面をわずかに持ち上げる量。Z-fightingを避けるために使う。
const WORLD_FLOOR_ELEVATION = 0.002;
// 視点の高さ。壁高さの半分に固定し、通路中央目線を維持する。
const CAMERA_EYE_HEIGHT = WORLD_WALL_HEIGHT / 2;
// 視点の俯き角（ラジアン）。0で地面と平行な正面視線になる。
const CAMERA_PITCH_RAD = 0;
// カメラ後退量。値を増やすほど視点が手前に引かれる。
const CAMERA_BACK_OFFSET = 0.48;
// パースカメラの視野角（度）。広いほど周辺視野が広がる。
const CAMERA_FOV_DEG = 74;
// パースカメラのニアクリップ。小さいほど手前を切り落としにくい。
const CAMERA_NEAR = 0.02;
// パースカメラのファークリップ。小さいほど遠景描画を抑えられる。
const CAMERA_FAR = 35;
// フォグ開始距離。遠景フェード開始位置を制御する。
const CAMERA_FOG_NEAR = 1.6;
// フォグ終了距離。終了距離以遠は背景色へ近づく。
const CAMERA_FOG_FAR = 8.2;

// 壁メッシュの基準塗り色。迷路全体のトーンを決める。
const WALL_FILL_COLOR = '#0b2117';
// 壁線分の線色。ワイヤーフレーム感を決める。
const WALL_EDGE_COLOR = LINE_COLOR;
// 壁接続柱の太さ。壁厚との比率で調整して隙間を埋める。
const WALL_PILLAR_SIZE = WORLD_WALL_THICKNESS * 1.8;
// 円柱柱の分割数。増やすほど円に近づくが描画コストは上がる。
const WALL_PILLAR_RADIAL_SEGMENTS = 16;
// 柱テクスチャの横解像度。低くすると列方向が均一になり継ぎ目が目立ちにくい。
const WALL_PILLAR_TEXTURE_WIDTH = 8;
// 柱テクスチャの縦解像度。高くすると横帯の密度を上げられる。
const WALL_PILLAR_TEXTURE_HEIGHT = 128;
// 柱を立てる最小接続本数。2以上で「壁と壁の間」とみなす。
const WALL_PILLAR_MIN_CONNECTION_COUNT = 2;
// 通常床の色。暗くしすぎると床ハイライトが見えづらくなる。
const FLOOR_BASE_COLOR = '#05130d';
// 通常床の透明度。低いほど床が暗く沈む。
const FLOOR_BASE_OPACITY = 0.74;

// マーカー柱の半径。大きいほど見つけやすくなる。
const MARKER_RADIUS = 0.13;
// マーカー柱の高さ。高くすると遠くから認識しやすくなる。
const MARKER_HEIGHT = 0.24;

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

// カメラ補間で扱う姿勢値（平面位置+方位）。
type CameraPose = {
  x: number;
  z: number;
  yaw: number;
};

// 平面方向ベクトル（XZ）。
type XZVector = {
  x: number;
  z: number;
};

// 迷路壁向きの識別子。
type WallDirection = 'N' | 'E' | 'S' | 'W';

// 壁端点の接続カウント情報。
type WallEndpointCount = {
  x: number;
  z: number;
  count: number;
};

// 柱テクスチャのキャッシュ。再生成を避けて描画更新時の負荷を抑える。
let wallPillarTextureCache: THREE.CanvasTexture | null = null;

/**
 * セルX座標をワールドXへ変換する。
 * @param cellX 迷路セルのX座標
 * @returns セル中心のワールドX座標
 */
const toWorldX = (cellX: number): number => (cellX + 0.5) * WORLD_CELL_SIZE;

/**
 * セルY座標をワールドZへ変換する。
 * @param cellY 迷路セルのY座標
 * @returns セル中心のワールドZ座標
 */
const toWorldZ = (cellY: number): number => (cellY + 0.5) * WORLD_CELL_SIZE;

/**
 * プレイヤー方角をThree.jsのY回転角へ変換する。
 * @param dir 方角コード（N/E/S/W）
 * @returns カメラのyaw角（ラジアン）
 */
const toCameraYaw = (dir: PlayerState['dir']): number => {
  if (dir === 'N') return 0;
  if (dir === 'E') return -Math.PI / 2;
  if (dir === 'S') return Math.PI;
  return Math.PI / 2;
};

/**
 * プレイヤー向きの前方ベクトルを返す。
 * @param dir 方角コード（N/E/S/W）
 * @returns XZ平面の前方単位ベクトル
 */
const toForwardVector = (dir: PlayerState['dir']): XZVector => {
  if (dir === 'N') return { x: 0, z: -1 };
  if (dir === 'E') return { x: 1, z: 0 };
  if (dir === 'S') return { x: 0, z: 1 };
  return { x: -1, z: 0 };
};

/**
 * 方角つきプレイヤー状態をカメラ姿勢へ変換する。
 * @param player プレイヤー座標と向き
 * @returns カメラ配置に使う姿勢値
 */
const toCameraPose = (player: PlayerState): CameraPose => ({
  x: toWorldX(player.x) - toForwardVector(player.dir).x * CAMERA_BACK_OFFSET,
  z: toWorldZ(player.y) - toForwardVector(player.dir).z * CAMERA_BACK_OFFSET,
  yaw: toCameraYaw(player.dir),
});

/**
 * 角度を -PI..PI の範囲へ正規化する。
 * @param angle 正規化前の角度（ラジアン）
 * @returns 正規化後角度
 */
const normalizeAngle = (angle: number): number => {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
};

/**
 * fromからtoへ最短回転で到達する角度差を返す。
 * @param from 開始角度（ラジアン）
 * @param to 目標角度（ラジアン）
 * @returns 最短角度差（ラジアン）
 */
const getShortestAngleDelta = (from: number, to: number): number =>
  normalizeAngle(to - from);

/**
 * イージング付き補間係数を返す。
 * @param t 0..1 の時間進捗
 * @returns 0..1 のイージング済み係数
 */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * CSSカラー文字列をThree.js用の色+透明度へ変換する。
 * @param color CSSカラー（`#rrggbb` / `rgb(...)` / `rgba(...)`）
 * @returns Three.js描画で使う色情報
 */
const toThreeColorInfo = (
  color: string
): { color: THREE.ColorRepresentation; opacity: number } => {
  const rgbaMatch =
    color.match(
      /^rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/i
    ) ??
    color.match(/^rgb\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/i);

  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const alpha = rgbaMatch[4] ? Number(rgbaMatch[4]) : 1;
    return {
      color: new THREE.Color(r / 255, g / 255, b / 255),
      opacity: Number.isFinite(alpha) ? alpha : 1,
    };
  }

  const threeColor = new THREE.Color();
  threeColor.setStyle(color);
  return { color: threeColor, opacity: 1 };
};

/**
 * セル向きごとの壁をこのセル側から描くべきか判定する。
 * @param x セルX座標
 * @param y セルY座標
 * @param width 迷路幅
 * @param height 迷路高さ
 * @param dir 壁向き
 * @returns 描画担当ならtrue
 */
const shouldDrawWallFromCell = (
  x: number,
  y: number,
  width: number,
  height: number,
  dir: WallDirection
): boolean => {
  // 内部壁の重複描画を防ぐため、N/Wは常に担当し、E/Sは外周セルのみ担当する。
  if (dir === 'N' || dir === 'W') return true;
  if (dir === 'E') return x === width - 1;
  return y === height - 1;
};

/**
 * 円柱柱へ貼るシームレステクスチャを生成する。
 * @returns 生成したCanvasTexture
 */
const createWallPillarTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = WALL_PILLAR_TEXTURE_WIDTH;
  canvas.height = WALL_PILLAR_TEXTURE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    const fallbackTexture = new THREE.CanvasTexture(canvas);
    fallbackTexture.colorSpace = THREE.SRGBColorSpace;
    return fallbackTexture;
  }

  const gradient = context.createLinearGradient(0, 0, 0, WALL_PILLAR_TEXTURE_HEIGHT);
  gradient.addColorStop(0, '#8db89a');
  gradient.addColorStop(0.5, '#7aa58a');
  gradient.addColorStop(1, '#6f977f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WALL_PILLAR_TEXTURE_WIDTH, WALL_PILLAR_TEXTURE_HEIGHT);

  // 列方向は均一色のまま、横帯だけを重ねて円周継ぎ目の縦線を目立たせない。
  for (let y = 0; y < WALL_PILLAR_TEXTURE_HEIGHT; y += 8) {
    context.fillStyle = y % 16 === 0 ? 'rgba(18, 32, 24, 0.18)' : 'rgba(224, 255, 232, 0.06)';
    context.fillRect(0, y, WALL_PILLAR_TEXTURE_WIDTH, 1);
  }

  for (let y = 0; y < WALL_PILLAR_TEXTURE_HEIGHT; y += 2) {
    const alpha = 0.015 + Math.random() * 0.02;
    context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    context.fillRect(0, y, WALL_PILLAR_TEXTURE_WIDTH, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

/**
 * 円柱柱テクスチャを取得する（未生成なら生成してキャッシュする）。
 * @returns 柱描画に使うCanvasTexture
 */
const getWallPillarTexture = (): THREE.CanvasTexture => {
  if (!wallPillarTextureCache) {
    wallPillarTextureCache = createWallPillarTexture();
  }
  return wallPillarTextureCache;
};

/**
 * 壁端点の座標キーを生成する。
 * @param x 端点のグリッドX
 * @param z 端点のグリッドZ
 * @returns マップキー文字列
 */
const toWallEndpointKey = (x: number, z: number): string => `${x}:${z}`;

/**
 * 指定端点の接続本数を1つ増やす。
 * @param endpointCountMap 壁端点カウントマップ
 * @param x 端点のグリッドX
 * @param z 端点のグリッドZ
 */
const incrementWallEndpointCount = (
  endpointCountMap: Map<string, WallEndpointCount>,
  x: number,
  z: number
) => {
  const key = toWallEndpointKey(x, z);
  const existing = endpointCountMap.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  endpointCountMap.set(key, { x, z, count: 1 });
};

/**
 * 壁セグメント両端の接続本数をカウントする。
 * @param endpointCountMap 壁端点カウントマップ
 * @param cellX 壁を持つセルX
 * @param cellY 壁を持つセルY
 * @param dir 壁向き
 */
const registerWallEndpoints = (
  endpointCountMap: Map<string, WallEndpointCount>,
  cellX: number,
  cellY: number,
  dir: WallDirection
) => {
  if (dir === 'N') {
    incrementWallEndpointCount(endpointCountMap, cellX, cellY);
    incrementWallEndpointCount(endpointCountMap, cellX + 1, cellY);
    return;
  }
  if (dir === 'S') {
    incrementWallEndpointCount(endpointCountMap, cellX, cellY + 1);
    incrementWallEndpointCount(endpointCountMap, cellX + 1, cellY + 1);
    return;
  }
  if (dir === 'W') {
    incrementWallEndpointCount(endpointCountMap, cellX, cellY);
    incrementWallEndpointCount(endpointCountMap, cellX, cellY + 1);
    return;
  }
  incrementWallEndpointCount(endpointCountMap, cellX + 1, cellY);
  incrementWallEndpointCount(endpointCountMap, cellX + 1, cellY + 1);
};

/**
 * オブジェクト配下のジオメトリ/マテリアルを破棄する。
 * @param root 破棄対象ルート
 */
const disposeObject3D = (root: THREE.Object3D) => {
  root.traverse((child) => {
    const meshLike = child as THREE.Mesh;
    if (meshLike.geometry) {
      meshLike.geometry.dispose();
    }
    if (Array.isArray(meshLike.material)) {
      meshLike.material.forEach((material) => material.dispose());
    } else if (meshLike.material) {
      meshLike.material.dispose();
    }
  });
};

/**
 * グループ内オブジェクトを全削除してGPU資源を解放する。
 * @param group クリア対象のグループ
 */
const clearGroup = (group: THREE.Group) => {
  const targets = [...group.children];
  targets.forEach((child) => {
    group.remove(child);
    disposeObject3D(child);
  });
};

/**
 * 床色をセル属性から決定する。
 * @param cellX セルX座標
 * @param cellY セルY座標
 * @param checkpointKeySet チェックポイント存在キー集合
 * @param passedCheckpointKeys 通過済みチェックポイントキー集合
 * @param goalActive ゴール有効化状態
 * @returns 床色文字列
 */
const resolveFloorColor = (
  cellX: number,
  cellY: number,
  checkpointKeySet: Set<string>,
  passedCheckpointKeys: Set<string>,
  goalActive: boolean
): string => {
  if (cellX === START.x && cellY === START.y) return 'rgba(140, 230, 255, 0.24)';
  if (cellX === GOAL.x && cellY === GOAL.y) {
    return goalActive ? GOAL_ACTIVE_FLOOR_COLOR : GOAL_INACTIVE_FLOOR_COLOR;
  }
  const key = toCheckpointKey(cellX, cellY);
  if (!checkpointKeySet.has(key)) return FLOOR_BASE_COLOR;
  return passedCheckpointKeys.has(key)
    ? 'rgba(123, 181, 138, 0.24)'
    : 'rgba(255, 217, 140, 0.24)';
};

/**
 * マーカー柱の色をセル属性から決定する。
 * @param cellX セルX座標
 * @param cellY セルY座標
 * @param checkpointKeySet チェックポイント存在キー集合
 * @param passedCheckpointKeys 通過済みチェックポイントキー集合
 * @param goalActive ゴール有効化状態
 * @returns マーカー色。不要ならnull
 */
const resolveMarkerColor = (
  cellX: number,
  cellY: number,
  checkpointKeySet: Set<string>,
  passedCheckpointKeys: Set<string>,
  goalActive: boolean
): string | null => {
  if (cellX === START.x && cellY === START.y) return '#8ce6ff';
  if (cellX === GOAL.x && cellY === GOAL.y) return goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR;
  const key = toCheckpointKey(cellX, cellY);
  if (!checkpointKeySet.has(key)) return null;
  return passedCheckpointKeys.has(key) ? '#7bb58a' : '#ffd98c';
};

/**
 * 3D迷路ジオメトリ（床・壁・マーカー柱）を再構築する。
 * @param root 描画先グループ
 * @param maze 迷路データ
 * @param checkpoints チェックポイント配列
 * @param passedCheckpointKeys 通過済みキー集合
 * @param goalActive ゴール有効化状態
 */
const buildMazeWorld = (
  root: THREE.Group,
  maze: Maze,
  checkpoints: Checkpoint[],
  passedCheckpointKeys: Set<string>,
  goalActive: boolean
) => {
  const height = maze.length;
  const width = maze[0]?.length ?? 0;
  const wallEndpointCountMap = new Map<string, WallEndpointCount>();
  const checkpointKeySet = new Set(
    checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y))
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = maze[y][x];
      const worldCenterX = toWorldX(x);
      const worldCenterZ = toWorldZ(y);

      const floorColor = resolveFloorColor(
        x,
        y,
        checkpointKeySet,
        passedCheckpointKeys,
        goalActive
      );
      const floorColorInfo = toThreeColorInfo(floorColor);
      const floorMaterial = new THREE.MeshBasicMaterial({
        color: floorColorInfo.color,
        transparent: floorColor === FLOOR_BASE_COLOR ? FLOOR_BASE_OPACITY < 1 : floorColorInfo.opacity < 1,
        opacity: floorColor === FLOOR_BASE_COLOR ? FLOOR_BASE_OPACITY : floorColorInfo.opacity,
        side: THREE.DoubleSide,
      });
      const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_CELL_SIZE, WORLD_CELL_SIZE),
        floorMaterial
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(worldCenterX, WORLD_FLOOR_Y + WORLD_FLOOR_ELEVATION, worldCenterZ);
      floorMesh.userData.kind = 'floor';
      root.add(floorMesh);

      const markerColor = resolveMarkerColor(
        x,
        y,
        checkpointKeySet,
        passedCheckpointKeys,
        goalActive
      );
      if (markerColor) {
        const markerBody = new THREE.Mesh(
          new THREE.CylinderGeometry(MARKER_RADIUS, MARKER_RADIUS, MARKER_HEIGHT, 12),
          new THREE.MeshBasicMaterial({ color: markerColor })
        );
        markerBody.position.set(
          worldCenterX,
          WORLD_FLOOR_Y + MARKER_HEIGHT / 2 + WORLD_FLOOR_ELEVATION,
          worldCenterZ
        );
        markerBody.userData.kind = 'marker';
        root.add(markerBody);

        const markerEdge = new THREE.LineSegments(
          new THREE.EdgesGeometry(markerBody.geometry),
          new THREE.LineBasicMaterial({ color: WALL_EDGE_COLOR })
        );
        markerEdge.position.copy(markerBody.position);
        markerEdge.userData.kind = 'marker-edge';
        root.add(markerEdge);
      }

      (['N', 'E', 'S', 'W'] as WallDirection[]).forEach((dir) => {
        if (!cell.walls[dir]) return;
        if (!shouldDrawWallFromCell(x, y, width, height, dir)) return;
        registerWallEndpoints(wallEndpointCountMap, x, y, dir);

        const isHorizontal = dir === 'N' || dir === 'S';
        const wallGeometry = new THREE.BoxGeometry(
          isHorizontal ? WORLD_CELL_SIZE : WORLD_WALL_THICKNESS,
          WORLD_WALL_HEIGHT,
          isHorizontal ? WORLD_WALL_THICKNESS : WORLD_CELL_SIZE
        );
        const wallMesh = new THREE.Mesh(
          wallGeometry,
          new THREE.MeshBasicMaterial({ color: WALL_FILL_COLOR })
        );

        let wallX = worldCenterX;
        let wallZ = worldCenterZ;
        if (dir === 'N') wallZ = y * WORLD_CELL_SIZE;
        if (dir === 'S') wallZ = (y + 1) * WORLD_CELL_SIZE;
        if (dir === 'W') wallX = x * WORLD_CELL_SIZE;
        if (dir === 'E') wallX = (x + 1) * WORLD_CELL_SIZE;
        wallMesh.position.set(wallX, WORLD_WALL_HEIGHT / 2 + WORLD_FLOOR_Y, wallZ);
        wallMesh.userData.kind = 'wall';
        root.add(wallMesh);

        const wallEdge = new THREE.LineSegments(
          new THREE.EdgesGeometry(wallGeometry),
          new THREE.LineBasicMaterial({ color: WALL_EDGE_COLOR })
        );
        wallEdge.position.copy(wallMesh.position);
        wallEdge.userData.kind = 'wall-edge';
        root.add(wallEdge);
      });
    }
  }

  wallEndpointCountMap.forEach((endpoint) => {
    if (endpoint.count < WALL_PILLAR_MIN_CONNECTION_COUNT) return;
    const pillarRadius = WALL_PILLAR_SIZE / 2;
    const pillarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        pillarRadius,
        pillarRadius,
        WORLD_WALL_HEIGHT,
        WALL_PILLAR_RADIAL_SEGMENTS
      ),
      new THREE.MeshBasicMaterial({
        color: '#d8f3df',
        map: getWallPillarTexture(),
      })
    );
    pillarMesh.position.set(
      endpoint.x * WORLD_CELL_SIZE,
      WORLD_WALL_HEIGHT / 2 + WORLD_FLOOR_Y,
      endpoint.z * WORLD_CELL_SIZE
    );
    pillarMesh.userData.kind = 'wall-pillar';
    root.add(pillarMesh);
  });
};

/**
 * 1人称の3D迷路ビューをThree.jsで描画する。
 * @param maze 迷路データ
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @param finished クリア済み状態
 * @returns Three.js 3Dビューと通知UI
 */
export function MazeView3D({
  maze,
  player,
  checkpoints,
  passedCheckpointKeys,
  goalActive,
  finished,
}: MazeView3DProps) {
  // WebGL描画先のcanvas要素参照。
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Three.jsレンダラー参照。
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Three.jsシーン参照。
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Three.jsカメラ参照。
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  // 迷路メッシュ群を保持するルートグループ。
  const worldGroupRef = useRef<THREE.Group | null>(null);
  // カメラ姿勢の現在値。
  const cameraPoseRef = useRef<CameraPose>(toCameraPose(player));
  // カメラ補間アニメーションのrequestAnimationFrame ID。
  const cameraAnimationFrameRef = useRef<number | null>(null);

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
  // カメラ補間判定用の前回プレイヤー状態。
  const previousCameraPlayerRef = useRef({ x: player.x, y: player.y, dir: player.dir });
  // 同一内容のデバッグログ連続出力を抑制するための前回スナップショット。
  const lastDebugSnapshotRef = useRef('');

  // チェックポイントキー一覧（ログ用途）。
  const checkpointKeys = useMemo(
    () => checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y)),
    [checkpoints]
  );

  /**
   * 現在シーンを1フレーム描画する。
   */
  const renderScene = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  };

  /**
   * カメラ姿勢をThree.jsカメラへ反映する。
   * @param pose 適用するカメラ姿勢
   */
  const applyCameraPose = (pose: CameraPose) => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(pose.x, CAMERA_EYE_HEIGHT, pose.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.x = CAMERA_PITCH_RAD;
    camera.rotation.y = pose.yaw;
    camera.rotation.z = 0;
    cameraPoseRef.current = pose;
  };

  /**
   * 実行中のカメラ補間アニメーションを停止する。
   */
  const stopCameraAnimation = () => {
    if (cameraAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraAnimationFrameRef.current);
      cameraAnimationFrameRef.current = null;
    }
  };

  /**
   * カメラを現在姿勢から目標姿勢へdurationで補間する。
   * @param targetPose 目標カメラ姿勢
   * @param durationMs 補間時間（ミリ秒）
   */
  const animateCameraTo = (targetPose: CameraPose, durationMs: number) => {
    stopCameraAnimation();

    const startPose = cameraPoseRef.current;
    const yawDelta = getShortestAngleDelta(startPose.yaw, targetPose.yaw);
    const animationStart = performance.now();

    const tick = (now: number) => {
      const elapsed = now - animationStart;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeInOutCubic(t);

      const pose: CameraPose = {
        x: THREE.MathUtils.lerp(startPose.x, targetPose.x, eased),
        z: THREE.MathUtils.lerp(startPose.z, targetPose.z, eased),
        yaw: startPose.yaw + yawDelta * eased,
      };

      applyCameraPose(pose);
      renderScene();

      if (t >= 1) {
        cameraAnimationFrameRef.current = null;
        return;
      }
      cameraAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    cameraAnimationFrameRef.current = window.requestAnimationFrame(tick);
  };

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
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, true);
    renderer.setClearColor('#020503', 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#020503', CAMERA_FOG_NEAR, CAMERA_FOG_FAR);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV_DEG,
      VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
      CAMERA_NEAR,
      CAMERA_FAR
    );

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    worldGroupRef.current = worldGroup;

    const initialPose = toCameraPose(player);
    applyCameraPose(initialPose);
    renderScene();

    return () => {
      stopCameraAnimation();
      if (goalLockedWarningTimerRef.current !== null) {
        window.clearTimeout(goalLockedWarningTimerRef.current);
      }
      clearGroup(worldGroup);
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      worldGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worldGroup = worldGroupRef.current;
    if (!worldGroup) return;
    clearGroup(worldGroup);
    buildMazeWorld(worldGroup, maze, checkpoints, passedCheckpointKeys, goalActive);
    renderScene();
  }, [maze, checkpoints, passedCheckpointKeys, goalActive]);

  useEffect(() => {
    const previous = previousCameraPlayerRef.current;
    previousCameraPlayerRef.current = { x: player.x, y: player.y, dir: player.dir };

    const movedOrTurned =
      previous.x !== player.x || previous.y !== player.y || previous.dir !== player.dir;
    if (!movedOrTurned) return;

    animateCameraTo(toCameraPose(player), CAMERA_MOVE_DURATION_MS);
  }, [player.x, player.y, player.dir]);

  useEffect(() => {
    if (!import.meta.env.DEV || !ENABLE_WALL_DEBUG_LOG) return;

    const worldGroup = worldGroupRef.current;
    const camera = cameraRef.current;
    if (!worldGroup || !camera) return;

    const kindCounts = worldGroup.children.reduce<Record<string, number>>((acc, child) => {
      const kind = (child.userData.kind as string | undefined) ?? 'unknown';
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});

    const debugPayload = {
      player,
      camera: {
        x: Number(camera.position.x.toFixed(3)),
        y: Number(camera.position.y.toFixed(3)),
        z: Number(camera.position.z.toFixed(3)),
        yaw: Number(camera.rotation.y.toFixed(3)),
      },
      checkpointKeys,
      passedCheckpointCount: passedCheckpointKeys.size,
      objectCount: worldGroup.children.length,
      kindCounts,
    };

    const snapshot = JSON.stringify(debugPayload);
    // 同一状態ならログ出力を抑制してノイズを減らす。
    if (lastDebugSnapshotRef.current === snapshot) return;
    lastDebugSnapshotRef.current = snapshot;
    console.log('[MazeView3D] three-world-debug', debugPayload);
  }, [player, checkpointKeys, passedCheckpointKeys]);

  return (
    <div
      style={{
        position: 'relative',
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        background: '#020503',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <style>
        {`@keyframes maze-view-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}
      </style>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        style={{
          position: 'absolute',
          inset: 0,
          width: `${VIEWPORT_WIDTH}px`,
          height: `${VIEWPORT_HEIGHT}px`,
          display: 'block',
        }}
      />
      {(showGoalPrompt || showGoalLockedWarning || finished) && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 30,
            transform: 'translateX(-50%)',
            fontSize: 15,
            fontFamily: '"Courier New", "Lucida Console", monospace',
            color: GOAL_PROMPT_TEXT_COLOR,
            animationName: 'maze-view-blink',
            animationDuration: `${
              showGoalLockedWarning
                ? GOAL_LOCKED_WARNING_BLINK_DURATION_SEC
                : GOAL_PROMPT_BLINK_DURATION_SEC
            }s`,
            animationIterationCount: 'infinite',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(203, 255, 217, 0.45)',
          }}
        >
          {showGoalLockedWarning ? 'チェックポイントを回収せよ！' : finished ? 'GOAL！' : 'ゴールに向かえ！'}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 2,
          border: `1px solid ${GLOW_COLOR}`,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
