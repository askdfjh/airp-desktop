import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let disposed = false;
    const refresh = () => {
      win
        .isMaximized()
        .then((m) => {
          if (!disposed) setMaximized(m);
        })
        .catch(() => {});
    };
    refresh();
    const unlisten = win.onResized(() => refresh());
    return () => {
      disposed = true;
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return (
    <div className="seed-titlebar" data-tauri-drag-region>
      <div className="seed-titlebar-title" data-tauri-drag-region>
        AIRP
      </div>
      <div className="seed-titlebar-controls">
        <button
          className="seed-titlebar-btn"
          tabIndex={-1}
          title="最小化"
          onClick={() => getCurrentWindow().minimize()}
        >
          <Minus size={14} />
        </button>
        <button
          className="seed-titlebar-btn"
          tabIndex={-1}
          title={maximized ? "还原" : "最大化"}
          onClick={() => getCurrentWindow().toggleMaximize()}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          className="seed-titlebar-btn seed-titlebar-btn--close"
          tabIndex={-1}
          title="关闭"
          onClick={() => getCurrentWindow().close()}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
