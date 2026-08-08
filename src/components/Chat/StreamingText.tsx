import { useState, useEffect, useRef } from "react";

interface StreamingTextProps {
  content: string;
  active: boolean;
  /** 实时追赶模式（思考过程等场景）：积压超过阈值时直接跳到最新内容，避免显示长期滞后 */
  live?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function StreamingText({ content, active, live, style, className }: StreamingTextProps) {
  const [count, setCount] = useState(active ? 0 : content.length);
  const rafRef = useRef<number | null>(null);
  const countRef = useRef(count);
  const frameRef = useRef(0);

  useEffect(() => {
    countRef.current = count;
  }, [count]);

  useEffect(() => {
    if (!active) {
      if (countRef.current !== content.length) {
        countRef.current = content.length;
        setCount(content.length);
      }
      return;
    }
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const target = content.length;
      const cur = countRef.current;
      frameRef.current++;
      const backlog = target - cur;
      // 实时追赶模式（思考过程）：固定快速步长平滑输出——
      // 上游按句/块到达，打字机将其抹平成逐字显示（与正文一致）；步长固定避免
      // 逐字过慢（滞后停着），也不做比例追赶（避免一句话一句话跳变）
      if (live) {
        const step = backlog > 800 ? 6 : backlog > 300 ? 3 : 2;
        const next = Math.min(target, cur + step);
        countRef.current = next;
        setCount(next);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // 每 2 帧推进 1 个字（速度减半，更平滑）；积压极大时每帧 +1 加速补齐
      const shouldAdvance = backlog > 500 ? true : frameRef.current % 2 === 0;
      if (shouldAdvance && cur < target) {
        const step = backlog > 1000 ? 3 : backlog > 500 ? 2 : 1;
        const next = Math.min(target, cur + step);
        countRef.current = next;
        setCount(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, content.length]);

  const shown = content.slice(0, count);
  const head = shown.slice(0, -1);
  const tail = count > 0 ? shown.slice(-1) : "";

  return (
    <div
      className={className}
      style={{ ...style, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, display: "inline" }}
    >
      {head}
      {tail && (
        <span key={count} className="stream-tail">{tail}</span>
      )}
    </div>
  );
}