import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAMERA_MOVE_DURATION_MS,
  MAP_DEBUG_REVEAL_KEY,
  TIMER_INTERVAL_MS,
} from '../game/constants';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';
import { createGameField, createInitialVisitedCellKeys } from '../game/mazeFieldFactory';
import {
  isMoveControlKey,
  MoveControlKey,
  resolveNextPlayerState,
} from '../game/playerInputResolver';
import { appendPassedCheckpointKey, appendVisitedCellKey } from '../game/visitedSetUtils';
import {
  GoalExit,
  getInitialPlayerState,
  Maze,
  PlayerState,
} from '../mazeUtils';

// 画面コンポーネントへ返すゲーム制御値の型。
type MazeGameController = {
  maze: Maze;
  goalExit: GoalExit;
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
  lockedGoalAttemptCount: number;
  handleForward: () => void;
  handleTurnLeft: () => void;
  handleTurnRight: () => void;
  handleToggleHelpMap: () => void;
  handleRetry: () => void;
};

// ゲーム制御フックの設定値。
type MazeGameControllerOptions = {
  // ヘルプマップ中のデバッグ開示キー受付可否。falseでDキー無効化。
  enableMapDebugToggle?: boolean;
};

// ヘルプマップのデバッグ表示切替キー（大文字）。
const MAP_DEBUG_REVEAL_KEY_UPPER = MAP_DEBUG_REVEAL_KEY.toUpperCase();

/**
 * ゲーム状態（移動・タイマー・クリア判定）を一元管理するカスタムフック。
 * @param options キー操作設定（デバッグ開示キー受付可否など）
 * @returns 画面描画に必要な状態と操作ハンドラ
 */
export const useMazeGameController = (options?: MazeGameControllerOptions): MazeGameController => {
  const enableMapDebugToggle = options?.enableMapDebugToggle ?? true;
  // 迷路とチェックポイントを同一タイミングで初期生成する（初回のみ）。
  const initialField = useMemo(() => createGameField(), []);
  // 現在の迷路データ。
  const [maze, setMaze] = useState<Maze>(initialField.maze);
  // 現在ゲームのゴール出口。
  const [goalExit, setGoalExit] = useState<GoalExit>(initialField.goalExit);
  // 現在のプレイヤー位置と向き。
  const [player, setPlayer] = useState<PlayerState>(
    getInitialPlayerState(initialField.maze, initialField.startPosition)
  );
  // 現在ゲームに配置されたチェックポイント一覧。
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialField.checkpoints);
  // 訪問済みセルの座標キー集合。
  const [visitedCellKeys, setVisitedCellKeys] = useState<Set<string>>(
    () => createInitialVisitedCellKeys(initialField.startPosition)
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
  // 未解放ゴールへ出ようとした回数（表示トリガー用）。
  const [lockedGoalAttemptCount, setLockedGoalAttemptCount] = useState(0);
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

  const handleMoveControl = useCallback(
    /**
     * 共通の移動/回転入力を処理する。
     * @param key 実行する移動操作キー
     */
    (key: MoveControlKey) => {
      // ヘルプ表示中・クリア後は移動操作を止める。
      if (showHelpMap || finished) return;
      // カメラ移動中は次入力を受け付けない。
      if (Date.now() < inputLockUntilRef.current) return;

      const result = resolveNextPlayerState(key, player, maze, goalExit, goalActive);
      const next = result.nextPlayer;

      if (result.attemptedLockedGoal) {
        // 未解放時は外へ出さず、警告表示だけを出す。
        setLockedGoalAttemptCount((count) => count + 1);
      }
      if (result.reachedGoal) {
        setFinished(true);
      }

      if (next !== player) {
        // カメラ演出時間と同じdurationだけ次の矢印入力をロックする。
        inputLockUntilRef.current = Date.now() + CAMERA_MOVE_DURATION_MS;
        setPlayer(next);
        // 移動先セルを訪問済みへ追加し、ヘルプマップ開示対象として保持する。
        const nextCellKey = toCheckpointKey(next.x, next.y);
        setVisitedCellKeys((prev) => appendVisitedCellKey(prev, nextCellKey));
        // 新しい位置がチェックポイントなら通過済み集合へ追加する。
        setPassedCheckpointKeys((prev) => appendPassedCheckpointKey(prev, nextCellKey, checkpointKeySet));
        if (!startTime) setStartTime(Date.now());
      }
    },
    [checkpointKeySet, finished, goalActive, goalExit, maze, player, showHelpMap, startTime]
  );

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
      if (
        enableMapDebugToggle &&
        showHelpMap &&
        (e.key === MAP_DEBUG_REVEAL_KEY || e.key === MAP_DEBUG_REVEAL_KEY_UPPER)
      ) {
        e.preventDefault();
        if (!e.repeat) setRevealHiddenMapForDebug((visible) => !visible);
        return;
      }
      // ヘルプ表示中は移動操作を無効化する。
      if (showHelpMap) return;

      if (!isMoveControlKey(e.key)) return;
      e.preventDefault();
      handleMoveControl(e.key);
    },
    [enableMapDebugToggle, handleMoveControl, showHelpMap]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * 前進入力を実行する。
   */
  const handleForward = useCallback(() => {
    handleMoveControl('ArrowUp');
  }, [handleMoveControl]);

  /**
   * 左回転入力を実行する。
   */
  const handleTurnLeft = useCallback(() => {
    handleMoveControl('ArrowLeft');
  }, [handleMoveControl]);

  /**
   * 右回転入力を実行する。
   */
  const handleTurnRight = useCallback(() => {
    handleMoveControl('ArrowRight');
  }, [handleMoveControl]);

  /**
   * ヘルプマップ表示状態をトグルする。
   */
  const handleToggleHelpMap = useCallback(() => {
    setShowHelpMap((visible) => !visible);
  }, []);

  /**
   * ゲーム状態を初期化して新しい迷路を開始する。
   */
  const handleRetry = useCallback(() => {
    const nextField = createGameField();
    setMaze(nextField.maze);
    setCheckpoints(nextField.checkpoints);
    setGoalExit(nextField.goalExit);
    setVisitedCellKeys(createInitialVisitedCellKeys(nextField.startPosition));
    setRevealHiddenMapForDebug(false);
    setPassedCheckpointKeys(new Set());
    setPlayer(getInitialPlayerState(nextField.maze, nextField.startPosition));
    setStartTime(null);
    setElapsed(0);
    setFinished(false);
    setLockedGoalAttemptCount(0);
    setShowHelpMap(false);
    inputLockUntilRef.current = 0;
  }, []);

  return {
    maze,
    goalExit,
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
    lockedGoalAttemptCount,
    handleForward,
    handleTurnLeft,
    handleTurnRight,
    handleToggleHelpMap,
    handleRetry,
  };
};
