import React from 'react';
import { CompassOverlay } from './components/CompassOverlay';
import { HelpMap } from './components/HelpMap';
import { MazeView3D } from './components/MazeView3D';
import { GOAL_ACTIVE_COLOR, GOAL_INACTIVE_COLOR } from './game/constants';
import { toCheckpointKey } from './game/checkpointUtils';
import { VIEWPORT_WIDTH } from './game/WireframeProjection';
import { useMazeGameController } from './hooks/useMazeGameController';

/**
 * 迷路ゲームの画面レイアウトを構成する。
 * @returns 3Dビュー、ヘルプ、タイマーを含むゲームUI
 */
export default function MazeGame() {
  // ゲーム進行に必要な状態とハンドラをフックから取得する。
  const {
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
  } = useMazeGameController();

  return (
    <div
      style={{
        color: '#9df7b5',
        background: '#020503',
        minHeight: '100vh',
        textAlign: 'center',
        padding: 20,
        fontFamily: '"Courier New", "Lucida Console", monospace',
      }}
    >
      <h1 style={{ letterSpacing: 2, marginBottom: 14 }}>3D MAZE</h1>
      <div style={{ position: 'relative', width: VIEWPORT_WIDTH, margin: '0 auto' }}>
        <MazeView3D
          maze={maze}
          player={player}
          checkpoints={checkpoints}
          passedCheckpointKeys={passedCheckpointKeys}
          goalActive={goalActive}
          finished={finished}
        />
        <CompassOverlay dir={player.dir} />
        {showHelpMap && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(2, 5, 3, 0.88)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div>
              <HelpMap
                maze={maze}
                player={player}
                checkpoints={checkpoints}
                passedCheckpointKeys={passedCheckpointKeys}
                goalActive={goalActive}
              />
              <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: '#cbffd9' }}>H: CLOSE HELP MAP</p>
            </div>
          </div>
        )}
      </div>
      <div style={{ margin: '18px 0' }}>
        <span>TIME: {(elapsed / 1000).toFixed(2)} SEC</span>
        <span style={{ marginLeft: 16, color: goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR }}>
          GOAL: {goalActive ? 'ACTIVE' : 'LOCKED'}
        </span>
        <span style={{ marginLeft: 16, color: '#ffd98c' }}>
          CHECKPOINT: {passedCheckpointCount}/{checkpoints.length}
        </span>
        {finished && <span style={{ marginLeft: 16, color: '#cbffd9' }}>CLEAR</span>}
      </div>
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        <span style={{ color: '#7bb58a', marginRight: 8 }}>CP STATUS:</span>
        {checkpoints.map((checkpoint) => {
          // 通過済みかどうかを番号単位で表示する。
          const passed = passedCheckpointKeys.has(toCheckpointKey(checkpoint.x, checkpoint.y));
          return (
            <span
              key={`cp-status-${checkpoint.id}`}
              style={{ marginRight: 8, color: passed ? '#7bb58a' : '#ffd98c' }}
            >
              {checkpoint.id}
              {passed ? '✓' : ''}
            </span>
          );
        })}
      </div>
      <button
        onClick={handleRetry}
        style={{
          color: '#9df7b5',
          background: '#07160e',
          border: '1px solid #58d47f',
          padding: '8px 18px',
          fontFamily: '"Courier New", "Lucida Console", monospace',
          cursor: 'pointer',
        }}
      >
        RETRY
      </button>
      <div style={{ marginTop: 20 }}>
        <p>操作: ↑ 前進 / ← 左回転 / → 右回転</p>
        <p>H: ヘルプマップ表示切替</p>
        <p>ゴール: 右下隅まで到達</p>
      </div>
    </div>
  );
}
