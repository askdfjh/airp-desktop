import { useEffect, useState } from "react";

/**
 * 手机软键盘高度偏移：监听 visualViewport 高度变化（键盘弹出时缩小），
 * 返回键盘遮挡区域高度（px），用于弹窗等 fixed 元素向上让位。
 */
export function useKeyboardShift(): number {
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setShift(Math.max(0, window.innerHeight - vv.height));
    };
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return shift;
}
