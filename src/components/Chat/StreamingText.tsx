import { useState, useEffect, useRef } from "react";

interface StreamingTextProps {
  content: string;
  active: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function StreamingText({ content, active, style, className }: StreamingTextProps) {
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
      // 每 2 帧推进 1 个字（速度减半，更平滑）；积压极大时每帧 +1 加速补齐
      const backlog = target - cur;
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