import * as THREE from 'three';
import { Checkpoint, toCheckpointKey } from '../../game/checkpointUtils';
import {
  FLOOR_BASE_COLOR,
  FLOOR_BASE_OPACITY,
  GOAL_GATE_BAR_COLOR,
  GOAL_GATE_BAR_COUNT,
  GOAL_GATE_BAR_THICKNESS,
  GOAL_OUTSIDE_FLOOR_COLOR,
  GOAL_OPEN_PILLAR_COLOR,
  MARKER_HEIGHT,
  MARKER_RADIUS,
  WALL_EDGE_COLOR,
  WALL_FILL_COLOR,
  WALL_PILLAR_SIZE,
  WORLD_CELL_SIZE,
  WORLD_FLOOR_ELEVATION,
  WORLD_FLOOR_Y,
  WORLD_WALL_HEIGHT,
  WORLD_WALL_THICKNESS,
} from '../../game/constants';
import { Cell, GoalExit, Maze } from '../../mazeUtils';
import { getGoalOpeningCenter, getGoalPillarPoints } from './goalExitGeometry';
import {
  resolveFloorColor,
  resolveMarkerColor,
  resolveWallAccentColor,
  toThreeColorInfo,
} from './mazeCellColorResolvers';
import { getWallPillarTexture } from './wallPillarTexture';
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
  goalExit: GoalExit;
  checkpoints: Checkpoint[];
  passedCheckpointKeys: Set<string>;
  goalActive: boolean;
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
  // ゴール出口情報。
  private readonly goalExit: GoalExit;
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
    this.goalExit = params.goalExit;
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
    this.buildGoalOutsideFloor();
    this.buildPillars();
    this.buildLockedGoalGate();
  }

  /**
   * 出口の外側へ常時赤色の床を配置する。
   */
  private buildGoalOutsideFloor(): void {
    const center = getGoalOpeningCenter(this.goalExit);
    let offsetX = 0;
    let offsetZ = 0;
    if (this.goalExit.dir === 'N') offsetZ = -WORLD_CELL_SIZE / 2;
    if (this.goalExit.dir === 'E') offsetX = WORLD_CELL_SIZE / 2;
    if (this.goalExit.dir === 'S') offsetZ = WORLD_CELL_SIZE / 2;
    if (this.goalExit.dir === 'W') offsetX = -WORLD_CELL_SIZE / 2;
    const floorColorInfo = toThreeColorInfo(GOAL_OUTSIDE_FLOOR_COLOR);
    const outsideFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_CELL_SIZE, WORLD_CELL_SIZE),
      new THREE.MeshBasicMaterial({
        color: floorColorInfo.color,
        transparent: floorColorInfo.opacity < 1,
        opacity: floorColorInfo.opacity,
        side: THREE.DoubleSide,
      })
    );
    outsideFloor.rotation.x = -Math.PI / 2;
    outsideFloor.position.set(
      center.x + offsetX,
      WORLD_FLOOR_Y + WORLD_FLOOR_ELEVATION,
      center.z + offsetZ
    );
    outsideFloor.userData.kind = 'goal-outside-floor';
    this.root.add(outsideFloor);
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
      this.passedCheckpointKeys
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
      this.passedCheckpointKeys
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
        this.passedCheckpointKeys
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
    const goalPillarKeySet = new Set(
      getGoalPillarPoints(this.goalExit).map((point) => `${point.x},${point.z}`)
    );
    for (let gridZ = 0; gridZ <= this.height; gridZ++) {
      for (let gridX = 0; gridX <= this.width; gridX++) {
        const isGoalPillar = goalPillarKeySet.has(`${gridX},${gridZ}`);
        const pillarMaterial = isGoalPillar
          ? new THREE.MeshBasicMaterial({ color: GOAL_OPEN_PILLAR_COLOR })
          : new THREE.MeshBasicMaterial({
              color: '#d8f3df',
              map: getWallPillarTexture(),
            });
        const pillarMesh = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_PILLAR_SIZE, WORLD_WALL_HEIGHT, WALL_PILLAR_SIZE),
          pillarMaterial
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

  /**
   * ゴール未解放時に出口開口へ格子ゲートを配置する。
   */
  private buildLockedGoalGate(): void {
    if (this.goalActive) return;

    const center = getGoalOpeningCenter(this.goalExit);
    const gateMaterial = new THREE.MeshBasicMaterial({ color: GOAL_GATE_BAR_COLOR });
    const isHorizontalOpening = this.goalExit.dir === 'N' || this.goalExit.dir === 'S';
    const gateDepth = WORLD_WALL_THICKNESS * 0.72;
    const gateHeight = WORLD_WALL_HEIGHT * 0.9;
    const horizontalSpan = WORLD_CELL_SIZE * 0.9;
    const spacing = horizontalSpan / (GOAL_GATE_BAR_COUNT + 1);

    for (let i = 1; i <= GOAL_GATE_BAR_COUNT; i++) {
      const offset = -horizontalSpan / 2 + spacing * i;
      const verticalBar = new THREE.Mesh(
        new THREE.BoxGeometry(
          isHorizontalOpening ? GOAL_GATE_BAR_THICKNESS : gateDepth,
          gateHeight,
          isHorizontalOpening ? gateDepth : GOAL_GATE_BAR_THICKNESS
        ),
        gateMaterial
      );
      verticalBar.position.set(
        center.x + (isHorizontalOpening ? offset : 0),
        WORLD_FLOOR_Y + gateHeight / 2,
        center.z + (isHorizontalOpening ? 0 : offset)
      );
      verticalBar.userData.kind = 'goal-gate';
      this.root.add(verticalBar);
    }

    const horizontalBarHeights = [0.35, 0.7];
    horizontalBarHeights.forEach((heightRate) => {
      const horizontalBar = new THREE.Mesh(
        new THREE.BoxGeometry(
          isHorizontalOpening ? horizontalSpan : gateDepth,
          GOAL_GATE_BAR_THICKNESS,
          isHorizontalOpening ? gateDepth : horizontalSpan
        ),
        gateMaterial
      );
      horizontalBar.position.set(
        center.x,
        WORLD_FLOOR_Y + WORLD_WALL_HEIGHT * heightRate,
        center.z
      );
      horizontalBar.userData.kind = 'goal-gate';
      this.root.add(horizontalBar);
    });
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
