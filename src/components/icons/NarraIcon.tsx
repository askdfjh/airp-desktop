// 灵叙 Narra · 印记系统 (Narra Sigils)
// 13 枚极简几何符号图标，统一替换原 Lucide 通用设置图标。
// 规格: viewBox 24×24, stroke-width 1.8, currentColor, round linecap/linejoin.
// 与 airp-icons.svg 雪碧文件保持一致，便于后续主题扩展。

type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Svg({ size = 24, className, strokeWidth = 1.8, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** 模型服务 — 星芒（AI 火花），替代 Sparkles */
export const NarraModel = (p: IconProps) => (
  <Svg {...p}><path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" /></Svg>
);

/** 角色 — 双环面具（一人两面），替代 Users */
export const NarraCharacter = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></Svg>
);

/** 世界观 — 世界之眼（圆 + 菱），替代 Globe */
export const NarraWorld = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8 L15 12 L12 16 L9 12 Z" /></Svg>
);

/** 工具 — 印记十字（菱 + 十字），替代 Search */
export const NarraTools = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 L21 12 L12 21 L3 12 Z" /><path d="M9 12 L15 12 M12 9 L12 15" /></Svg>
);

/** MCP 服务器 — 六芒节点（六边形 + 中心点），替代 Server */
export const NarraMcp = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></Svg>
);

/** 数据管理 — 档案卷（圆角框 + 隔线），替代 Database */
export const NarraData = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10 L20 10" /><path d="M9 14 L15 14" /></Svg>
);

/** 外观与偏好 — 调律滑（滑杆 + 双点），新增 tab / 替代 SlidersHorizontal */
export const NarraAppearance = (p: IconProps) => (
  <Svg {...p}><path d="M4 7 L20 7" /><path d="M4 17 L20 17" /><circle cx="9" cy="7" r="2.2" /><circle cx="15" cy="17" r="2.2" /></Svg>
);

/** 设置入口 — 齿轮星（圆 + 放射辐条），替代 Settings */
export const NarraSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3.5" /><path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M5.6 5.6 L7.7 7.7 M16.3 16.3 L18.4 18.4 M5.6 18.4 L7.7 16.3 M16.3 7.7 L18.4 5.6" /></Svg>
);

/** 主题 — 月牙（昼夜），替代 Sun/Moon；与设置齿轮星明确区分 */
export const NarraTheme = (p: IconProps) => (
  <Svg {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>
);

/** 字体 — 字号（大 A 小 a），替代 Type */
export const NarraFont = (p: IconProps) => (
  <Svg {...p}><path d="M4 18 L8 6 L12 18" /><path d="M5.5 14 L10.5 14" /><path d="M15 18 L17.5 11 L20 18" /><path d="M15.7 16 L19.3 16" /></Svg>
);

/** 会话管理 — 叠页（两页相覆），替代 Files */
export const NarraSession = (p: IconProps) => (
  <Svg {...p}><rect x="6" y="6" width="11" height="14" rx="1.5" /><rect x="9" y="3" width="11" height="14" rx="1.5" /></Svg>
);

/** 联网搜索 — 信号弧（基点 + 双弧），替代 Wifi */
export const NarraWebSearch = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="14" r="2" /><path d="M7 9 a7 7 0 0 1 10 0" /><path d="M9.5 11.5 a3.5 3.5 0 0 1 5 0" /></Svg>
);

/** 世界信息 — 日志之瞳（圆 + i），替代 Info */
export const NarraWorldInfo = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" /><path d="M12 11 L12 17" /></Svg>
);

/** 书架 — 三册并立 */
export const NarraShelf = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="5" height="14" rx="0.8" />
    <rect x="9.5" y="4" width="5" height="16" rx="0.8" />
    <rect x="16" y="7" width="5" height="13" rx="0.8" />
    <path d="M2 21 L22 21" />
  </Svg>
);

/** 返回 — 折线箭头 */
export const NarraBack = (p: IconProps) => (
  <Svg {...p}><path d="M15 5 L7 12 L15 19" /><path d="M7 12 L21 12" /></Svg>
);

/** 新建 — 细圈十字 */
export const NarraPlus = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7 L12 17 M7 12 L17 12" /></Svg>
);

/** 置顶 — 针钉 */
export const NarraPin = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 L15 8 L19 9 L14 13 L15 20 L12 17 L9 20 L10 13 L5 9 L9 8 Z" /></Svg>
);

/** 书签带 */
export const NarraBookmark = (p: IconProps) => (
  <Svg {...p}><path d="M7 3 L17 3 L17 21 L12 16 L7 21 Z" /></Svg>
);

/** 网格 */
export const NarraGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
  </Svg>
);

/** 列表 */
export const NarraRows = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 7 L19 7 M5 12 L19 12 M5 17 L19 17" />
  </Svg>
);

/** 稿纸 */
export const NarraDraft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3 L15 3 L19 7 L19 21 L7 21 Z" />
    <path d="M15 3 L15 8 L19 8" />
    <path d="M10 12 L16 12 M10 16 L14 16" />
  </Svg>
);

/** 导出 — 向下折页 */
export const NarraExport = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 L12 15" />
    <path d="M8 12 L12 16 L16 12" />
    <path d="M5 19 L19 19" />
  </Svg>
);

/** 检索 */
export const NarraSeek = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15 L20 20" />
  </Svg>
);
