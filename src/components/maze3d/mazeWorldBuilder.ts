import * as THREE from 'three';
import { Checkpoint, toCheckpointKey } from '../../game/checkpointUtils';
import {
  CHECKPOINT_CLEARED_COLOR,
  CHECKPOINT_CLEARED_WALL_COLOR,
  CHECKPOINT_PENDING_COLOR,
  CHECKPOINT_PENDING_WALL_COLOR,
  FLOOR_BASE_COLOR,
  FLOOR_BASE_OPACITY,
  GOAL,
  GOAL_ACTIVE_COLOR,
  GOAL_ACTIVE_FLOOR_COLOR,
  GOAL_ACTIVE_WALL_COLOR,
  GOAL_INACTIVE_COLOR,
  GOAL_INACTIVE_FLOOR_COLOR,
  GOAL_INACTIVE_WALL_COLOR,
  MARKER_HEIGHT,
  MARKER_RADIUS,
  START,
  START_WALL_ACCENT_COLOR,
  WALL_EDGE_COLOR,
  WALL_FILL_COLOR,
  WALL_PILLAR_SIZE,
  WALL_PILLAR_TEXTURE_HEIGHT,
  WALL_PILLAR_TEXTURE_WIDTH,
  WORLD_CELL_SIZE,
  WORLD_FLOOR_ELEVATION,
  WORLD_FLOOR_Y,
  WORLD_WALL_HEIGHT,
  WORLD_WALL_THICKNESS,
} from '../../game/constants';
import { Cell, Maze } from '../../mazeUtils';
import { toWorldX, toWorldZ } from './worldCoordinates';

// 迷路壁向きの識別子。
type WallDirection = 'N' | 'E' | 'S' | 'W';
// BoxGeometryの面インデックス（+X, -X, +Y, -Y, +Z, -Z）。
type WallFaceIndex = 0 | 1 | 2 | 3 | 4 | 5;
// 壁に面するセルと、そのセル側を向く面インデックスの組。
type AdjacentWallFace = {
  x: number;
  y: number;
  faceIndex: WallFaceIndex;
};

/**
 * 3D迷路ジオメトリ構築に必要な入力値。
 */
export type MazeWorldBuildParams = {
  root: THREE.Group;
  maze: Maze;
  checkpoints: Checkpoint[];
  passedCheckpointKeys: Set<string>;
  goalActive: boolean;
};

// 柱テクスチャのキャッシュ。再生成を避けて描画更新時の負荷を抑える。
let wallPillarTextureCache: THREE.CanvasTexture | null = null;

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
 * 柱へ貼るシームレステクスチャを生成する。
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

  // 列方向は均一色のまま、横帯だけを重ねて柱の縦シーム感を抑える。
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
 * 柱テクスチャを取得する（未生成なら生成してキャッシュする）。
 * @returns 柱描画に使うCanvasTexture
 */
const getWallPillarTexture = (): THREE.CanvasTexture => {
  if (!wallPillarTextureCache) {
    wallPillarTextureCache = createWallPillarTexture();
  }
  return wallPillarTextureCache;
};

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
  return passedCheckpointKeys.has(key) ? CHECKPOINT_CLEARED_COLOR : CHECKPOINT_PENDING_COLOR;
};

/**
 * 壁色強調の対象セル色を返す（スタート/チェックポイント/ゴール）。
 * @param cellX セルX座標
 * @param cellY セルY座標
 * @param checkpointKeySet チェックポイント存在キー集合
 * @param passedCheckpointKeys 通過済みチェックポイントキー集合
 * @param goalActive ゴール有効化状態
 * @returns 強調色。対象外セルならnull
 */
const resolveWallAccentColor = (
  cellX: number,
  cellY: number,
  checkpointKeySet: Set<string>,
  passedCheckpointKeys: Set<string>,
  goalActive: boolean
): string | null => {
  if (cellX === START.x && cellY === START.y) {
    return START_WALL_ACCENT_COLOR;
  }
  if (cellX === GOAL.x && cellY === GOAL.y) {
    return goalActive ? GOAL_ACTIVE_WALL_COLOR : GOAL_INACTIVE_WALL_COLOR;
  }
  const key = toCheckpointKey(cellX, cellY);
  if (!checkpointKeySet.has(key)) return null;
  return passedCheckpointKeys.has(key)
    ? CHECKPOINT_CLEARED_WALL_COLOR
    : CHECKPOINT_PENDING_WALL_COLOR;
};

/**
 * 壁に隣接するセルと、各セル側を向く壁面インデックスを返す。
 * @param x 壁を判定している基準セルX
 * @param y 壁を判定している基準セルY
 * @param dir 基準セル側での壁方向
 * @returns 面インデックスつき隣接セル配列（最大2件）
 */
