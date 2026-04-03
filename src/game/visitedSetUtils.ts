/**
 * 訪問済みセル集合へセルキーを追加する。
 * @param previous 既存の訪問済みセル集合
 * @param cellKey 追加対象のセルキー
 * @returns 更新後集合（既存なら同一参照を返す）
 */
export const appendVisitedCellKey = (previous: Set<string>, cellKey: string): Set<string> => {
  if (previous.has(cellKey)) return previous;
  const updated = new Set(previous);
  updated.add(cellKey);
  return updated;
};

/**
 * 通過済みチェックポイント集合へセルキーを追加する。
 * @param previous 既存の通過済みチェックポイント集合
 * @param cellKey 判定対象のセルキー
 * @param checkpointKeySet 全チェックポイントのキー集合
 * @returns 更新後集合（対象外/既存なら同一参照を返す）
 */
export const appendPassedCheckpointKey = (
  previous: Set<string>,
  cellKey: string,
  checkpointKeySet: Set<string>
): Set<string> => {
  if (!checkpointKeySet.has(cellKey) || previous.has(cellKey)) return previous;
  const updated = new Set(previous);
  updated.add(cellKey);
  return updated;
};
