import { lazy, Suspense } from "react";
const MarkdownInner = lazy(() => import("./MarkdownRenderer"));
export function MarkdownRender({ content }: { content: string }) {
  return (
    <Suspense fallback={<pre className="text-sm whitespace-pre-wrap break-words">{content}</pre>}>
      <MarkdownInner content={content} />
    </Suspense>
  );
}
