// 30マスあたり1つ配置するための基準値。
export const CELLS_PER_CHECKPOINT = 30;

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
 * 指定要素を除外した候補座標をシャッフルし、必要数のチェックポイントを返す。
 * @param width 迷路の横マス数
 * @param height 迷路の縦マス数
 * @param excluded 配置禁止セル（例: START/GOAL）
 * @returns ランダム配置されたチェックポイント配列
 */
export const generateCheckpoints = (
  width: number,
  height: number,
  excluded: ReadonlyArray<{ x: number; y: number }>
): Checkpoint[] => {
  // 配置禁止セルを高速判定するためのキー集合。
  const excludedKeys = new Set(excluded.map((point) => toCheckpointKey(point.x, point.y)));

  // チェックポイント候補となる全座標を列挙する。
  const candidates: Checkpoint[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = toCheckpointKey(x, y);
      if (!excludedKeys.has(key)) {
        // idは抽出後に採番するため、ここでは仮値を入れる。
        candidates.push({ id: 0, x, y });
      }
    }
  }

  // フィッシャー・イェーツ法で候補順をランダム化する。
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // 候補不足時は存在数までに丸める。
  const checkpointCount = Math.min(candidates.length, getCheckpointCount(width, height));
  // 抽出順に1始まりの番号を割り当てる。
  return candidates.slice(0, checkpointCount).map((checkpoint, index) => ({
    ...checkpoint,
    id: index + 1,
  }));
};
