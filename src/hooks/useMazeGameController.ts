import { useCallback, useEffect, useState } from 'react';
import { GOAL, MAZE_HEIGHT, MAZE_WIDTH } from '../game/constants';
import { moveForward, rotate } from '../game/playerActions';
import { generateMaze, getInitialPlayerState, Maze, PlayerState } from '../mazeUtils';

// 画面コンポーネントへ返すゲーム制御値の型。
type MazeGameController = {
  maze: Maze;
  player: PlayerState;
  elapsed: number;
  finished: boolean;
  showHelpMap: boolean;
  handleRetry: () => void;
};

// タイマーの更新間隔（ミリ秒）。細かすぎる再描画を避けつつ体感を維持する。
const TIMER_INTERVAL_MS = 50;

/**
 * ゲーム状態（移動・タイマー・クリア判定）を一元管理するカスタムフック。
 * @returns 画面描画に必要な状態と操作ハンドラ
 */
export const useMazeGameController = (): MazeGameController => {
  // 現在の迷路データ。
  const [maze, setMaze] = useState<Maze>(() => generateMaze(MAZE_WIDTH, MAZE_HEIGHT));
  // 現在のプレイヤー位置と向き。
  const [player, setPlayer] = useState<PlayerState>(getInitialPlayerState());
  // スタート時刻。未開始時は null。
  const [startTime, setStartTime] = useState<number | null>(null);
  // 経過時間（ミリ秒）。
  const [elapsed, setElapsed] = useState(0);
  // ゴール到達済みかどうか。
  const [finished, setFinished] = useState(false);
  // ヘルプマップ表示状態。
  const [showHelpMap, setShowHelpMap] = useState(false);

  // 開始後かつ未クリア時のみタイマー更新を行う。
  useEffect(() => {
    if (!startTime || finished) return;
    const timer = setInterval(() => setElapsed(Date.now() - startTime), TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [startTime, finished]);

  // プレイヤー座標がゴールに一致したらクリア状態へ遷移させる。
  useEffect(() => {
    if (player.x === GOAL.x && player.y === GOAL.y && !finished) {
      setFinished(true);
    }
  }, [player, finished]);

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
        if (!startTime) setStartTime(Date.now());
      }
    },
    [finished, maze, player, showHelpMap, startTime]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * ゲーム状態を初期化して新しい迷路を開始する。
   */
  const handleRetry = useCallback(() => {
    setMaze(generateMaze(MAZE_WIDTH, MAZE_HEIGHT));
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
    handleRetry,
  };
};
