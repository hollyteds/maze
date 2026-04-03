import { CSSProperties } from 'react';
import { GOAL_ACTIVE_COLOR, GOAL_INACTIVE_COLOR } from '../game/constants';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';

type GameStatusPanelProps = {
  // 経過時間（ミリ秒）。
  elapsed: number;
  // ゴール解放状態。
  goalActive: boolean;
  // 通過済みチェックポイント数。
  passedCheckpointCount: number;
  // 全チェックポイント座標一覧。
  checkpoints: Checkpoint[];
  // 通過済みチェックポイント座標キー集合。
  passedCheckpointKeys: Set<string>;
  // クリア済み状態。
  finished: boolean;
  // 外側コンテナに適用するスタイル。
  containerStyle?: CSSProperties;
  // 時間/ゴール/チェックポイント行に適用するスタイル。
  summaryStyle?: CSSProperties;
  // CPステータス行に適用するスタイル。
  checkpointStyle?: CSSProperties;
  // キー衝突回避用の接頭辞。
  keyPrefix?: string;
};

/**
 * 共通のゲーム進行ステータス表示（TIME/GOAL/CHECKPOINT/CP STATUS）を描画する。
 * @param elapsed 経過時間（ミリ秒）
 * @param goalActive ゴール解放状態
 * @param passedCheckpointCount 通過済みチェックポイント数
 * @param checkpoints 全チェックポイント座標一覧
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param finished クリア済み状態
 * @param containerStyle 外側コンテナへ適用するスタイル
 * @param summaryStyle サマリー行へ適用するスタイル
 * @param checkpointStyle CPステータス行へ適用するスタイル
 * @param keyPrefix キー衝突回避用の接頭辞
 * @returns 進行ステータス表示
 */
export function GameStatusPanel({
  elapsed,
  goalActive,
  passedCheckpointCount,
  checkpoints,
  passedCheckpointKeys,
  finished,
  containerStyle,
  summaryStyle,
  checkpointStyle,
  keyPrefix = 'game-status',
}: GameStatusPanelProps) {
  return (
    <div style={containerStyle}>
      <div style={summaryStyle}>
        <span>TIME: {(elapsed / 1000).toFixed(2)} SEC</span>
        <span style={{ marginLeft: 16, color: goalActive ? GOAL_ACTIVE_COLOR : GOAL_INACTIVE_COLOR }}>
          GOAL: {goalActive ? 'ACTIVE' : 'LOCKED'}
        </span>
        <span style={{ marginLeft: 16, color: '#ffd98c' }}>
          CHECKPOINT: {passedCheckpointCount}/{checkpoints.length}
        </span>
        {finished && <span style={{ marginLeft: 16, color: '#cbffd9' }}>CLEAR</span>}
      </div>
      <div style={checkpointStyle}>
        <span style={{ color: '#7bb58a', marginRight: 8 }}>CP STATUS:</span>
        {checkpoints.map((checkpoint) => {
          // 通過済みかどうかを番号単位で表示する。
          const passed = passedCheckpointKeys.has(toCheckpointKey(checkpoint.x, checkpoint.y));
          return (
            <span
              key={`${keyPrefix}-cp-${checkpoint.id}`}
              style={{ marginRight: 8, color: passed ? '#7bb58a' : '#ffd98c' }}
            >
              {checkpoint.id}
              {passed ? '✓' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
