import { useCallback, useEffect, useMemo, useState } from 'react';
import { GOAL, MAZE_HEIGHT, MAZE_WIDTH, START } from '../game/constants';
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
  checkpoints: Checkpoint[];
  passedCheckpointKeys: Set<string>;
  passedCheckpointCount: number;
  goalActive: boolean;
  handleRetry: () => void;
};

// タイマーの更新間隔（ミリ秒）。細かすぎる再描画を避けつつ体感を維持する。
const TIMER_INTERVAL_MS = 50;

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
      // ヘルプ表示中は移動操作を無効化する。
      if (showHelpMap) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
      }
      // クリア後は状態変化を止める。
      if (finished) return;

      let next = player;
      if (e.key === 'ArrowUp') next = moveForward(player, maze);
      if (e.key === 'ArrowLeft') next = { ...player, dir: rotate(player.dir, 'left') };
      if (e.key === 'ArrowRight') next = { ...player, dir: rotate(player.dir, 'right') };

      if (next !== player) {
        setPlayer(next);
        // 新しい位置がチェックポイントなら通過済み集合へ追加する。
        const checkpointKey = toCheckpointKey(next.x, next.y);
        setPassedCheckpointKeys((prev) => {
          if (!checkpointKeySet.has(checkpointKey) || prev.has(checkpointKey)) {
            return prev;
          }
          const updated = new Set(prev);
          updated.add(checkpointKey);
          return updated;
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
    setPassedCheckpointKeys(new Set());
    setPlayer(getInitialPlayerState());
    setStartTime(null);
    setElapsed(0);
    setFinished(false);
    setShowHelpMap(false);
  }, []);

  return {
    maze,
    player,
    elapsed,
    finished,
    showHelpMap,
    checkpoints,
    passedCheckpointKeys,
    passedCheckpointCount,
    goalActive,
    handleRetry,
  };
};
