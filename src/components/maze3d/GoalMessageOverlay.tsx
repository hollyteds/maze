import {
  GOAL_CLEAR_FONT_SIZE_PX,
  GOAL_CLEAR_TEXT,
  GOAL_LOCKED_WARNING_BLINK_DURATION_SEC,
  GOAL_LOCKED_WARNING_TEXT,
  GOAL_PROMPT_BLINK_DURATION_SEC,
  GOAL_PROMPT_FONT_SIZE_PX,
  GOAL_PROMPT_TEXT,
  GOAL_PROMPT_TEXT_COLOR,
} from '../../game/constants';

// メッセージオーバーレイの入力プロパティ。
type GoalMessageOverlayProps = {
  // ゴール解放メッセージの表示状態。
  showGoalPrompt: boolean;
  // ゴール未解放警告メッセージの表示状態。
  showGoalLockedWarning: boolean;
  // クリア済み状態。
  finished: boolean;
};

/**
 * 3Dビュー上のメッセージ演出（誘導/警告/クリア）を描画する。
 * @param showGoalPrompt ゴール解放メッセージ表示状態
 * @param showGoalLockedWarning ゴール未解放警告表示状態
 * @param finished クリア済み状態
 * @returns メッセージオーバーレイ
 */
export function GoalMessageOverlay({
  showGoalPrompt,
  showGoalLockedWarning,
  finished,
}: GoalMessageOverlayProps) {
  if (!showGoalPrompt && !showGoalLockedWarning && !finished) return null;

  return (
    <>
      <style>
        {`@keyframes maze-view-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}
      </style>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: finished && !showGoalLockedWarning ? '50%' : 30,
          transform:
            finished && !showGoalLockedWarning
              ? 'translate(-50%, -50%)'
              : 'translateX(-50%)',
          fontSize:
            finished && !showGoalLockedWarning
              ? GOAL_CLEAR_FONT_SIZE_PX
              : GOAL_PROMPT_FONT_SIZE_PX,
          fontFamily: '"Courier New", "Lucida Console", monospace',
          color: GOAL_PROMPT_TEXT_COLOR,
          animationName: 'maze-view-blink',
          animationDuration: `${
            showGoalLockedWarning
              ? GOAL_LOCKED_WARNING_BLINK_DURATION_SEC
              : GOAL_PROMPT_BLINK_DURATION_SEC
          }s`,
          animationIterationCount: 'infinite',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          textShadow: '0 0 8px rgba(203, 255, 217, 0.45)',
        }}
      >
        {showGoalLockedWarning
          ? GOAL_LOCKED_WARNING_TEXT
          : finished
            ? GOAL_CLEAR_TEXT
            : GOAL_PROMPT_TEXT}
      </div>
    </>
  );
}
