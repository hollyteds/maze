import { useEffect, useState } from 'react';
import { VIEWPORT_WIDTH } from '../game/constants';

// ビューポート寸法を表す値オブジェクト。
export type ViewportSize = {
  width: number;
  height: number;
};

// クライアント表示領域の初期サイズ。SSR時は安全な既定値を返す。
const getInitialViewportSize = (): ViewportSize =>
  typeof window === 'undefined'
    ? { width: VIEWPORT_WIDTH, height: VIEWPORT_WIDTH }
    : { width: window.innerWidth, height: window.innerHeight };

/**
 * 現在のビューポートサイズを購読する。
 * @returns 現在の画面幅・高さ
 */
export const useViewportSize = (): ViewportSize => {
  const [viewportSize, setViewportSize] = useState<ViewportSize>(getInitialViewportSize);

  useEffect(() => {
    /**
     * ビューポートサイズを再取得して状態へ反映する。
     */
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    window.addEventListener('orientationchange', updateViewportSize);
    return () => {
      window.removeEventListener('resize', updateViewportSize);
      window.removeEventListener('orientationchange', updateViewportSize);
    };
  }, []);

  return viewportSize;
};
