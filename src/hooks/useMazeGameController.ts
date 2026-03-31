import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAMERA_MOVE_DURATION_MS,
  GOAL,
  MAP_DEBUG_REVEAL_KEY,
  MAZE_HEIGHT,
  MAZE_WIDTH,
  START,
  TIMER_INTERVAL_MS,
} from '../game/constants';
import { Checkpoint, generateCheckpoints, toCheckpointKey } from '../game/checkpointUtils';
import { moveForward, rotate } from '../game/playerActions';
import { generateMaze, getInitialPlayerState, Maze, PlayerState } from '../mazeUtils';

// 画面コンポーネントへ返すゲーム制御値の型。
type MazeGameController = {
  maze: Maze;
  player: PlayerState;
  elapsed: number;
  finished: boolean;
  showHelpMap: boolean;
  visitedCellKeys: Set<string>;
  revealHiddenMapForDebug: boolean;
  checkpoints: Checkpoint[];
  passedCheckpointKeys: Set<string>;
  passedCheckpointCount: number;
  goalActive: boolean;
  handleRetry: () => void;
};

// ヘルプマップのデバッグ表示切替キー（大文字）。
const MAP_DEBUG_REVEAL_KEY_UPPER = MAP_DEBUG_REVEAL_KEY.toUpperCase();

/**
 * 移動/回転に使う矢印キーかどうかを判定する。
 * @param key キー入力文字列
 * @returns 移動入力に使う矢印キーならtrue
 */
const isMoveControlKey = (key: string): boolean =>
  key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowRight';

/**
 * キー入力から次のプレイヤー状態を計算する。
 * @param key 押下キー
 * @param player 現在のプレイヤー状態
 * @param maze 迷路データ
 * @returns 移動/回転後の状態（対象外キーなら現状を返す）
 */
const resolveNextPlayerState = (
  key: string,
  player: PlayerState,
  maze: Maze
): PlayerState => {
  if (key === 'ArrowUp') return moveForward(player, maze);
  if (key === 'ArrowLeft') return { ...player, dir: rotate(player.dir, 'left') };
  if (key === 'ArrowRight') return { ...player, dir: rotate(player.dir, 'right') };
  return player;
};

/**
 * 訪問済みセル集合へセルキーを追加する。
 * @param previous 既存の訪問済みセル集合
 * @param cellKey 追加対象のセルキー
 * @returns 更新後集合（既存なら同一参照を返す）
 */
const appendVisitedCellKey = (previous: Set<string>, cellKey: string): Set<string> => {
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
const appendPassedCheckpointKey = (
  previous: Set<string>,
  cellKey: string,
  checkpointKeySet: Set<string>
): Set<string> => {
  if (!checkpointKeySet.has(cellKey) || previous.has(cellKey)) return previous;
  const updated = new Set(previous);
  updated.add(cellKey);
  return updated;
};

/**
 * 初期ゲーム状態（迷路とチェックポイント）を生成する。
 * @returns 新規迷路とチェックポイント配列
 */
const createGameField = (): { maze: Maze; checkpoints: Checkpoint[] } => {
  const maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT);
  const checkpoints = generateCheckpoints(maze, [GOAL, START]);
  return { maze, checkpoints };
};

/**
 * 訪問済みセル集合の初期値（STARTのみ）を返す。
 * @returns START座標キーだけを含む集合
 */
const createInitialVisitedCellKeys = (): Set<string> =>
  new Set([toCheckpointKey(START.x, START.y)]);

/**
 * ゲーム状態（移動・タイマー・クリア判定）を一元管理するカスタムフック。
 * @returns 画面描画に必要な状態と操作ハンドラ
 */
