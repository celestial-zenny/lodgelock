// Re-mounts on every navigation, so each page gets one short enter transition (disabled for reduced motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
