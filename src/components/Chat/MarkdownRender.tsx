import { lazy, Suspense } from "react";
const MarkdownInner = lazy(() => import("./MarkdownRenderer"));
export function MarkdownRender({ content, highlight }: { content: string; highlight?: string }) {
  return (
    <Suspense fallback={<pre className="text-sm whitespace-pre-wrap break-words">{content}</pre>}>
      <MarkdownInner content={content} highlight={highlight} />
    </Suspense>
  );
}
