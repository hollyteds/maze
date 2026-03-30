import { Cell, Maze, PlayerState } from '../mazeUtils';
import { Checkpoint, toCheckpointKey } from './checkpointUtils';
import { GOAL, START } from './constants';
import { LEFT_OF, RIGHT_OF } from './playerActions';

// 透視段階ごとの描画枠（近景/遠景）を表す矩形。
type Frame = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// 透視基準で使う2次元座標。
type Point = {
  x: number;
  y: number;
};

// 天井点と床点のペア。
type CeilingFloorPoint = {
  ceiling: Point;
  floor: Point;
};

// 奥行きごとに持つ左右レーン識別子。
type DepthLane =
  | 'outerLeft'
  | 'left'
  | 'center'
  | 'right'
  | 'outerRight'
  | 'wallNearLeft'
  | 'wallNearRight';

// 1奥行きぶんの透視基準点テーブル。
type DepthPerspective = Record<DepthLane, CeilingFloorPoint>;

// 透視座標を参照するための奥行きキー。
type PerspectiveDepthKey = 'd0' | 'd1' | 'd2' | 'd3';

// 床ハイライトの対象レーン識別子。
type FloorLane = 'left' | 'center' | 'right';

// 共通アスペクト比でフレームを生成するための入力仕様。
type FrameSpec = {
  centerX: number;
  centerY: number;
  height: number;
};

// 奥行きキーの並び順。値を変えると描画距離の対応関係が変わる。
const DEPTH_KEY_ORDER: PerspectiveDepthKey[] = ['d0', 'd1', 'd2', 'd3'];

// ワイヤーフレーム線分の描画情報。
export type WireLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  part: string;
  depth: number;
};

// 壁面ポリゴンの描画情報。
export type WireFace = {
  points: string;
  fill: string;
  part: string;
  depth: number;
};

// 床ハイライトポリゴンの描画情報。
export type FloorPatch = {
  points: string;
  fill: string;
  depth: number;
  part: string;
};

// スタート/ゴールのマーカー描画情報。
export type Marker = {
  x: number;
  y: number;
  size: number;
  depth: number;
  label: 'S' | 'G' | 'C';
  checkpointNumber?: number;
  goalActive?: boolean;
  checkpointPassed?: boolean;
};

// デバッグ出力用のセル壁情報（範囲外はnull）。
type CellWallDebug = {
  x: number;
  y: number;
  walls: Cell['walls'];
} | null;

// 各depthでの壁判定と描画アクションの記録。
export type WallJudgement = {
  depth: number;
  center: CellWallDebug;
  left: CellWallDebug;
  right: CellWallDebug;
  judgement: Record<string, boolean | null>;
  actions: string[];
};

// 1フレーム分の投影結果。
export type WireframeProjection = {
  lines: WireLine[];
  faces: WireFace[];
  floorPatches: FloorPatch[];
  markers: Marker[];
  wallJudgements: WallJudgement[];
};

// 3DビューのSVG横幅（px）。
export const VIEWPORT_WIDTH = 520;
// 3DビューのSVG縦幅（px）。
export const VIEWPORT_HEIGHT = 380;
// ワイヤー線の標準色。
export const LINE_COLOR = '#9df7b5';
// 外枠グローの標準色。
export const GLOW_COLOR = '#58d47f';
// 中央正面壁の共通縦横比（width / height）。変更すると全奥行きの見え方が連動して変わる。
const CENTER_FRONT_WALL_ASPECT_RATIO = 444 / 328;
// 最奥正面壁（d3）の縮小率。小さくすると最奥の圧縮感が強くなる。
const FARTHEST_FRONT_WALL_SCALE = 0.8;
// 最奥正面壁の左端座標。側面幅比率（1,1/2,1/3）計算の終点として使う。
const FARTHEST_FRONT_WALL_LEFT =
  260 -
  ((138 * FARTHEST_FRONT_WALL_SCALE) * CENTER_FRONT_WALL_ASPECT_RATIO) / 2;
