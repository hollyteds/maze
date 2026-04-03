// 方角コード（北・東・南・西）。
export type Direction = 'N' | 'E' | 'S' | 'W';

// 迷路1セルの座標と壁情報。
export type Cell = {
  x: number;
  y: number;
  walls: { N: boolean; E: boolean; S: boolean; W: boolean };
};

// 2次元セル配列で表現する迷路本体。
export type Maze = Cell[][];

// 迷路セル座標を表す共通型。
export type MazePosition = {
  x: number;
  y: number;
};

// 迷路外への出口（ゴール）を表す座標と方向。
export type GoalExit = {
  x: number;
  y: number;
  dir: Direction;
};

/**
 * 深さ優先探索（再帰）で完全迷路を生成する。
 * @param width 迷路の横マス数
 * @param height 迷路の縦マス数
 * @returns 生成済み迷路データ
 */
export function generateMaze(width: number, height: number): Maze {
  // 生成対象の迷路配列。
  const maze: Maze = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        walls: { N: true, E: true, S: true, W: true },
      });
    }
    maze.push(row);
  }

  // DFSの訪問済み管理配列。
  const visited: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  // 4方向のX増分（N,E,S,W）。
  const dx = [0, 1, 0, -1];
  // 4方向のY増分（N,E,S,W）。
  const dy = [-1, 0, 1, 0];
  // 方向インデックスと壁キーの対応表。
  const dir: Direction[] = ['N', 'E', 'S', 'W'];

  /**
   * 配列をin-placeでシャッフルする。
   * @param array シャッフル対象配列
   * @returns シャッフル後配列
   */
  function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * 再帰的に通路を掘り進める。
   * @param x 現在セルのX座標
   * @param y 現在セルのY座標
   */
  function carve(x: number, y: number) {
    visited[y][x] = true;
    const dirs = shuffle([0, 1, 2, 3]);
    for (const i of dirs) {
      const nx = x + dx[i];
      const ny = y + dy[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
        maze[y][x].walls[dir[i]] = false;
        maze[ny][nx].walls[dir[(i + 2) % 4]] = false;
        carve(nx, ny);
      }
    }
  }

  carve(0, 0);
  return maze;
}

// プレイヤーの現在位置と向き。
export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
}

/**
 * セルの開通方向数（壁でない辺の数）を数える。
 * @param cell 判定対象セル
 * @returns 開いている方向の本数
 */
const countOpenPaths = (cell: Cell): number =>
  (cell.walls.N ? 0 : 1) +
  (cell.walls.E ? 0 : 1) +
  (cell.walls.S ? 0 : 1) +
  (cell.walls.W ? 0 : 1);

/**
 * セルが行き止まりかどうかを判定する。
 * @param cell 判定対象セル
 * @returns 通路1本のみなら true
 */
const isDeadEndCell = (cell: Cell): boolean => countOpenPaths(cell) === 1;

/**
 * セルが外周セルかどうかを判定する。
 * @param x セルX座標
 * @param y セルY座標
 * @param width 迷路の横マス数
 * @param height 迷路の縦マス数
 * @returns 外周セルなら true
 */
const isEdgeCell = (x: number, y: number, width: number, height: number): boolean =>
  x === 0 || x === width - 1 || y === 0 || y === height - 1;

/**
 * 外周セルから迷路外へ向かう方向一覧を返す。
 * @param x セルX座標
 * @param y セルY座標
 * @param width 迷路の横マス数
 * @param height 迷路の縦マス数
 * @returns 迷路外向き方向配列（1〜2要素）
 */
const getOutwardDirections = (
  x: number,
  y: number,
  width: number,
  height: number
): Direction[] => {
  const directions: Direction[] = [];
  if (y === 0) directions.push('N');
  if (x === width - 1) directions.push('E');
  if (y === height - 1) directions.push('S');
  if (x === 0) directions.push('W');
  return directions;
};

/**
 * 迷路内からランダムな開始座標を返す（行き止まり優先）。
 * @param maze 判定対象の迷路データ
 * @param excluded 選択対象から除外する座標
 * @returns 候補からランダムに選ばれた座標
 */
export function getRandomStartPosition(
  maze: Maze,
  excluded: ReadonlyArray<MazePosition>
): MazePosition {
  const height = maze.length;
  const width = maze[0]?.length ?? 0;
  if (height === 0 || width === 0) return { x: 0, y: 0 };

  const excludedKeys = new Set(excluded.map((point) => `${point.x},${point.y}`));
  const deadEndCandidates: MazePosition[] = [];
  const fallbackCandidates: MazePosition[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      if (excludedKeys.has(key)) continue;
      if (isDeadEndCell(maze[y][x])) {
        deadEndCandidates.push({ x, y });
      } else {
        fallbackCandidates.push({ x, y });
      }
    }
  }

  const selectionPool = deadEndCandidates.length > 0 ? deadEndCandidates : fallbackCandidates;
  if (selectionPool.length === 0) return { x: 0, y: 0 };
  return selectionPool[Math.floor(Math.random() * selectionPool.length)];
}

/**
 * 外周セルの壁を開けた先となるゴール出口を生成する（行き止まり優先はしない）。
 * @param maze 生成済み迷路データ（出口壁を直接開ける）
 * @param excluded 選択対象から除外する座標
 * @returns 出口セル座標と迷路外向き方向
 */
export function getRandomGoalExit(
  maze: Maze,
  excluded: ReadonlyArray<MazePosition>
): GoalExit {
  const height = maze.length;
  const width = maze[0]?.length ?? 0;
  if (height === 0 || width === 0) return { x: 0, y: 0, dir: 'N' };

  const excludedKeys = new Set(excluded.map((point) => `${point.x},${point.y}`));
  const edgeCandidates: MazePosition[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isEdgeCell(x, y, width, height)) continue;
      const key = `${x},${y}`;
      if (excludedKeys.has(key)) continue;
      edgeCandidates.push({ x, y });
    }
  }

  const fallback = edgeCandidates.length > 0 ? edgeCandidates : [{ x: 0, y: 0 }];
  const selectedCell = fallback[Math.floor(Math.random() * fallback.length)];
  const outwardDirections = getOutwardDirections(selectedCell.x, selectedCell.y, width, height);
  const selectedDirection =
    outwardDirections[Math.floor(Math.random() * outwardDirections.length)] ?? 'N';

  // 出口セルの外周壁を開けて、迷路外へ抜ける通路を作る。
  maze[selectedCell.y][selectedCell.x].walls[selectedDirection] = false;

  return { x: selectedCell.x, y: selectedCell.y, dir: selectedDirection };
}

/**
 * ゲーム開始時のプレイヤー初期状態を返す。
 * @param maze 生成済み迷路データ
 * @param start 開始セル座標
 * @returns 開始セル位置かつ開始セルで開いている方向を向いた状態
 */
export function getInitialPlayerState(maze: Maze, start: MazePosition): PlayerState {
  const cell = maze[start.y]?.[start.x];
  if (!cell) return { x: start.x, y: start.y, dir: 'E' };

  // 開通方向の優先順。複数開いている場合でも初期向きを安定させる。
  const directionPriority: Direction[] = ['N', 'E', 'S', 'W'];
  const openDirection = directionPriority.find((dir) => !cell.walls[dir]) ?? 'E';
  return { x: start.x, y: start.y, dir: openDirection };
}
