import { Cell, Maze } from '../mazeUtils';

// 30マスあたり1つ配置するための基準値。
export const CELLS_PER_CHECKPOINT = 30;
// 袋小路判定に使う通路数。1本だけ開いていれば袋小路とみなす。
const OPEN_PATH_COUNT_FOR_DEAD_END = 1;

// チェックポイント座標を表す型。
export type Checkpoint = {
  // チェックポイント番号（1始まり）。
  id: number;
  // チェックポイントX座標。
  x: number;
  // チェックポイントY座標。
  y: number;
};

/**
 * 座標をセット管理しやすい文字列キーへ変換する。
 * @param x X座標
 * @param y Y座標
 * @returns "x,y" 形式の座標キー
 */
export const toCheckpointKey = (x: number, y: number): string => `${x},${y}`;

/**
 * チェックポイント設置数を計算する。
 * @param width 迷路の横マス数
 * @param height 迷路の縦マス数
 * @returns 30マスにつき1つの割合で算出した設置数（最低1）
 */
export const getCheckpointCount = (width: number, height: number): number =>
  Math.max(1, Math.floor((width * height) / CELLS_PER_CHECKPOINT));

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
 * セルが袋小路かどうかを判定する。
 * @param cell 判定対象セル
 * @returns 通路1本のみなら true
 */
const isDeadEndCell = (cell: Cell): boolean =>
  countOpenPaths(cell) === OPEN_PATH_COUNT_FOR_DEAD_END;

/**
 * 配列をフィッシャー・イェーツ法でランダム化する。
 * @param items ランダム化対象配列
 * @returns ランダム化後配列（同一参照）
 */
const shuffleInPlace = <T>(items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/**
 * 指定要素を除外し、袋小路を優先して必要数のチェックポイントを返す。
 * @param maze 迷路データ
 * @param excluded 配置禁止セル（例: スタート/ゴール）
 * @returns 袋小路優先で配置したチェックポイント配列
 */
export const generateCheckpoints = (
  maze: Maze,
  excluded: ReadonlyArray<{ x: number; y: number }>
): Checkpoint[] => {
  const height = maze.length;
  const width = maze[0]?.length ?? 0;
  if (height === 0 || width === 0) return [];

  // 配置禁止セルを高速判定するためのキー集合。
  const excludedKeys = new Set(excluded.map((point) => toCheckpointKey(point.x, point.y)));

  // チェックポイント候補を「袋小路」と「それ以外」に分けて列挙する。
  const deadEndCandidates: Checkpoint[] = [];
  const otherCandidates: Checkpoint[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = toCheckpointKey(x, y);
      if (excludedKeys.has(key)) continue;
      const candidate = { id: 0, x, y };
      if (isDeadEndCell(maze[y][x])) {
        deadEndCandidates.push(candidate);
      } else {
        otherCandidates.push(candidate);
      }
    }
  }

  // 袋小路候補・通常候補をそれぞれランダム化する。
  shuffleInPlace(deadEndCandidates);
  shuffleInPlace(otherCandidates);

  // 候補不足時は存在数までに丸める。
  const totalCandidates = deadEndCandidates.length + otherCandidates.length;
  const checkpointCount = Math.min(totalCandidates, getCheckpointCount(width, height));
  // 可能な限り袋小路から採用し、不足分だけ通常候補を補充する。
  const selectedDeadEnds = deadEndCandidates.slice(0, checkpointCount);
  const remainCount = checkpointCount - selectedDeadEnds.length;
  const selected = [
    ...selectedDeadEnds,
    ...otherCandidates.slice(0, remainCount),
  ];

  // 抽出順に1始まりの番号を割り当てる。
  return selected.map((checkpoint, index) => ({
    ...checkpoint,
    id: index + 1,
  }));
};
