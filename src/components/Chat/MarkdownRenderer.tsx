import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useCallback, useState, isValidElement } from "react";
import { Copy, Check } from "lucide-react";

const fg = "var(--seed-fg)";
const muted = "var(--seed-muted)";
const accent = "var(--seed-accent)";
const border = "var(--seed-border)";
const inputBg = "var(--seed-input-bg)";
const hoverBg = "var(--seed-hover-bg)";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        fontSize: 11,
        fontFamily: "inherit",
        color: muted,
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 6,
        cursor: "pointer",
        transition: "color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = fg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = muted; }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

/** 从 highlight 后的 React children 中递归提取纯文本（用于复制按钮） */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

export default function MarkdownRenderer({ content, highlight }: { content: string; highlight?: string }) {
  const highlightParts = highlight
    ? (() => {
        const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const lower = highlight.toLowerCase();
        return { re: new RegExp(`(${escaped})`, "ig"), lower };
      })()
    : null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        text({ children }) {
          // 搜索结果关键词高亮：对每个纯文本节点拆分匹配词，用 <mark> 标记
          if (highlightParts) {
            const parts = String(children).split(highlightParts.re);
            return (
              <>
                {parts.map((part, i) =>
                  part.toLowerCase() === highlightParts.lower ? (
                    <mark key={i} className="seed-hl">{part}</mark>
                  ) : (
                    part
                  ),
                )}
              </>
            );
          }
          return <>{children}</>;
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const textContent = extractText(children);
          if (match) {
            return (
              <div
                style={{
                  margin: "10px 0",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: `1px solid ${border}`,
                  background: "#0d1117",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px 4px 14px",
                    fontSize: 11,
                    color: muted,
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: `1px solid ${border}`,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)" }}>{match[1]}</span>
                  <CopyButton text={textContent} />
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "12px 14px",
                    overflowX: "auto",
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: "transparent",
                  }}
                >
                  <code className={className} {...props}>{children}</code>
                </pre>
              </div>
            );
          }
          return (
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.9em",
                padding: "2px 6px",
                borderRadius: 6,
                background: inputBg,
                border: `1px solid ${border}`,
                color: fg,
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children }) { return <>{children}</>; },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: accent, textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {children}
            </a>
          );
        },
        p({ children }) {
          return (
            <p style={{ margin: "4px 0", lineHeight: 1.75, color: fg }}>
              {children}
            </p>
          );
        },
        ul({ children }) {
          return (
            <ul style={{ margin: "6px 0", paddingLeft: 22, listStyle: "disc", color: fg }}>
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol style={{ margin: "6px 0", paddingLeft: 22, listStyle: "decimal", color: fg }}>
              {children}
            </ol>
          );
        },
        li({ children }) {
          return <li style={{ margin: "3px 0", lineHeight: 1.7 }}>{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote
              style={{
                margin: "8px 0",
                padding: "8px 14px",
                borderLeft: `3px solid ${accent}`,
                borderRadius: "0 8px 8px 0",
                background: "var(--seed-accent-bg)",
                color: muted,
              }}
            >
              {children}
            </blockquote>
          );
        },
        h1({ children }) {
          return (
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "14px 0 8px", color: fg, lineHeight: 1.4 }}>
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: "12px 0 6px", color: fg, lineHeight: 1.4 }}>
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 6px", color: fg, lineHeight: 1.4 }}>
              {children}
            </h3>
          );
        },
        h4({ children }) {
          return (
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px", color: fg, lineHeight: 1.4 }}>
              {children}
            </h4>
          );
        },
        table({ children }) {
          return (
            <div style={{ margin: "10px 0", overflowX: "auto", borderRadius: 8, border: `1px solid ${border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: fg }}>
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontWeight: 600,
                color: muted,
                background: inputBg,
                borderBottom: `1px solid ${border}`,
                whiteSpace: "nowrap",
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${border}`, lineHeight: 1.6 }}>
              {children}
            </td>
          );
        },
        hr() {
          return <hr style={{ margin: "14px 0", border: "none", borderTop: `1px solid ${border}` }} />;
        },
        strong({ children }) {
          return <strong style={{ fontWeight: 600, color: fg }}>{children}</strong>;
        },
        em({ children }) {
          return <em style={{ color: fg }}>{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