// 側面幅の比率和。1 + 1/2 + 1/3 を使って基準幅を逆算する。
const SIDE_WALL_RATIO_SUM = 1 + 1 / 2 + 1 / 3;
// 手前側面の基準幅。これを 1,1/2,1/3 に分配して奥行き幅を決める。
const SIDE_WALL_BASE_SPAN = (FARTHEST_FRONT_WALL_LEFT - 2) / SIDE_WALL_RATIO_SUM;
// d1左端。これが depth0 側面の終端になり、以降の連続境界の起点になる。
const D1_FRONT_WALL_LEFT = 2 + SIDE_WALL_BASE_SPAN;
// d2左端。d1から基準幅の1/2だけ奥へ進める。
const D2_FRONT_WALL_LEFT = D1_FRONT_WALL_LEFT + SIDE_WALL_BASE_SPAN / 2;
// 各奥行きで使うフレーム中心と高さ。縦横比は上記定数で統一計算する。
// d1/d2高さは「側面幅が手前から 1, 1/2, 1/3 で連続する」よう調整済み。
const FRAME_SPEC_BY_DEPTH_KEY: Record<PerspectiveDepthKey, FrameSpec> = {
  d0: { centerX: 260, centerY: 190, height: 328 },
  d1: {
    centerX: 260,
    centerY: 193,
    height: (VIEWPORT_WIDTH - D1_FRONT_WALL_LEFT * 2) / CENTER_FRONT_WALL_ASPECT_RATIO,
  },
  d2: {
    centerX: 260,
    centerY: 195.5,
    height: (VIEWPORT_WIDTH - D2_FRONT_WALL_LEFT * 2) / CENTER_FRONT_WALL_ASPECT_RATIO,
  },
  d3: { centerX: 260, centerY: 197, height: 138 * FARTHEST_FRONT_WALL_SCALE },
};

class WireframeProjectionBuilder {
  // 最大可視深度（前方3マス）。
  private readonly viewDepth = 3;
  // 奥行きごとの壁塗り色。
  private readonly wallFillByDepth = ['#0b2117', '#091b13', '#07160f'];
  // 疑似透視に使う基準フレーム定義（キー: 奥行き段階）。
  private readonly frameByDepthKey: Record<PerspectiveDepthKey, Frame>;
  // 奥行きキー×左右レーンの天井/床基準点テーブル。
  private readonly perspectiveByDepthKey: Record<PerspectiveDepthKey, DepthPerspective>;
  // 描画対象の線分バッファ。
  private readonly lines: WireLine[] = [];
  // 描画対象の面バッファ。
  private readonly faces: WireFace[] = [];
  // 描画対象のS/G/Cマーカーバッファ。
  private readonly markers: Marker[] = [];
  // 描画対象の床ハイライトバッファ。
  private readonly floorPatches: FloorPatch[] = [];
  // 判定デバッグの記録バッファ。
  private readonly wallJudgements: WallJudgement[] = [];
  // チェックポイント存在判定用のキー集合。
  private readonly checkpointKeySet: Set<string>;
  // 座標キーからチェックポイント番号を引くための表。
  private readonly checkpointNumberMap: Map<string, number>;

