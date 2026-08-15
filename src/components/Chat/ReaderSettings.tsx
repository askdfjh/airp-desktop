import { useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { registerBackHandler } from "@/lib/androidBack";
import { useAnimatedVisibility } from "@/hooks/useAnimatedVisibility";
import {
  DEFAULT_READER_PREFS,
  READER_BG_PRESETS,
  READER_FONT_PRESETS,
} from "@/lib/readerPrefs";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="narra-reader-row">
      <span className="narra-reader-k">{label}</span>
      <input
        type="range"
        className="seed-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${fill}%` } as React.CSSProperties}
      />
      <span className="narra-reader-v">{format(value)}</span>
    </div>
  );
}

export function ReaderSettings() {
  const open = useUIStore((s) => s.readerSettingsOpen);
  const setOpen = useUIStore((s) => s.setReaderSettingsOpen);
  const reader = useUIStore((s) => s.reader);
  const setReader = useUIStore((s) => s.setReader);
  const resetReader = useUIStore((s) => s.resetReader);
  const { mounted, phase } = useAnimatedVisibility(open, 220);

  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      if (useUIStore.getState().readerSettingsOpen) {
        useUIStore.getState().setReaderSettingsOpen(false);
        return true;
      }
      return false;
    });
    return unregister;
  }, [open]);

  if (!mounted) return null;

  const sheetClass =
    phase === "in" ? "anim-sheet-in" : phase === "out" ? "anim-sheet-out" : "anim-init";
  const maskClass =
    phase === "in" ? "anim-overlay-in" : phase === "out" ? "anim-overlay-out" : "anim-init";

  return (
    <>
      <button
        type="button"
        className={`narra-reader-mask ${maskClass}`}
        aria-label="关闭阅读设置"
        onClick={() => setOpen(false)}
      />
      <div className={`narra-reader-sheet ${sheetClass}`} role="dialog" aria-label="阅读设置">
        <div className="narra-reader-handle" />
        <div className="narra-reader-head">
          <span>阅读排版</span>
          <button type="button" className="narra-reader-reset" onClick={() => resetReader()}>
            恢复默认
          </button>
        </div>

        <div className="narra-reader-mode">
          <button
            type="button"
            className={"narra-reader-mode-btn" + (reader.night ? "" : " is-on")}
            onClick={() => setReader({ night: false })}
          >
            日间
          </button>
          <button
            type="button"
            className={"narra-reader-mode-btn" + (reader.night ? " is-on" : "")}
            onClick={() => setReader({ night: true })}
          >
            夜间
          </button>
        </div>

        <div className="narra-reader-sec">背景</div>
        <div className="narra-reader-swatches">
          {READER_BG_PRESETS.map((p) => {
            const on = !reader.night && reader.bg === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={"narra-reader-swatch" + (on ? " is-on" : "")}
                onClick={() => setReader({ bg: p.id, night: false })}
                title={p.label}
              >
                <i style={{ background: p.swatch }} />
                <em>{p.label}</em>
              </button>
            );
          })}
        </div>

        <div className="narra-reader-sec">字体</div>
        <div className="narra-reader-fonts">
          {READER_FONT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"narra-reader-font" + (reader.font === p.id ? " is-on" : "")}
              data-font={p.id}
              onClick={() => setReader({ font: p.id })}
            >
              <b>{p.sample}</b>
              <em>{p.label}</em>
            </button>
          ))}
        </div>

        <div className="narra-reader-sec">版式</div>
        <SliderRow
          label="字号"
          value={reader.fontSize}
          min={13}
          max={32}
          step={1}
          format={(v) => `${v}`}
          onChange={(fontSize) => setReader({ fontSize })}
        />
        <SliderRow
          label="行距"
          value={reader.lineHeight}
          min={1.3}
          max={2.8}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(lineHeight) => setReader({ lineHeight })}
        />
        <SliderRow
          label="段距"
          value={reader.paragraphGap}
          min={0}
          max={36}
          step={1}
          format={(v) => `${v}`}
          onChange={(paragraphGap) => setReader({ paragraphGap })}
        />
        <SliderRow
          label="字距"
          value={reader.letterSpacing}
          min={0}
          max={0.16}
          step={0.005}
          format={(v) => v.toFixed(3)}
          onChange={(letterSpacing) => setReader({ letterSpacing })}
        />
        <SliderRow
          label="边距"
          value={reader.pagePadding}
          min={12}
          max={48}
          step={2}
          format={(v) => `${v}`}
          onChange={(pagePadding) => setReader({ pagePadding })}
        />

        <div className="narra-reader-toggles">
          <button
            type="button"
            className={"narra-reader-toggle" + (reader.bold ? " is-on" : "")}
            onClick={() => setReader({ bold: !reader.bold })}
          >
            加粗正文
          </button>
          <button
            type="button"
            className="narra-reader-toggle"
            onClick={() => setReader({ ...DEFAULT_READER_PREFS })}
          >
            素纸宋体
          </button>
        </div>
      </div>
    </>
  );
}