const getAdjacentWallFaces = (x: number, y: number, dir: WallDirection): AdjacentWallFace[] => {
  if (dir === 'N') {
    return [
      { x, y, faceIndex: 4 },
      { x, y: y - 1, faceIndex: 5 },
    ];
  }
  if (dir === 'S') {
    return [
      { x, y, faceIndex: 5 },
      { x, y: y + 1, faceIndex: 4 },
    ];
  }
  if (dir === 'W') {
    return [
      { x, y, faceIndex: 0 },
      { x: x - 1, y, faceIndex: 1 },
    ];
  }
  return [
    { x, y, faceIndex: 1 },
    { x: x + 1, y, faceIndex: 0 },
  ];
};

/**
 * セル座標が迷路範囲内かどうかを判定する。
 * @param x セルX座標
 * @param y セルY座標
 * @param width 迷路幅
 * @param height 迷路高さ
 * @returns 範囲内ならtrue
 */
const isInMazeBounds = (x: number, y: number, width: number, height: number): boolean =>
  x >= 0 && x < width && y >= 0 && y < height;

/**
 * 迷路ワールドのメッシュ生成を担当するビルダー。
 * セル走査・壁面色分岐・柱配置を内部へ閉じ込めて描画処理の見通しを上げる。
 */
class MazeWorldBuilder {
  // 描画先グループ。
  private readonly root: THREE.Group;
  // 描画対象の迷路データ。
  private readonly maze: Maze;
  // 通過済みチェックポイントキー集合。
  private readonly passedCheckpointKeys: Set<string>;
  // ゴール有効化状態。
  private readonly goalActive: boolean;
  // 迷路の縦マス数。
  private readonly height: number;
  // 迷路の横マス数。
  private readonly width: number;
  // チェックポイント存在キー集合。
  private readonly checkpointKeySet: Set<string>;

