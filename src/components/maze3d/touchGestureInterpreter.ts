// タッチジェスチャー解釈結果。
export const TOUCH_GESTURE_ACTIONS = {
  NONE: 'none',
  FORWARD: 'forward',
  TURN_LEFT: 'turn_left',
  TURN_RIGHT: 'turn_right',
} as const;

// タッチジェスチャー解釈結果の型。
export type TouchGestureAction =
  (typeof TOUCH_GESTURE_ACTIONS)[keyof typeof TOUCH_GESTURE_ACTIONS];

// 判定対象のタッチ点情報。
type TouchPoint = {
  x: number;
  y: number;
  at: number;
};

// ジェスチャー判定パラメータ。
type TouchGestureInterpreterParams = {
  // 横スワイプ回転を成立させる最小横移動量（px）。
  swipeTurnThresholdPx: number;
  // タップ扱いとみなす最大移動量（px）。
  tapMoveTolerancePx: number;
  // タップ扱いとみなす最大接触時間（ms）。
  tapMaxDurationMs: number;
};

/**
 * タッチ開始/終了情報をもとに、前進・回転・無効を判定する解釈器。
 */
export class TouchGestureInterpreter {
  private startPoint: TouchPoint | null = null;

  private readonly swipeTurnThresholdPx: number;

  private readonly tapMoveTolerancePx: number;

  private readonly tapMaxDurationMs: number;

  /**
   * @param params ジェスチャー判定しきい値
   */
  constructor(params: TouchGestureInterpreterParams) {
    this.swipeTurnThresholdPx = params.swipeTurnThresholdPx;
    this.tapMoveTolerancePx = params.tapMoveTolerancePx;
    this.tapMaxDurationMs = params.tapMaxDurationMs;
  }

  /**
   * ジェスチャー開始点を記録する。
   * @param point タッチ開始座標と時刻
   */
  begin(point: TouchPoint): void {
    this.startPoint = point;
  }

  /**
   * 記録済みジェスチャーを破棄する。
   */
  cancel(): void {
    this.startPoint = null;
  }

  /**
   * ジェスチャー終了点を評価して操作種別を返す。
   * @param endPoint タッチ終了座標と時刻
   * @returns 判定した操作種別
   */
  resolve(endPoint: TouchPoint): TouchGestureAction {
    const start = this.startPoint;
    this.startPoint = null;
    if (!start) return TOUCH_GESTURE_ACTIONS.NONE;

    const deltaX = endPoint.x - start.x;
    const deltaY = endPoint.y - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const movement = Math.hypot(deltaX, deltaY);
    const durationMs = endPoint.at - start.at;

    // 横方向優位かつしきい値超過時のみ回転入力として扱い、斜め誤判定を抑える。
    if (absX >= this.swipeTurnThresholdPx && absX > absY) {
      return deltaX < 0 ? TOUCH_GESTURE_ACTIONS.TURN_RIGHT : TOUCH_GESTURE_ACTIONS.TURN_LEFT;
    }
    if (movement <= this.tapMoveTolerancePx && durationMs <= this.tapMaxDurationMs) {
      return TOUCH_GESTURE_ACTIONS.FORWARD;
    }
    return TOUCH_GESTURE_ACTIONS.NONE;
  }
}
