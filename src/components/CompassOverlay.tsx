import { Direction } from '../mazeUtils';

// CompassOverlayコンポーネントの入力プロパティ。
type CompassOverlayProps = {
  // 現在の向き（N/E/S/W）。
  dir: Direction;
};

/**
 * 画面右上に方位コンパスを重ね描画する。
 * @param dir プレイヤー現在向き
 * @returns 方位リングと針を描いたSVG
 */
export function CompassOverlay({ dir }: CompassOverlayProps) {
  // 方角コードを針回転角度（度）へ変換する表。
  const angleMap: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };
  // コンパス背景の黒色。
  const compassBackground = '#000000';

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        width: 78,
        height: 78,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 8,
      }}
    >
      <svg width={78} height={78} viewBox="0 0 78 78" aria-label="compass">
        <circle cx="39" cy="39" r="28" fill={compassBackground} fillOpacity="0.84" />
        <circle cx="39" cy="39" r="22" fill="none" stroke="#58d47f" strokeOpacity="0.72" strokeWidth="1.2" />
        <line x1="39" y1="17" x2="39" y2="61" stroke="#58d47f" strokeOpacity="0.34" strokeWidth="1" />
        <line x1="17" y1="39" x2="61" y2="39" stroke="#58d47f" strokeOpacity="0.34" strokeWidth="1" />
        <text x="39" y="17" textAnchor="middle" fontSize="10" fill="#cbffd9">
          N
        </text>
        <text x="64" y="42" textAnchor="middle" fontSize="10" fill="#cbffd9">
          E
        </text>
        <text x="39" y="64" textAnchor="middle" fontSize="10" fill="#cbffd9">
          S
        </text>
        <text x="14" y="42" textAnchor="middle" fontSize="10" fill="#cbffd9">
          W
        </text>
        <g transform={`rotate(${angleMap[dir]} 39 39)`}>
          <line x1="39" y1="39" x2="39" y2="22" stroke="#ffd98c" strokeWidth="1.7" strokeLinecap="round" />
          <polygon points="39,17 35.5,25 42.5,25" fill="#ffd98c" />
        </g>
      </svg>
    </div>
  );
}
