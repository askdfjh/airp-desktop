import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useCallback, isValidElement } from "react";
import { Copy } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const copy = useCallback(() => navigator.clipboard.writeText(text), [text]);
  return (
    <button onClick={copy}
      className="absolute top-2 right-2 px-2 py-1 text-10 rd-8 bg-card tr-all op0 group-hover-op100"
      style={{ color: "var(--text-tertiary)" }}>
      <Copy size={12} className="inline mr-1" />复制
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

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const textContent = extractText(children);
          if (match) {
            return (
              <div className="relative group my-3 rd-12 ov-h border border-light">
                <div className="flex items-center justify-between px-3-5 py-1-5 text-11 txt-tertiary bg-card border-b border-light">
                  <span className="font-mono">{match[1]}</span>
                </div>
                <CopyButton text={textContent} />
                <pre className="ov-xa p-3-5 text-sm leading-relaxed"><code className={className} {...props}>{children}</code></pre>
              </div>
            );
          }
          return <code className="px-1-5 py-0-5 rd-6 bg-accent text-sm" style={{ color: "var(--accent)" }} {...props}>{children}</code>;
        },
        pre({ children }) { return <>{children}</>; },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="txt-accent underline underline-offset-2">{children}</a>;
        },
        p({ children }) { return <p className="my-1-5 leading-relaxed">{children}</p>; },
        ul({ children }) { return <ul className="my-1-5 pl-5 list-disc" style={{ color: "var(--text-primary)" }}>{children}</ul>; },
        ol({ children }) { return <ol className="my-1-5 pl-5 list-decimal" style={{ color: "var(--text-primary)" }}>{children}</ol>; },
        blockquote({ children }) {
          return <blockquote className="my-3 pl-3-5 border-l-2 rd-r-6" style={{ borderColor: "var(--accent-border)", color: "var(--text-secondary)" }}>{children}</blockquote>;
        },
        h1({ children }) { return <h1 className="text-base font-semibold my-4 txt-primary">{children}</h1>; },
        h2({ children }) { return <h2 className="text-sm font-semibold my-3 txt-secondary">{children}</h2>; },
        h3({ children }) { return <h3 className="text-sm font-medium my-2-5 txt-secondary">{children}</h3>; },
        table({ children }) { return <div className="my-3 ov-xa rd-8 border border-light"><table className="w-full text-sm">{children}</table></div>; },
        th({ children }) { return <th className="px-3 py-2 text-left txt-tertiary font-medium bg-card border-b border-light">{children}</th>; },
        td({ children }) { return <td className="px-3 py-2 txt-primary border-b border-light">{children}</td>; },
        hr() { return <hr className="my-4 border-light" />; },
        strong({ children }) { return <strong className="font-semibold txt-primary">{children}</strong>; },
        em({ children }) { return <em className="txt-primary">{children}</em>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
