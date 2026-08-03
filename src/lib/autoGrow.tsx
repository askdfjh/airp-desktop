import { useEffect, useRef } from "react";

/** textarea 高度随内容自适应（上限 maxHeight，超出出现滚动） */
export function fitTextarea(el: HTMLTextAreaElement, maxHeight = 320) {
  el.style.height = "auto";
  const target = Math.min(el.scrollHeight + 2, maxHeight);
  el.style.height = target + "px";
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

/** 固定宽度 input 随内容自适应宽度（min~max，按字号测量文本宽度） */
export function fitInputWidth(el: HTMLInputElement, min = 70, max = 360) {
  const tmp = document.createElement("span");
  tmp.style.cssText = "visibility:hidden;position:absolute;white-space:pre;pointer-events:none;font:" + getComputedStyle(el).font;
  tmp.textContent = (el.value || el.placeholder || "").replace(/\s/g, "\u00A0");
  document.body.appendChild(tmp);
  const w = tmp.getBoundingClientRect().width;
  document.body.removeChild(tmp);
  el.style.width = Math.min(Math.max(w + 26, min), max) + "px";
}

/** 自适应高度的 textarea（保留全部原生 props） */
export function AutoTextarea({
  maxHeight = 320,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { maxHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) fitTextarea(ref.current, maxHeight);
  });
  return (
    <textarea
      {...props}
      ref={ref}
      onInput={(e) => fitTextarea(e.currentTarget, maxHeight)}
    />
  );
}

/** 自适应宽度的 input（保留全部原生 props） */
export function AutoInput({
  min = 70,
  max = 360,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { min?: number; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) fitInputWidth(ref.current, min, max);
  });
  return (
    <input
      {...props}
      ref={ref}
      onInput={(e) => fitInputWidth(e.currentTarget, min, max)}
    />
  );
}
