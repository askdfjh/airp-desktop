// Layered Android back-button/gesture handling.
//
// Tauri's Android AppPlugin fires the native back event only through its own
// channel (plugin:app|register_listener). The app registers one listener via
// onBackButtonPress() in AppShell, then dispatchBack() consumes the press from
// the top-most UI layer down: confirm dialogs -> settings panel -> compress
// confirm -> session mgmt/search/world info/dropdowns -> keyboard blur.
// When nothing consumes it, AppShell uses the two-press-to-exit pattern
// (toast on first press, exit_app command on the second within 2s).
//
// Handlers registered by React child effects run first in the array; dispatch
// iterates from the end (top-most UI) so overlays win over lower layers.

export const isAndroid =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export async function dispatchBack(): Promise<boolean> {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true;
    } catch {
      // 单个处理器异常不阻断后续层级
    }
  }
  return false;
}