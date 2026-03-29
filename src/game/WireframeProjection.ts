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

// ワイヤーフレーム線分の描画情報。
export type WireLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  part: string;
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

class WireframeProjectionBuilder {
  // 最大可視深度（前方3マス）。
  private readonly viewDepth = 3;
  // 奥行きごとの壁塗り色。
  private readonly wallFillByDepth = ['#0b2117', '#091b13', '#07160f'];
  // 疑似透視に使うフレーム定義（手前→奥）。
  private readonly frames: Frame[] = [
    { left: 38, right: 482, top: 26, bottom: 354 },
    { left: 110, right: 410, top: 68, bottom: 318 },
    { left: 166, right: 354, top: 102, bottom: 289 },
    { left: 206, right: 314, top: 128, bottom: 266 },
  ];
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
    this.checkpointKeySet = new Set(
      checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y))
    );
    this.checkpointNumberMap = new Map(
      checkpoints.map((checkpoint) => [
        toCheckpointKey(checkpoint.x, checkpoint.y),
        checkpoint.id,
      ])
    );
  }

  /**
   * 迷路状態から3Dワイヤーフレーム描画データを生成する。
   * @returns 線・面・マーカー・判定ログを含む投影結果
   */
  build(): WireframeProjection {
    // depthごとに「中央セル・左右セル」を評価して壁を組み立てる。
    for (let depth = 0; depth < this.viewDepth; depth++) {
      const nearFrame = this.frames[depth];
      const farFrame = this.frames[depth + 1];
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
        this.drawFrontWall(farFrame, depth);
        break;
      }

      const centerX = (farFrame.left + farFrame.right) / 2;
      const centerY = farFrame.bottom - (farFrame.bottom - farFrame.top) * 0.38;
      const centerSize = Math.max(8, 16 - depth * 2.2);
      this.pushCenterFloorPatch(cell, nearFrame, farFrame, depth);
      this.pushMarkerForCell(cell, centerX, centerY, centerSize);

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

      // 正面が閉じている場合、このdepthで遮蔽されるため描画を確定して終了する。
      if (frontClosed) {
        if (shouldDrawLeftSideWall) {
          this.drawSideWall('left', nearFrame, farFrame, depth, depth === 0);
          actions.push('drawSideWall(left)');
        }
        if (shouldDrawLeftSideFront) {
          const markerPoint = this.drawSideFrontWall('left', farFrame, depth);
          this.pushMarkerForCell(leftCell, markerPoint.centerX, markerPoint.centerY, sideSize);
          actions.push('drawSideFrontWall(left)');
        }
        if (shouldDrawRightSideWall) {
          this.drawSideWall('right', nearFrame, farFrame, depth, depth === 0);
          actions.push('drawSideWall(right)');
        }
        if (shouldDrawRightSideFront) {
          const markerPoint = this.drawSideFrontWall('right', farFrame, depth);
          this.pushMarkerForCell(rightCell, markerPoint.centerX, markerPoint.centerY, sideSize);
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
          actions: [...actions, 'drawFrontWall(frontClosed)'],
        });
        this.drawFrontWall(farFrame, depth);
        break;
      }

      if (shouldDrawLeftSideWall) {
        this.drawSideWall('left', nearFrame, farFrame, depth, depth === 0);
        actions.push('drawSideWall(left)');
      }
      if (shouldDrawLeftSideFront) {
        const markerPoint = this.drawSideFrontWall('left', farFrame, depth);
        this.pushMarkerForCell(leftCell, markerPoint.centerX, markerPoint.centerY, sideSize);
        actions.push('drawSideFrontWall(left)');
      }
      if (shouldDrawRightSideWall) {
        this.drawSideWall('right', nearFrame, farFrame, depth, depth === 0);
        actions.push('drawSideWall(right)');
      }
      if (shouldDrawRightSideFront) {
        const markerPoint = this.drawSideFrontWall('right', farFrame, depth);
        this.pushMarkerForCell(rightCell, markerPoint.centerX, markerPoint.centerY, sideSize);
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
   */
  private pushLine(x1: number, y1: number, x2: number, y2: number, width = 2, part = 'unknown') {
    this.lines.push({ x1, y1, x2, y2, width, part });
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
   * @param frame 描画対象フレーム
   * @param depth 奥行き深度
   */
  private drawFrontWall(frame: Frame, depth: number) {
    this.pushFace(
      `${frame.left},${frame.top} ${frame.right},${frame.top} ${frame.right},${frame.bottom} ${frame.left},${frame.bottom}`,
      depth,
      'front-face'
    );
    this.pushLine(frame.left, frame.top, frame.right, frame.top, 2.2, 'front-top');
    this.pushLine(frame.left, frame.bottom, frame.right, frame.bottom, 2.2, 'front-bottom');
    this.pushLine(frame.left, frame.top, frame.left, frame.bottom, 2.2, 'front-left');
    this.pushLine(frame.right, frame.top, frame.right, frame.bottom, 2.2, 'front-right');
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
   * 中央通路の床へ対象セル色のハイライトを描画する。
   * @param cell 対象セル
   * @param nearFrame 手前フレーム
   * @param farFrame 奥フレーム
   * @param depth 奥行き深度
   */
  private pushCenterFloorPatch(cell: Cell | null, nearFrame: Frame, farFrame: Frame, depth: number) {
    const floorColor = this.getCellFloorColor(cell);
    if (!floorColor) return;
    const nearInset = (nearFrame.right - nearFrame.left) * 0.16;
    const farInset = (farFrame.right - farFrame.left) * 0.16;
    const nearY = nearFrame.bottom - 3;
    const farY = farFrame.bottom - 3;
    this.pushFloorPatch(
      `${nearFrame.left + nearInset},${nearY} ${nearFrame.right - nearInset},${nearY} ${farFrame.right - farInset},${farY} ${farFrame.left + farInset},${farY}`,
      floorColor,
      depth,
      'center-floor-highlight'
    );
  }

  /**
   * 側面壁（台形）を描画する。
   * @param side 描画対象側（left/right）
   * @param nearFrame 手前フレーム
   * @param farFrame 奥フレーム
   * @param depth 奥行き深度
   * @param flushToCanvas 最手前辺を画面端に吸着するか
   */
  private drawSideWall(
    side: 'left' | 'right',
    nearFrame: Frame,
    farFrame: Frame,
    depth: number,
    flushToCanvas = false
  ) {
    const partPrefix = `${side}-side-wall`;
    const baseNearX = side === 'left' ? nearFrame.left : nearFrame.right;
    const nearX = flushToCanvas ? (side === 'left' ? 2 : VIEWPORT_WIDTH - 2) : baseNearX;
    const farX = side === 'left' ? farFrame.left : farFrame.right;

    let nearTop = nearFrame.top;
    let nearBottom = nearFrame.bottom;
    if (flushToCanvas && farX !== baseNearX) {
      const t = (nearX - baseNearX) / (farX - baseNearX);
      nearTop = nearFrame.top + (farFrame.top - nearFrame.top) * t;
      nearBottom = nearFrame.bottom + (farFrame.bottom - nearFrame.bottom) * t;
      nearTop = Math.max(2, nearTop);
      nearBottom = Math.min(VIEWPORT_HEIGHT - 2, nearBottom);
    }

    this.pushFace(
      `${nearX},${nearTop} ${farX},${farFrame.top} ${farX},${farFrame.bottom} ${nearX},${nearBottom}`,
      depth,
      `${partPrefix}-face`
    );
    this.pushLine(nearX, nearTop, nearX, nearBottom, 2.2, `${partPrefix}-near`);
    this.pushLine(farX, farFrame.top, farX, farFrame.bottom, 1.8, `${partPrefix}-far`);
    this.pushLine(nearX, nearTop, farX, farFrame.top, 1.8, `${partPrefix}-top`);
    this.pushLine(nearX, nearBottom, farX, farFrame.bottom, 1.8, `${partPrefix}-bottom`);
  }

  /**
   * 側面先に見える正面壁（独立矩形）を描画する。
   * @param side 描画対象側（left/right）
   * @param farFrame 奥フレーム
   * @param depth 奥行き深度
   * @returns マーカー配置に使う矩形中心座標
   */
  private drawSideFrontWall(side: 'left' | 'right', farFrame: Frame, depth: number) {
    const partPrefix = `${side}-side-front-wall`;
    const innerX = side === 'left' ? farFrame.left : farFrame.right;
    // 左右マスの正面壁幅は同奥行きの中央正面壁幅と一致させる。
    const centerFrontWidth = farFrame.right - farFrame.left;
    const outerX = side === 'left' ? innerX - centerFrontWidth : innerX + centerFrontWidth;

    this.pushFace(
      `${innerX},${farFrame.top} ${outerX},${farFrame.top} ${outerX},${farFrame.bottom} ${innerX},${farFrame.bottom}`,
      depth,
      `${partPrefix}-face`
    );
    this.pushLine(innerX, farFrame.top, innerX, farFrame.bottom, 1.8, `${partPrefix}-inner`);
    this.pushLine(outerX, farFrame.top, outerX, farFrame.bottom, 1.8, `${partPrefix}-outer`);
    this.pushLine(innerX, farFrame.top, outerX, farFrame.top, 1.8, `${partPrefix}-top`);
    this.pushLine(innerX, farFrame.bottom, outerX, farFrame.bottom, 1.8, `${partPrefix}-bottom`);

    return {
      centerX: (innerX + outerX) / 2,
      centerY: (farFrame.top + farFrame.bottom) / 2,
    };
  }

  /**
   * セルがスタート/ゴール/チェックポイントなら対応マーカーを追加する。
   * @param cell 判定対象セル
   * @param x マーカー中心X
   * @param y マーカー中心Y
   * @param size マーカー半サイズ
   */
  private pushMarkerForCell(cell: Cell | null, x: number, y: number, size: number) {
    if (!cell) return;
    if (cell.x === START.x && cell.y === START.y) this.markers.push({ x, y, size, label: 'S' });
    if (cell.x === GOAL.x && cell.y === GOAL.y) {
      this.markers.push({ x, y, size, label: 'G', goalActive: this.goalActive });
    }
    const checkpointKey = toCheckpointKey(cell.x, cell.y);
    const isCheckpoint = this.checkpointKeySet.has(checkpointKey);
    if (isCheckpoint) {
      const checkpointNumber = this.checkpointNumberMap.get(checkpointKey);
      this.markers.push({
        x,
        y,
        size: Math.max(6, size - 1),
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
