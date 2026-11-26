// Re-mounts on every navigation, so each page gets one short enter transition (disabled for reduced motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div id="content" tabIndex={-1} className="page-enter flex flex-1 flex-col outline-none">{children}</div>;
}
