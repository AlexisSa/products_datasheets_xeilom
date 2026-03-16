import { useToastStore } from '@/store/toastStore';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

export function Toast() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg bg-card text-card-foreground',
              toast.type === 'success' && 'border-green-500/50',
              toast.type === 'error' && 'border-destructive/50',
              toast.type === 'info' && 'border-border'
            )}
            role="alert"
          >
            <Icon
              className={cn(
                'h-5 w-5 shrink-0',
                toast.type === 'success' && 'text-green-600 dark:text-green-400',
                toast.type === 'error' && 'text-destructive',
                toast.type === 'info' && 'text-muted-foreground'
              )}
            />
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="shrink-0 p-1 rounded hover:bg-muted"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
