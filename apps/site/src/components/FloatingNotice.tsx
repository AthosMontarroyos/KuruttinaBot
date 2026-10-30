import type { ReactNode } from 'react';

function FloatingNotice({ children, motionClass }: { children: ReactNode; motionClass: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-3">
      <p role="status" className={`pointer-events-auto ${motionClass} rounded-xl border border-border bg-surface px-4 py-3 text-sm motion-reduce:animate-none`}>{children}</p>
    </div>
  );
}

export { FloatingNotice };
