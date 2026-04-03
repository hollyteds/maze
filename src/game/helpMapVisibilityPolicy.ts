import {
  HelpMapCheckpointVisibilityMode,
  HelpMapGoalVisibilityMode,
  HELP_MAP_CHECKPOINT_VISIBILITY_MODES,
  HELP_MAP_GOAL_VISIBILITY_MODES,
} from './constants';

// ヘルプマップ表示可否を判定する入力値。
type HelpMapVisibilityPolicyParams = {
  // デバッグ開示が有効かどうか。
  revealHiddenMapForDebug: boolean;
  // 通常時のチェックポイント表示モード。
  checkpointVisibilityMode: HelpMapCheckpointVisibilityMode;
  // 通常時のゴール表示モード。
  goalVisibilityMode: HelpMapGoalVisibilityMode;
};

// ゴール表示判定に必要な進行状態。
type GoalVisibilityState = {
  // ゴールに面した外周セルを通過済みかどうか。
  passedGoalEdgeCell: boolean;
  // チェックポイント通過によりゴールが解放済みかどうか。
  goalActive: boolean;
  // クリア済みかどうか。
  finished: boolean;
};

/**
 * ヘルプマップの表示可否ルールを集約するポリシークラス。
 * 条件分岐をコンポーネント外へ逃がして、描画側の可読性を維持する。
 */
export class HelpMapVisibilityPolicy {
  // デバッグ開示状態。
  private readonly revealHiddenMapForDebug: boolean;
  // 通常時のチェックポイント表示モード。
  private readonly checkpointVisibilityMode: HelpMapCheckpointVisibilityMode;
  // 通常時のゴール表示モード。
  private readonly goalVisibilityMode: HelpMapGoalVisibilityMode;

  /**
   * 表示判定ポリシーを初期化する。
   * @param params デバッグ状態と各表示モード
   */
  constructor(params: HelpMapVisibilityPolicyParams) {
    this.revealHiddenMapForDebug = params.revealHiddenMapForDebug;
    this.checkpointVisibilityMode = params.checkpointVisibilityMode;
    this.goalVisibilityMode = params.goalVisibilityMode;
  }

  /**
   * チェックポイントを表示するか判定する。
   * @param passed 対象チェックポイントが通過済みか
   * @returns 表示対象なら true
   */
  shouldShowCheckpoint(passed: boolean): boolean {
    if (this.revealHiddenMapForDebug) return true;
    if (this.checkpointVisibilityMode === HELP_MAP_CHECKPOINT_VISIBILITY_MODES.ALL) return true;
    return passed;
  }

  /**
   * ゴール表示を行うか判定する。
   * @param state 出口セル通過/解放/クリアの進行状態
   * @returns 表示対象なら true
   */
  shouldShowGoal(state: GoalVisibilityState): boolean {
    if (this.revealHiddenMapForDebug) return true;
    if (this.goalVisibilityMode === HELP_MAP_GOAL_VISIBILITY_MODES.ALWAYS) return true;
    if (this.goalVisibilityMode === HELP_MAP_GOAL_VISIBILITY_MODES.PASSED_ONLY) {
      return state.passedGoalEdgeCell;
    }
    if (this.goalVisibilityMode === HELP_MAP_GOAL_VISIBILITY_MODES.ACTIVE_OR_CLEARED) {
      return state.goalActive || state.finished;
    }
    return state.finished;
  }
}