  /**
   * 投影生成器を初期化する。
   * @param maze 投影対象の迷路データ
   * @param player 投影基準となるプレイヤー状態
   * @param checkpoints 全チェックポイント座標
   * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
   * @param goalActive ゴール有効化状態
   */
  constructor(
    private readonly maze: Maze,
    private readonly player: PlayerState,
    private readonly checkpoints: Checkpoint[],
    private readonly passedCheckpointKeys: Set<string>,
    private readonly goalActive: boolean
  ) {
    this.frameByDepthKey = this.createFrameByDepthKey();
    this.checkpointKeySet = new Set(
      checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y))
    );
    this.checkpointNumberMap = new Map(
      checkpoints.map((checkpoint) => [
        toCheckpointKey(checkpoint.x, checkpoint.y),
        checkpoint.id,
      ])
    );
    this.perspectiveByDepthKey = this.createPerspectiveByDepthKey();
  }

  /**
   * 迷路状態から3Dワイヤーフレーム描画データを生成する。
   * @returns 線・面・マーカー・判定ログを含む投影結果
   */
  build(): WireframeProjection {
    // depthごとに「中央セル・左右セル」を評価して壁を組み立てる。
    for (let depth = 0; depth < this.viewDepth; depth++) {
      const nearPerspective = this.perspectiveByDepthKey[this.getDepthKey(depth)];
      const farPerspective = this.perspectiveByDepthKey[this.getDepthKey(depth + 1)];
      const cell = this.getRelativeCell(0, depth);
      const actions: string[] = [];

      if (!cell) {
        this.wallJudgements.push({
          depth,
          center: null,
          left: null,
          right: null,
          judgement: {
            inBounds: false,
            frontClosed: null,
            leftClosed: null,
            rightClosed: null,
            leftVisible: null,
            rightVisible: null,
          },
          actions: ['drawFrontWall(outOfBounds)'],
        });
        this.drawFrontWall(farPerspective, depth);
        break;
      }

      const centerX = farPerspective.center.ceiling.x;
      const centerY =
        farPerspective.center.floor.y -
        (farPerspective.center.floor.y - farPerspective.center.ceiling.y) * 0.38;
      const centerSize = Math.max(8, 16 - depth * 2.2);

      // 現在セルと左右隣接セルの壁情報から可視判定を作る。
      const leftClosed = cell.walls[LEFT_OF[this.player.dir]];
      const rightClosed = cell.walls[RIGHT_OF[this.player.dir]];
      const frontClosed = cell.walls[this.player.dir];
      const leftCell = this.getRelativeCell(-1, depth);
      const rightCell = this.getRelativeCell(1, depth);
      const leftFrontClosed = !!leftCell?.walls[this.player.dir];
      const rightFrontClosed = !!rightCell?.walls[this.player.dir];
      const leftCellExists = !!leftCell;
      const rightCellExists = !!rightCell;
      const leftVisible = !leftClosed && leftCellExists;
      const rightVisible = !rightClosed && rightCellExists;
      const shouldDrawLeftSideWall = leftClosed;
      const shouldDrawRightSideWall = rightClosed;
      const shouldDrawLeftSideFront = leftCellExists && leftFrontClosed;
      const shouldDrawRightSideFront = rightCellExists && rightFrontClosed;
      const sideSize = Math.max(7, 14 - depth * 2.1);
      this.pushFloorPatchForLane(cell, 'center', nearPerspective, farPerspective, depth);
      // 左右通路が見えているときのみ、左右セルの床ハイライトを描画する。
      if (leftVisible) {
        this.pushFloorPatchForLane(leftCell, 'left', nearPerspective, farPerspective, depth);
      }
      if (rightVisible) {
        this.pushFloorPatchForLane(rightCell, 'right', nearPerspective, farPerspective, depth);
      }
      this.pushMarkerForCell(cell, centerX, centerY, centerSize, depth);

      // 正面が閉じている場合、このdepthで遮蔽されるため描画を確定して終了する。
      if (frontClosed) {
        if (shouldDrawLeftSideWall) {
          this.drawSideWall('left', nearPerspective, farPerspective, depth);
          actions.push('drawSideWall(left)');
        }
        if (shouldDrawLeftSideFront) {
          const markerPoint = this.drawSideFrontWall('left', farPerspective, depth);
          this.pushMarkerForCell(leftCell, markerPoint.centerX, markerPoint.centerY, sideSize, depth);
          actions.push('drawSideFrontWall(left)');
        }
        if (shouldDrawRightSideWall) {
          this.drawSideWall('right', nearPerspective, farPerspective, depth);
          actions.push('drawSideWall(right)');
        }
        if (shouldDrawRightSideFront) {
          const markerPoint = this.drawSideFrontWall('right', farPerspective, depth);
          this.pushMarkerForCell(rightCell, markerPoint.centerX, markerPoint.centerY, sideSize, depth);
          actions.push('drawSideFrontWall(right)');
        }
        // 正面が壁でも左右通路が開いている場合は、その奥の正面壁を探索して描画する。
        if (leftVisible && !leftFrontClosed) {
          this.drawDeeperSideFrontWall('left', depth + 1, actions);
        }
        if (rightVisible && !rightFrontClosed) {
          this.drawDeeperSideFrontWall('right', depth + 1, actions);
        }
        this.wallJudgements.push({
          depth,
          center: this.toCellWallDebug(cell),
          left: this.toCellWallDebug(leftCell),
          right: this.toCellWallDebug(rightCell),
          judgement: {
            inBounds: true,
            frontClosed,
            leftClosed,
            rightClosed,
            leftFrontClosed,
            rightFrontClosed,
            leftVisible,
            rightVisible,
            shouldDrawLeftSideWall,
            shouldDrawRightSideWall,
            shouldDrawLeftSideFront,
            shouldDrawRightSideFront,
          },
          actions: [...actions, 'drawFrontWall(frontClosed)'],
        });
        this.drawFrontWall(farPerspective, depth);
        break;
      }

      if (shouldDrawLeftSideWall) {
        this.drawSideWall('left', nearPerspective, farPerspective, depth);
        actions.push('drawSideWall(left)');
      }
      if (shouldDrawLeftSideFront) {
        const markerPoint = this.drawSideFrontWall('left', farPerspective, depth);
        this.pushMarkerForCell(leftCell, markerPoint.centerX, markerPoint.centerY, sideSize, depth);
        actions.push('drawSideFrontWall(left)');
      }
      if (shouldDrawRightSideWall) {
        this.drawSideWall('right', nearPerspective, farPerspective, depth);
        actions.push('drawSideWall(right)');
      }
      if (shouldDrawRightSideFront) {
        const markerPoint = this.drawSideFrontWall('right', farPerspective, depth);
        this.pushMarkerForCell(rightCell, markerPoint.centerX, markerPoint.centerY, sideSize, depth);
        actions.push('drawSideFrontWall(right)');
      }

      this.wallJudgements.push({
        depth,
        center: this.toCellWallDebug(cell),
        left: this.toCellWallDebug(leftCell),
        right: this.toCellWallDebug(rightCell),
        judgement: {
          inBounds: true,
          frontClosed,
          leftClosed,
          rightClosed,
          leftFrontClosed,
          rightFrontClosed,
          leftVisible,
          rightVisible,
          shouldDrawLeftSideWall,
          shouldDrawRightSideWall,
          shouldDrawLeftSideFront,
          shouldDrawRightSideFront,
        },
        actions,
      });
    }

    // 描画コンポーネントに渡す投影結果を返す。
    return {
      lines: this.lines,
      faces: this.faces,
      floorPatches: this.floorPatches,
      markers: this.markers,
      wallJudgements: this.wallJudgements,
    };
  }

  /**
   * 数値depthを透視テーブル参照用キーへ変換する。
   * @param depth 参照したい奥行きインデックス
   * @returns 透視基準点テーブルの奥行きキー
   */
  private getDepthKey(depth: number): PerspectiveDepthKey {
    // 表示可能範囲外のdepthは最奥キーへ寄せて参照を安定化する。
    if (depth <= 0) return 'd0';
    if (depth === 1) return 'd1';
    if (depth === 2) return 'd2';
    return 'd3';
  }

  /**
   * 共通縦横比を維持した奥行きフレーム定義を生成する。
   * @returns 奥行きキーで参照できるフレーム定義
   */
  private createFrameByDepthKey(): Record<PerspectiveDepthKey, Frame> {
    const frames = {} as Record<PerspectiveDepthKey, Frame>;

    DEPTH_KEY_ORDER.forEach((depthKey) => {
      const spec = FRAME_SPEC_BY_DEPTH_KEY[depthKey];
      const width = spec.height * CENTER_FRONT_WALL_ASPECT_RATIO;
      frames[depthKey] = {
        left: spec.centerX - width / 2,
        right: spec.centerX + width / 2,
        top: spec.centerY - spec.height / 2,
        bottom: spec.centerY + spec.height / 2,
      };
    });

    return frames;
  }

  /**
   * 奥行き×左右レーンの天井/床基準点テーブルを構築する。
   * @returns 奥行きキーで参照できる透視基準点表
   */
  private createPerspectiveByDepthKey(): Record<PerspectiveDepthKey, DepthPerspective> {
    const perspectives = {} as Record<PerspectiveDepthKey, DepthPerspective>;
    // 側面壁の基準幅。depth0の左側で「画面端(2)→d1左端」までを基準にする。
    const sideWallBaseSpan = this.frameByDepthKey.d1.left - 2;

    DEPTH_KEY_ORDER.forEach((depthKey, depthIndex) => {
      const frame = this.frameByDepthKey[depthKey];
      const centerX = (frame.left + frame.right) / 2;
      const centerWidth = frame.right - frame.left;
      const outerLeftX = frame.left - centerWidth;
      const outerRightX = frame.right + centerWidth;
      const nextDepthKey = DEPTH_KEY_ORDER[Math.min(depthIndex + 1, DEPTH_KEY_ORDER.length - 1)];
      const nextFrame = this.frameByDepthKey[nextDepthKey];

      // 側面壁の幅はdepthごとに 1, 1/2, 1/3 ... へ縮小する。
      // なぜ必要か: 奥行きごとの縮尺を明示して、左右側壁のパースを一貫させるため。
      const sideSpanDivisor = depthIndex + 1;
      const sideWallSpan = sideWallBaseSpan / sideSpanDivisor;
      const wallNearLeftX =
        depthIndex < this.viewDepth ? nextFrame.left - sideWallSpan : frame.left;
      const wallNearRightX =
        depthIndex < this.viewDepth ? nextFrame.right + sideWallSpan : frame.right;
      const wallNearLeftTop =
        depthIndex < this.viewDepth
          ? Math.max(
              2,
              this.interpolateYAtX(frame.left, frame.top, nextFrame.left, nextFrame.top, wallNearLeftX)
            )
          : frame.top;
      const wallNearLeftBottom =
        depthIndex < this.viewDepth
          ? Math.min(
              VIEWPORT_HEIGHT - 2,
              this.interpolateYAtX(
                frame.left,
                frame.bottom,
                nextFrame.left,
                nextFrame.bottom,
                wallNearLeftX
              )
            )
          : frame.bottom;
      const wallNearRightTop =
        depthIndex < this.viewDepth
          ? Math.max(
              2,
              this.interpolateYAtX(
                frame.right,
                frame.top,
                nextFrame.right,
                nextFrame.top,
                wallNearRightX
              )
            )
          : frame.top;
      const wallNearRightBottom =
        depthIndex < this.viewDepth
          ? Math.min(
              VIEWPORT_HEIGHT - 2,
              this.interpolateYAtX(
                frame.right,
                frame.bottom,
                nextFrame.right,
                nextFrame.bottom,
                wallNearRightX
              )
            )
          : frame.bottom;

      perspectives[depthKey] = {
        outerLeft: this.toCeilingFloorPoint(outerLeftX, frame.top, frame.bottom),
        left: this.toCeilingFloorPoint(frame.left, frame.top, frame.bottom),
        center: this.toCeilingFloorPoint(centerX, frame.top, frame.bottom),
        right: this.toCeilingFloorPoint(frame.right, frame.top, frame.bottom),
        outerRight: this.toCeilingFloorPoint(outerRightX, frame.top, frame.bottom),
        wallNearLeft: this.toCeilingFloorPoint(
          wallNearLeftX,
          wallNearLeftTop,
          wallNearLeftBottom
        ),
        wallNearRight: this.toCeilingFloorPoint(
          wallNearRightX,
          wallNearRightTop,
          wallNearRightBottom
        ),
      };
    });

    return perspectives;
  }

  /**
   * 同一X上の天井点/床点ペアを生成する。
   * @param x X座標
   * @param top 天井Y座標
   * @param bottom 床Y座標
   * @returns 天井点と床点
   */
  private toCeilingFloorPoint(x: number, top: number, bottom: number): CeilingFloorPoint {
    return {
      ceiling: { x, y: top },
      floor: { x, y: bottom },
    };
  }

  /**
   * 2点を結ぶ線上で指定Xに対応するYを返す。
   * @param x1 線分始点X
   * @param y1 線分始点Y
   * @param x2 線分終点X
   * @param y2 線分終点Y
   * @param x 補間したいX
   * @returns 線形補間したY
   */
  private interpolateYAtX(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number
  ): number {
    if (x1 === x2) return y1;
    const t = (x - x1) / (x2 - x1);
    return y1 + (y2 - y1) * t;
  }

  /**
   * 座標をSVGポリゴン用の文字列へ変換する。
   * @param point 変換対象座標
   * @returns `x,y`形式の文字列
   */
  private toSvgPoint(point: Point): string {
    return `${point.x},${point.y}`;
  }

  /**
   * 迷路座標からセルを取得する。
   * @param x セルX座標
   * @param y セルY座標
   * @returns 範囲内セル。範囲外ならnull
   */
  private getCell(x: number, y: number): Cell | null {
    if (y < 0 || y >= this.maze.length || x < 0 || x >= this.maze[0].length) return null;
    return this.maze[y][x];
  }

  /**
   * プレイヤー向きを基準に相対セルを取得する。
   * @param sideOffset 左右オフセット（-1:左 / 0:中央 / 1:右）
   * @param forwardOffset 前方オフセット（0:現在 / 1..:前方）
   * @returns 相対位置のセル。範囲外ならnull
   */
  private getRelativeCell(sideOffset: number, forwardOffset: number): Cell | null {
    const { dir, x, y } = this.player;
    if (dir === 'N') return this.getCell(x + sideOffset, y - forwardOffset);
    if (dir === 'E') return this.getCell(x + forwardOffset, y + sideOffset);
    if (dir === 'S') return this.getCell(x - sideOffset, y + forwardOffset);
    return this.getCell(x - forwardOffset, y - sideOffset);
  }

  /**
   * 線分バッファへ1本追加する。
   * @param x1 始点X
   * @param y1 始点Y
   * @param x2 終点X
   * @param y2 終点Y
   * @param width 線幅
   * @param part デバッグ識別名
   * @param depth 奥行き深度
   */
  private pushLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width = 2,
    part = 'unknown',
    depth = 0
  ) {
    this.lines.push({ x1, y1, x2, y2, width, part, depth });
  }

  /**
   * 壁面ポリゴンを面バッファへ追加する。
   * @param points ポリゴン頂点文字列（x,yの空白区切り）
   * @param depth 奥行き深度
   * @param part デバッグ識別名
   */
  private pushFace(points: string, depth: number, part: string) {
    const fill = this.wallFillByDepth[Math.min(depth, this.wallFillByDepth.length - 1)];
    this.faces.push({ points, fill, part, depth });
  }

  /**
   * 床ハイライトをバッファへ追加する。
   * @param points ポリゴン頂点文字列（x,yの空白区切り）
   * @param fill 塗り色
   * @param depth 奥行き深度
   * @param part デバッグ識別名
   */
  private pushFloorPatch(points: string, fill: string, depth: number, part: string) {
    this.floorPatches.push({ points, fill, depth, part });
  }

  /**
   * 正面壁（矩形）を描画する。
   * @param perspective 描画対象奥行きの基準点
   * @param depth 奥行き深度
   */
  private drawFrontWall(perspective: DepthPerspective, depth: number) {
    const left = perspective.left;
    const right = perspective.right;
    this.pushFace(
      `${this.toSvgPoint(left.ceiling)} ${this.toSvgPoint(right.ceiling)} ${this.toSvgPoint(right.floor)} ${this.toSvgPoint(left.floor)}`,
      depth,
      'front-face'
    );
    this.pushLine(left.ceiling.x, left.ceiling.y, right.ceiling.x, right.ceiling.y, 2.2, 'front-top', depth);
    this.pushLine(left.floor.x, left.floor.y, right.floor.x, right.floor.y, 2.2, 'front-bottom', depth);
    this.pushLine(left.ceiling.x, left.ceiling.y, left.floor.x, left.floor.y, 2.2, 'front-left', depth);
    this.pushLine(
      right.ceiling.x,
      right.ceiling.y,
      right.floor.x,
      right.floor.y,
      2.2,
      'front-right',
      depth
    );
  }

  /**
   * 側方通路の奥にある正面壁を可視範囲内で探索して描画する。
   * @param side 探索対象側（left/right）
   * @param startDepth 探索開始する奥行き（現在depthの次）
   * @param actions デバッグ用アクション記録先
   */
  private drawDeeperSideFrontWall(
    side: 'left' | 'right',
    startDepth: number,
    actions: string[]
  ) {
    const sideOffset = side === 'left' ? -1 : 1;

    for (let depth = startDepth; depth < this.viewDepth; depth++) {
      const cell = this.getRelativeCell(sideOffset, depth);
      if (!cell) break;
      const frontClosed = cell.walls[this.player.dir];
      // 通路が続く間はさらに奥を探索する。
      if (!frontClosed) continue;

      const perspective = this.perspectiveByDepthKey[this.getDepthKey(depth + 1)];
      const markerPoint = this.drawSideFrontWall(side, perspective, depth);
      const markerSize = Math.max(7, 14 - depth * 2.1);
      this.pushMarkerForCell(cell, markerPoint.centerX, markerPoint.centerY, markerSize, depth);
      actions.push(`drawSideFrontWall(${side},deeperDepth=${depth})`);
      break;
    }
  }

  /**
   * 対象セルの属性に応じて床色を返す。
   * @param cell 判定対象セル
   * @returns 床色。対象外セルはnull
   */
  private getCellFloorColor(cell: Cell | null): string | null {
    if (!cell) return null;
    if (cell.x === START.x && cell.y === START.y) return 'rgba(140, 230, 255, 0.24)';
    if (cell.x === GOAL.x && cell.y === GOAL.y) {
      return this.goalActive ? 'rgba(203, 255, 217, 0.24)' : 'rgba(255, 159, 159, 0.24)';
    }
    const checkpointKey = toCheckpointKey(cell.x, cell.y);
    if (this.checkpointKeySet.has(checkpointKey)) {
      return this.passedCheckpointKeys.has(checkpointKey)
        ? 'rgba(123, 181, 138, 0.24)'
        : 'rgba(255, 217, 140, 0.24)';
    }
    return null;
  }

  /**
   * 指定レーンの床へ対象セル色のハイライトを描画する。
   * @param cell 対象セル
   * @param lane 描画対象レーン（left/center/right）
   * @param nearPerspective 手前奥行きの基準点
   * @param farPerspective 奥奥行きの基準点
   * @param depth 奥行き深度
   */
  private pushFloorPatchForLane(
    cell: Cell | null,
    lane: FloorLane,
    nearPerspective: DepthPerspective,
    farPerspective: DepthPerspective,
    depth: number
  ) {
    const floorColor = this.getCellFloorColor(cell);
    if (!floorColor) return;
    const nearBounds = this.getNearLaneFloorBounds(nearPerspective, lane, depth);
    const farBounds = this.getLaneFloorBounds(farPerspective, lane);
    // 床頂点は壁境界座標にそのまま合わせ、座標ズレを作らない。
    const nearLeftX = nearBounds.left.x;
    const nearLeftY = nearBounds.left.y;
    const nearRightX = nearBounds.right.x;
    const nearRightY = nearBounds.right.y;
    const farLeftX = farBounds.left.x;
    const farLeftY = farBounds.left.y;
    const farRightX = farBounds.right.x;
    const farRightY = farBounds.right.y;
    this.pushFloorPatch(
      `${nearLeftX},${nearLeftY} ${nearRightX},${nearRightY} ${farRightX},${farRightY} ${farLeftX},${farLeftY}`,
      floorColor,
      depth,
      `${lane}-floor-highlight`
    );
  }

  /**
   * 手前側のレーン床境界点を返す。
   * @param perspective 参照元奥行きの基準点
   * @param lane 取得対象レーン（left/center/right）
   * @param depth 現在描画中の奥行き
   * @returns 手前側の床左右境界点
   */
  private getNearLaneFloorBounds(
    perspective: DepthPerspective,
    lane: FloorLane,
    depth: number
  ): { left: Point; right: Point } {
    // depth0は視点直近なので、側面壁の近端（wallNear）に合わせて下隙間を防ぐ。
    if (depth === 0) {
      if (lane === 'left') {
        return { left: perspective.outerLeft.floor, right: perspective.wallNearLeft.floor };
      }
      if (lane === 'right') {
        return { left: perspective.wallNearRight.floor, right: perspective.outerRight.floor };
      }
      return { left: perspective.wallNearLeft.floor, right: perspective.wallNearRight.floor };
    }

    return this.getLaneFloorBounds(perspective, lane);
  }

  /**
   * レーン別の床左右境界点を返す。
   * @param perspective 参照元奥行きの基準点
   * @param lane 取得対象レーン（left/center/right）
   * @returns 床面の左右境界点
   */
  private getLaneFloorBounds(
    perspective: DepthPerspective,
    lane: FloorLane
  ): { left: Point; right: Point } {
    if (lane === 'left') {
      return { left: perspective.outerLeft.floor, right: perspective.left.floor };
    }
    if (lane === 'right') {
      return { left: perspective.right.floor, right: perspective.outerRight.floor };
    }
    return { left: perspective.left.floor, right: perspective.right.floor };
  }

  /**
   * 側面壁（台形）を描画する。
   * @param side 描画対象側（left/right）
   * @param nearPerspective 手前奥行きの基準点
   * @param farPerspective 奥奥行きの基準点
   * @param depth 奥行き深度
   */
  private drawSideWall(
    side: 'left' | 'right',
    nearPerspective: DepthPerspective,
    farPerspective: DepthPerspective,
    depth: number
  ) {
    const partPrefix = `${side}-side-wall`;
    const near = side === 'left' ? nearPerspective.wallNearLeft : nearPerspective.wallNearRight;
    const far = side === 'left' ? farPerspective.left : farPerspective.right;

    this.pushFace(
      `${this.toSvgPoint(near.ceiling)} ${this.toSvgPoint(far.ceiling)} ${this.toSvgPoint(far.floor)} ${this.toSvgPoint(near.floor)}`,
      depth,
      `${partPrefix}-face`
    );
    this.pushLine(
      near.ceiling.x,
      near.ceiling.y,
      near.floor.x,
      near.floor.y,
      2.2,
      `${partPrefix}-near`,
      depth
    );
    this.pushLine(
      far.ceiling.x,
      far.ceiling.y,
      far.floor.x,
      far.floor.y,
      1.8,
      `${partPrefix}-far`,
      depth
    );
    this.pushLine(
      near.ceiling.x,
      near.ceiling.y,
      far.ceiling.x,
      far.ceiling.y,
      1.8,
      `${partPrefix}-top`,
      depth
    );
    this.pushLine(
      near.floor.x,
      near.floor.y,
      far.floor.x,
      far.floor.y,
      1.8,
      `${partPrefix}-bottom`,
      depth
    );
  }

  /**
   * 側面先に見える正面壁（独立矩形）を描画する。
   * @param side 描画対象側（left/right）
   * @param farPerspective 奥奥行きの基準点
   * @param depth 奥行き深度
   * @returns マーカー配置に使う矩形中心座標
   */
  private drawSideFrontWall(side: 'left' | 'right', farPerspective: DepthPerspective, depth: number) {
    const partPrefix = `${side}-side-front-wall`;
    const inner = side === 'left' ? farPerspective.left : farPerspective.right;
    const outer = side === 'left' ? farPerspective.outerLeft : farPerspective.outerRight;

    this.pushFace(
      `${this.toSvgPoint(inner.ceiling)} ${this.toSvgPoint(outer.ceiling)} ${this.toSvgPoint(outer.floor)} ${this.toSvgPoint(inner.floor)}`,
      depth,
      `${partPrefix}-face`
    );
    this.pushLine(
      inner.ceiling.x,
      inner.ceiling.y,
      inner.floor.x,
      inner.floor.y,
      1.8,
      `${partPrefix}-inner`,
      depth
    );
    this.pushLine(
      outer.ceiling.x,
      outer.ceiling.y,
      outer.floor.x,
      outer.floor.y,
      1.8,
      `${partPrefix}-outer`,
      depth
    );
    this.pushLine(
      inner.ceiling.x,
      inner.ceiling.y,
      outer.ceiling.x,
      outer.ceiling.y,
      1.8,
      `${partPrefix}-top`,
      depth
    );
    this.pushLine(
      inner.floor.x,
      inner.floor.y,
      outer.floor.x,
      outer.floor.y,
      1.8,
      `${partPrefix}-bottom`,
      depth
    );

    return {
      centerX: (inner.ceiling.x + outer.ceiling.x) / 2,
      centerY: (inner.ceiling.y + inner.floor.y) / 2,
    };
  }

  /**
   * セルがスタート/ゴール/チェックポイントなら対応マーカーを追加する。
   * @param cell 判定対象セル
   * @param x マーカー中心X
   * @param y マーカー中心Y
   * @param size マーカー半サイズ
   * @param depth 描画奥行き深度
   */
  private pushMarkerForCell(cell: Cell | null, x: number, y: number, size: number, depth: number) {
    if (!cell) return;
    if (cell.x === START.x && cell.y === START.y) this.markers.push({ x, y, size, depth, label: 'S' });
    if (cell.x === GOAL.x && cell.y === GOAL.y) {
      this.markers.push({ x, y, size, depth, label: 'G', goalActive: this.goalActive });
    }
    const checkpointKey = toCheckpointKey(cell.x, cell.y);
    const isCheckpoint = this.checkpointKeySet.has(checkpointKey);
    if (isCheckpoint) {
      const checkpointNumber = this.checkpointNumberMap.get(checkpointKey);
      this.markers.push({
        x,
        y,
        size: Math.max(6, size - 1),
        depth,
        label: 'C',
        checkpointNumber,
        checkpointPassed: this.passedCheckpointKeys.has(checkpointKey),
      });
    }
  }

  /**
   * デバッグ出力用にセル壁情報をコピーする。
   * @param cell 対象セル
   * @returns デバッグ向け壁情報。セルがない場合はnull
   */
  private toCellWallDebug(cell: Cell | null): CellWallDebug {
    if (!cell) return null;
    return { x: cell.x, y: cell.y, walls: { ...cell.walls } };
  }
}

/**
 * 3D描画用の投影データを生成する。
 * @param maze 投影元の迷路データ
 * @param player 投影基準のプレイヤー状態
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @returns 描画で直接使える投影結果
 */
export const createWireframeProjection = (
  maze: Maze,
  player: PlayerState,
  checkpoints: Checkpoint[],
  passedCheckpointKeys: Set<string>,
  goalActive: boolean
): WireframeProjection =>
  new WireframeProjectionBuilder(
    maze,
    player,
    checkpoints,
    passedCheckpointKeys,
    goalActive
  ).build();
