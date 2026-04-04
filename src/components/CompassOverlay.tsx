import { useEffect, useRef, useState } from 'react';
import {
  COMPASS_DIRECTION_SCALE,
  COMPASS_LABEL_FONT_SIZE_PX,
  COMPASS_POINTER_TRIANGLE_BASE_OFFSET_RATIO,
  COMPASS_POINTER_TRIANGLE_HALF_WIDTH,
  COMPASS_ROTATION_DURATION_MS,
} from '../game/constants';
import { Direction } from '../mazeUtils';

// CompassOverlayコンポーネントの入力プロパティ。
type CompassOverlayProps = {
  // 現在の向き（N/E/S/W）。
  dir: Direction;
};

// コンパス中心X座標。
const COMPASS_CENTER_X = 39;
// コンパス中心Y座標。
const COMPASS_CENTER_Y = 39;
// 方位表示（十字線）の基準オフセット距離。
const COMPASS_CROSS_BASE_OFFSET = 22;
// 方位文字の基準配置半径。
const COMPASS_LABEL_BASE_RADIUS = 30;

/**
 * 角度を -180〜180 の範囲へ正規化する。
 * @param angleDeg 正規化対象の角度（度）
 * @returns -180〜180 に収まる角度
 */
const normalizeAngleDeg = (angleDeg: number): number =>
  ((((angleDeg + 180) % 360) + 360) % 360) - 180;

/**
 * from から to へ回す最短角度差を返す。
 * @param fromDeg 開始角度（度）
 * @param toDeg 目標角度（度）
 * @returns 最短経路の角度差（度）
 */
const getShortestAngleDeltaDeg = (fromDeg: number, toDeg: number): number => {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
};

/**
 * 0〜1 を受け取り、前後を緩めるイージング値へ変換する。
 * @param t 正規化時間（0〜1）
 * @returns イージング後の進行率（0〜1）
 */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * 点を中心座標まわりに角度分回転させる。
 * @param x 回転前X座標
 * @param y 回転前Y座標
 * @param angleDeg 回転角度（度）
 * @returns 回転後座標
 */
const rotatePoint = (x: number, y: number, angleDeg: number): { x: number; y: number } => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - COMPASS_CENTER_X;
  const dy = y - COMPASS_CENTER_Y;
  return {
    x: COMPASS_CENTER_X + dx * cos - dy * sin,
    y: COMPASS_CENTER_Y + dx * sin + dy * cos,
  };
};

/**
 * 基準方角角度とリング回転角度からラベル座標を求める。
 * @param baseAngleDeg N/E/S/W の基準角度（度）
 * @param ringAngleDeg 方位リング回転角度（度）
 * @param radius ラベル配置半径
 * @returns ラベル描画座標
 */
const toLabelPosition = (
  baseAngleDeg: number,
  ringAngleDeg: number,
  radius: number
): { x: number; y: number } => {
  const rad = ((baseAngleDeg + ringAngleDeg) * Math.PI) / 180;
  return {
    x: COMPASS_CENTER_X + Math.cos(rad) * radius,
    y: COMPASS_CENTER_Y + Math.sin(rad) * radius,
  };
};

/**
 * リング半径に合わせたポインター三角形の座標文字列を生成する。
 * @param centerX コンパス中心X座標
 * @param centerY コンパス中心Y座標
 * @param ringRadius 方位リング半径
 * @param halfWidth 三角形の半幅
 * @returns polygon要素に渡す座標文字列
 */
const toPointerTrianglePoints = (
  centerX: number,
  centerY: number,
  ringRadius: number,
  halfWidth: number
): string => {
  // 先端を方位リング外周の上端に一致させる。
  const tipY = centerY - ringRadius;
  // 底辺は定数比率で下方向へ配置し、直径寄りの形状を維持する。
  const baseY = tipY + ringRadius * COMPASS_POINTER_TRIANGLE_BASE_OFFSET_RATIO;
  return `${centerX},${tipY} ${centerX - halfWidth},${baseY} ${centerX + halfWidth},${baseY}`;
};

/**
 * 画面右上に方位コンパスを重ね描画する。
 * @param dir プレイヤー現在向き
 * @returns 方位リングと固定針を描いたSVG
 */
