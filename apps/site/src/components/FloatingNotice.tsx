import type { ReactNode } from 'react';

/** Aviso flutuante no topo da tela; `action` é um botão opcional ao lado do texto (por exemplo, "Salvar"). */
function FloatingNotice({ children, motionClass, action }: { children: ReactNode; motionClass: string; action?: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-3">
      <div role="status" className={`pointer-events-auto ${motionClass} flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm motion-reduce:animate-none`}>
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export { FloatingNotice };
