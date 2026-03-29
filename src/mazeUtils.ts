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
 * ゲーム開始時のプレイヤー初期状態を返す。
 * @returns 初期位置（左上）かつ東向きの状態
 */
export function getInitialPlayerState(): PlayerState {
  return { x: 0, y: 0, dir: 'E' };
}