export function CompassOverlay({ dir }: CompassOverlayProps) {
  // 方角コードを方位リング回転角度（度）へ変換する表。
  const angleMap: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };
  // コンパス背景の黒色。
  const compassBackground = '#000000';
  // 目標リング角度。矢印固定のため方位側を逆回転する。
  const targetRingAngleDeg = -angleMap[dir];
  // 現在表示中のリング角度。
  const [ringAngleDeg, setRingAngleDeg] = useState(targetRingAngleDeg);
  // 最新リング角度を同期保持し、アニメーション開始点に使う。
  const ringAngleRef = useRef(targetRingAngleDeg);
  // 実行中のアニメーションフレームID。
  const animationFrameRef = useRef<number | null>(null);
  // 方位表示（リング/十字/文字配置）の縮小率。
  const directionScale = COMPASS_DIRECTION_SCALE;
  // 縮小後の方位リング半径。
  const ringRadius = 22 * directionScale;
  // 縮小後の十字線オフセット。
  const crossOffset = COMPASS_CROSS_BASE_OFFSET * directionScale;
  // 縮小後のラベル配置半径。
  const labelRadius = COMPASS_LABEL_BASE_RADIUS * directionScale;

  /**
   * 実行中の回転アニメーションを停止する。
   */
  const stopRotationAnimation = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopRotationAnimation();
    };
  }, []);

  useEffect(() => {
    stopRotationAnimation();

    const startAngleDeg = ringAngleRef.current;
    const deltaDeg = getShortestAngleDeltaDeg(startAngleDeg, targetRingAngleDeg);
    if (Math.abs(deltaDeg) < 0.001) {
      ringAngleRef.current = targetRingAngleDeg;
      setRingAngleDeg(targetRingAngleDeg);
      return;
    }
    const animationStart = performance.now();

    const tick = (now: number) => {
      const elapsed = now - animationStart;
      const t = Math.min(1, elapsed / COMPASS_ROTATION_DURATION_MS);
      const eased = easeInOutCubic(t);
      const nextAngle = normalizeAngleDeg(startAngleDeg + deltaDeg * eased);

      ringAngleRef.current = nextAngle;
      setRingAngleDeg(nextAngle);
      if (t >= 1) {
        ringAngleRef.current = targetRingAngleDeg;
        setRingAngleDeg(targetRingAngleDeg);
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      stopRotationAnimation();
    };
  }, [targetRingAngleDeg]);

  const topLineStart = rotatePoint(COMPASS_CENTER_X, COMPASS_CENTER_Y - crossOffset, ringAngleDeg);
  const topLineEnd = rotatePoint(COMPASS_CENTER_X, COMPASS_CENTER_Y + crossOffset, ringAngleDeg);
  const sideLineStart = rotatePoint(COMPASS_CENTER_X - crossOffset, COMPASS_CENTER_Y, ringAngleDeg);
  const sideLineEnd = rotatePoint(COMPASS_CENTER_X + crossOffset, COMPASS_CENTER_Y, ringAngleDeg);
  const labelN = toLabelPosition(-90, ringAngleDeg, labelRadius);
  const labelE = toLabelPosition(0, ringAngleDeg, labelRadius);
  const labelS = toLabelPosition(90, ringAngleDeg, labelRadius);
  const labelW = toLabelPosition(180, ringAngleDeg, labelRadius);
  // コンパス中央ポインターとして使う細い二等辺三角形の座標文字列。
  const pointerTrianglePoints = toPointerTrianglePoints(
    COMPASS_CENTER_X,
    COMPASS_CENTER_Y,
    ringRadius,
    COMPASS_POINTER_TRIANGLE_HALF_WIDTH
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 8,
      }}
    >
      <svg width={78} height={78} viewBox="0 0 78 78" aria-label="compass">
        <circle cx={COMPASS_CENTER_X} cy={COMPASS_CENTER_Y} r="28" fill={compassBackground} fillOpacity="0.84" />
        <circle
          cx={COMPASS_CENTER_X}
          cy={COMPASS_CENTER_Y}
          r={ringRadius}
          fill="none"
          stroke="#58d47f"
          strokeOpacity="0.72"
          strokeWidth="1.2"
        />
        <line
          x1={topLineStart.x}
          y1={topLineStart.y}
          x2={topLineEnd.x}
          y2={topLineEnd.y}
          stroke="#58d47f"
          strokeOpacity="0.34"
          strokeWidth="1"
        />
        <line
          x1={sideLineStart.x}
          y1={sideLineStart.y}
          x2={sideLineEnd.x}
          y2={sideLineEnd.y}
          stroke="#58d47f"
          strokeOpacity="0.34"
          strokeWidth="1"
        />
        <text
          x={labelN.x}
          y={labelN.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={COMPASS_LABEL_FONT_SIZE_PX}
          fill="#cbffd9"
        >
          N
        </text>
        <text
          x={labelE.x}
          y={labelE.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={COMPASS_LABEL_FONT_SIZE_PX}
          fill="#cbffd9"
        >
          E
        </text>
        <text
          x={labelS.x}
          y={labelS.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={COMPASS_LABEL_FONT_SIZE_PX}
          fill="#cbffd9"
        >
          S
        </text>
        <text
          x={labelW.x}
          y={labelW.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={COMPASS_LABEL_FONT_SIZE_PX}
          fill="#cbffd9"
        >
          W
        </text>
        <polygon points={pointerTrianglePoints} fill="#ffd98c" />
      </svg>
    </div>
  );
}