  /**
   * ビルダーの初期値を設定する。
   * @param params 描画対象と状態の入力値
   */
  constructor(params: MazeWorldBuildParams) {
    this.root = params.root;
    this.maze = params.maze;
    this.passedCheckpointKeys = params.passedCheckpointKeys;
    this.goalActive = params.goalActive;
    this.height = this.maze.length;
    this.width = this.maze[0]?.length ?? 0;
    this.checkpointKeySet = new Set(
      params.checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y))
    );
  }

  /**
   * 床・マーカー・壁・柱をまとめて構築する。
   */
  build(): void {
    this.buildCells();
    this.buildPillars();
  }

  /**
   * 迷路セルを走査して床・マーカー・壁を構築する。
   */
  private buildCells(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.maze[y][x];
        const worldCenterX = toWorldX(x);
        const worldCenterZ = toWorldZ(y);

        this.buildFloor(x, y, worldCenterX, worldCenterZ);
        this.buildMarker(x, y, worldCenterX, worldCenterZ);
        this.buildWallsForCell(x, y, cell, worldCenterX, worldCenterZ);
      }
    }
  }

  /**
   * 指定セルの床メッシュを構築する。
   * @param cellX セルX座標
   * @param cellY セルY座標
   * @param worldCenterX セル中心のワールドX座標
   * @param worldCenterZ セル中心のワールドZ座標
   */
  private buildFloor(
    cellX: number,
    cellY: number,
    worldCenterX: number,
    worldCenterZ: number
  ): void {
    const floorColor = resolveFloorColor(
      cellX,
      cellY,
      this.checkpointKeySet,
      this.passedCheckpointKeys,
      this.goalActive
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
    this.root.add(floorMesh);
  }

  /**
   * 指定セルのマーカーメッシュを必要に応じて構築する。
   * @param cellX セルX座標
   * @param cellY セルY座標
   * @param worldCenterX セル中心のワールドX座標
   * @param worldCenterZ セル中心のワールドZ座標
   */
  private buildMarker(
    cellX: number,
    cellY: number,
    worldCenterX: number,
    worldCenterZ: number
  ): void {
    const markerColor = resolveMarkerColor(
      cellX,
      cellY,
      this.checkpointKeySet,
      this.passedCheckpointKeys,
      this.goalActive
    );
    if (!markerColor) return;

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
    this.root.add(markerBody);

    const markerEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(markerBody.geometry),
      new THREE.LineBasicMaterial({ color: WALL_EDGE_COLOR })
    );
    markerEdge.position.copy(markerBody.position);
    markerEdge.userData.kind = 'marker-edge';
    this.root.add(markerEdge);
  }

  /**
   * 指定セルの壁を構築する。
   * @param cellX セルX座標
   * @param cellY セルY座標
   * @param cell 壁情報を含むセルデータ
   * @param worldCenterX セル中心のワールドX座標
   * @param worldCenterZ セル中心のワールドZ座標
   */
  private buildWallsForCell(
    cellX: number,
    cellY: number,
    cell: Cell,
    worldCenterX: number,
    worldCenterZ: number
  ): void {
    (['N', 'E', 'S', 'W'] as WallDirection[]).forEach((dir) => {
      if (!cell.walls[dir]) return;
      if (!shouldDrawWallFromCell(cellX, cellY, this.width, this.height, dir)) return;
      this.buildSingleWall(cellX, cellY, worldCenterX, worldCenterZ, dir);
    });
  }

  /**
   * 壁1枚の本体と輪郭線を構築する。
   * @param cellX 壁基準セルX座標
   * @param cellY 壁基準セルY座標
   * @param worldCenterX セル中心のワールドX座標
   * @param worldCenterZ セル中心のワールドZ座標
   * @param dir 壁方向
   */
  private buildSingleWall(
    cellX: number,
    cellY: number,
    worldCenterX: number,
    worldCenterZ: number,
    dir: WallDirection
  ): void {
    const isHorizontal = dir === 'N' || dir === 'S';
    const wallGeometry = new THREE.BoxGeometry(
      isHorizontal ? WORLD_CELL_SIZE : WORLD_WALL_THICKNESS,
      WORLD_WALL_HEIGHT,
      isHorizontal ? WORLD_WALL_THICKNESS : WORLD_CELL_SIZE
    );
    // 片側だけの強調を実現するため、壁6面ごとに色を決定する。
    const wallFaceColors: string[] = new Array(6).fill(WALL_FILL_COLOR);
    const adjacentFaces = getAdjacentWallFaces(cellX, cellY, dir);
    adjacentFaces.forEach((adjacent) => {
      if (!isInMazeBounds(adjacent.x, adjacent.y, this.width, this.height)) return;
      const accent = resolveWallAccentColor(
        adjacent.x,
        adjacent.y,
        this.checkpointKeySet,
        this.passedCheckpointKeys,
        this.goalActive
      );
      if (!accent) return;
      wallFaceColors[adjacent.faceIndex] = accent;
    });
    const wallMaterials = wallFaceColors.map(
      (faceColor) => new THREE.MeshBasicMaterial({ color: faceColor })
    );
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterials);

    let wallX = worldCenterX;
    let wallZ = worldCenterZ;
    if (dir === 'N') wallZ = cellY * WORLD_CELL_SIZE;
    if (dir === 'S') wallZ = (cellY + 1) * WORLD_CELL_SIZE;
    if (dir === 'W') wallX = cellX * WORLD_CELL_SIZE;
    if (dir === 'E') wallX = (cellX + 1) * WORLD_CELL_SIZE;
    wallMesh.position.set(wallX, WORLD_WALL_HEIGHT / 2 + WORLD_FLOOR_Y, wallZ);
    wallMesh.userData.kind = 'wall';
    this.root.add(wallMesh);

    const wallEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(wallGeometry),
      new THREE.LineBasicMaterial({ color: WALL_EDGE_COLOR })
    );
    wallEdge.position.copy(wallMesh.position);
    wallEdge.userData.kind = 'wall-edge';
    this.root.add(wallEdge);
  }

  /**
   * 壁の有無に関係なく全交点へ柱を配置する。
   */
  private buildPillars(): void {
    for (let gridZ = 0; gridZ <= this.height; gridZ++) {
      for (let gridX = 0; gridX <= this.width; gridX++) {
        const pillarMesh = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_PILLAR_SIZE, WORLD_WALL_HEIGHT, WALL_PILLAR_SIZE),
          new THREE.MeshBasicMaterial({
            color: '#d8f3df',
            map: getWallPillarTexture(),
          })
        );
        pillarMesh.position.set(
          gridX * WORLD_CELL_SIZE,
          WORLD_WALL_HEIGHT / 2 + WORLD_FLOOR_Y,
          gridZ * WORLD_CELL_SIZE
        );
        pillarMesh.userData.kind = 'wall-pillar';
        this.root.add(pillarMesh);
      }
    }
  }
}

/**
 * 3D迷路ジオメトリ（床・壁・マーカー柱）を再構築する。
 * @param params 描画に必要な入力値
 */
export const buildMazeWorld = (params: MazeWorldBuildParams): void => {
  const builder = new MazeWorldBuilder(params);
  builder.build();
};
