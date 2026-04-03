import { useEffect, useState } from 'react';

/**
 * 現在環境がタッチ主体デバイスかどうかを判定する。
 * @returns タッチ操作を主入力として扱う場合に true
 */
export const useIsTouchDevice = (): boolean => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // ポインタ特性とタッチポイント数を併用し、2-in-1端末にも対応する。
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const update = () => {
      setIsTouchDevice(mediaQuery.matches || navigator.maxTouchPoints > 0);
    };

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isTouchDevice;
};
