import { useEffect, useRef, useState } from "react";

export type AnimPhase = "init" | "in" | "out";

/**
 * 受控显隐 + 进出场动画（统一动效体系的核心）。
 *
 * - visible=true  → 挂载并播放进入动画：
 *   初始渲染为 "init"（静止透明、不播动画，避免闪现），双 rAF 后切 "in" 触发 CSS 动画
 * - visible=false → 先切到退出动画态（phase="out"），动画时长结束后才真正卸载
 *
 * 用法：
 *   const { mounted, phase } = useAnimatedVisibility(visible, 220);
 *   if (!mounted) return null;
 *   return <div className={animClassFor(phase)}>...</div>;
 *   // phase === "init"  → "anim-init"（opacity:0 静止）
 *   // phase === "in"    → "anim-xxx-in"
 *   // phase === "out"   → "anim-xxx-out"
 *
 * 说明：
 * - phase 只负责选 CSS 动画类，时长由调用方传入并须与 CSS 动画时长一致；
 * - 使用 setTimeout（而非 onAnimationEnd），避免多属性动画重复触发、与既有动画冲突；
 * - StrictMode 下 effect 双调用安全（cleanup 清理 timer/rAF）；
 * - prefers-reduced-motion 生效时按 0ms 立即卸载，配合 CSS 的 animation:none 双保险。
 */
export function useAnimatedVisibility(visible: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(visible);
  const [phase, setPhase] = useState<AnimPhase>("init");
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      // 打开：确保挂载，双 rAF 后切到进入态触发 CSS 动画
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setMounted(true);
      setPhase("init");
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhase("in");
        });
      });
    } else {
      // 关闭：播放退出动画，结束后卸载（reduced-motion 时立即卸载）
      if (!mounted) return;
      setPhase("out");
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const eff = reduced || durationMs <= 0 ? 0 : durationMs;
      timerRef.current = window.setTimeout(() => {
        setMounted(false);
      }, eff);
    }
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, durationMs, mounted]);

  return { mounted, phase };
}