export const useMazeGameController = (): MazeGameController => {
  // 迷路とチェックポイントを同一タイミングで初期生成する（初回のみ）。
  const initialField = useMemo(() => createGameField(), []);
  // 現在の迷路データ。
  const [maze, setMaze] = useState<Maze>(initialField.maze);
  // 現在のプレイヤー位置と向き。
  const [player, setPlayer] = useState<PlayerState>(getInitialPlayerState());
  // 現在ゲームに配置されたチェックポイント一覧。
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialField.checkpoints);
  // 訪問済みセルの座標キー集合。
  const [visitedCellKeys, setVisitedCellKeys] = useState<Set<string>>(
    createInitialVisitedCellKeys
  );
  // ヘルプマップで隠し領域を開示するデバッグ表示フラグ。
  const [revealHiddenMapForDebug, setRevealHiddenMapForDebug] = useState(false);
  // 通過済みチェックポイントの座標キー集合。
  const [passedCheckpointKeys, setPassedCheckpointKeys] = useState<Set<string>>(() => new Set());
  // スタート時刻。未開始時は null。
  const [startTime, setStartTime] = useState<number | null>(null);
  // 経過時間（ミリ秒）。
  const [elapsed, setElapsed] = useState(0);
  // ゴール到達済みかどうか。
  const [finished, setFinished] = useState(false);
  // ヘルプマップ表示状態。
  const [showHelpMap, setShowHelpMap] = useState(false);
  // 入力ロック解除時刻（エポックms）。カメラ移動中の連続入力を防ぐ。
  const inputLockUntilRef = useRef(0);

  // 通過済みチェックポイント数。
  const passedCheckpointCount = passedCheckpointKeys.size;
  // すべてのチェックポイント通過後のみゴール有効化する。
  const goalActive = checkpoints.length === 0 || passedCheckpointCount === checkpoints.length;
  // チェックポイント座標キーの存在判定を高速化する集合。
  const checkpointKeySet = useMemo(
    () => new Set(checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y))),
    [checkpoints]
  );

  // 開始後かつ未クリア時のみタイマー更新を行う。
  useEffect(() => {
    if (!startTime || finished) return;
    const timer = setInterval(() => setElapsed(Date.now() - startTime), TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [startTime, finished]);

  // ゴール有効化後にプレイヤー座標がゴールへ一致したらクリア状態へ遷移させる。
  useEffect(() => {
    if (goalActive && player.x === GOAL.x && player.y === GOAL.y && !finished) {
      setFinished(true);
    }
  }, [player, goalActive, finished]);

  const handleKeyDown = useCallback(
    /**
     * キーボード入力を処理する。
     * @param e キー押下イベント
     */
    (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        if (!e.repeat) setShowHelpMap((visible) => !visible);
        return;
      }
      // ヘルプマップ表示中のみデバッグ開示トグルを受け付ける。
      if (showHelpMap && (e.key === MAP_DEBUG_REVEAL_KEY || e.key === MAP_DEBUG_REVEAL_KEY_UPPER)) {
        e.preventDefault();
        if (!e.repeat) setRevealHiddenMapForDebug((visible) => !visible);
        return;
      }
      // ヘルプ表示中は移動操作を無効化する。
      if (showHelpMap) return;

      if (isMoveControlKey(e.key)) {
        e.preventDefault();
      }
      // カメラ移動中は矢印操作を無効化し、視覚移動完了まで入力を待たせる。
      if (isMoveControlKey(e.key) && Date.now() < inputLockUntilRef.current) {
        return;
      }
      // クリア後は状態変化を止める。
      if (finished) return;

      const next = resolveNextPlayerState(e.key, player, maze);

      if (next !== player) {
        // カメラ演出時間と同じdurationだけ次の矢印入力をロックする。
        inputLockUntilRef.current = Date.now() + CAMERA_MOVE_DURATION_MS;
        setPlayer(next);
        // 移動先セルを訪問済みへ追加し、ヘルプマップ開示対象として保持する。
        const nextCellKey = toCheckpointKey(next.x, next.y);
        setVisitedCellKeys((prev) => {
          return appendVisitedCellKey(prev, nextCellKey);
        });
        // 新しい位置がチェックポイントなら通過済み集合へ追加する。
        setPassedCheckpointKeys((prev) => {
          return appendPassedCheckpointKey(prev, nextCellKey, checkpointKeySet);
        });
        if (!startTime) setStartTime(Date.now());
      }
    },
    [checkpointKeySet, finished, maze, player, showHelpMap, startTime]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * ゲーム状態を初期化して新しい迷路を開始する。
   */
  const handleRetry = useCallback(() => {
    const nextField = createGameField();
    setMaze(nextField.maze);
    setCheckpoints(nextField.checkpoints);
    setVisitedCellKeys(createInitialVisitedCellKeys());
    setRevealHiddenMapForDebug(false);
    setPassedCheckpointKeys(new Set());
    setPlayer(getInitialPlayerState());
    setStartTime(null);
    setElapsed(0);
    setFinished(false);
    setShowHelpMap(false);
    inputLockUntilRef.current = 0;
  }, []);

  return {
    maze,
    player,
    elapsed,
    finished,
    showHelpMap,
    visitedCellKeys,
    revealHiddenMapForDebug,
    checkpoints,
    passedCheckpointKeys,
    passedCheckpointCount,
    goalActive,
    handleRetry,
  };
};
