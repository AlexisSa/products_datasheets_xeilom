import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, Trash2, FileDown, FileText, X, FolderOpen } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { downloadBulk } from '@/lib/downloadUtils';
import { useToastStore } from '@/store/toastStore';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_FOLDER_NAME = 'fiches-techniques-XEILOM';

interface DownloadCartProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadCart({ isOpen, onClose }: DownloadCartProps) {
  const { items, remove, clear } = useCartStore();
  const addToast = useToastStore((s) => s.add);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showNameModal, setShowNameModal] = useState(false);
  const [folderName, setFolderName] = useState(DEFAULT_FOLDER_NAME);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (showNameModal) {
      setFolderName(DEFAULT_FOLDER_NAME);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showNameModal]);

  const runDownload = async () => {
    if (items.length === 0) return;

    const name = folderName.trim() || DEFAULT_FOLDER_NAME;
    setShowNameModal(false);
    setIsDownloading(true);
    setProgress({ done: 0, total: items.length });
    try {
      const result = await downloadBulk(
        items.map((i) => ({
          name: i.name,
          sheetUrl: i.sheetUrl,
          sku: i.sku,
        })),
        name,
        (done, total) => setProgress({ done, total })
      );

      if (result.failed > 0) {
        addToast(
          `${result.success} fiche(s) dans le ZIP. ${result.failed} non disponible(s).`,
          'info'
        );
      } else {
        addToast(`${result.success} fiche(s) téléchargée(s)`, 'success');
      }
      clear();
      onClose();
    } catch {
      addToast('Erreur lors du téléchargement', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkDownload = () => {
    if (items.length === 0) return;
    setShowNameModal(true);
  };

  return (
    <>
      {showNameModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowNameModal(false)}
            aria-hidden="true"
          />
          <div className="relative bg-card border rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 id="modal-title" className="font-semibold text-lg">
                  Nom du dossier ZIP
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choisissez le nom du dossier principal dans l'archive
                </p>
              </div>
            </div>
            <Input
              ref={inputRef}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={DEFAULT_FOLDER_NAME}
              className="mb-6"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runDownload();
                if (e.key === 'Escape') setShowNameModal(false);
              }}
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowNameModal(false)}
              >
                Annuler
              </Button>
              <Button onClick={runDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Off-canvas drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Panier de téléchargement"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <h2 className="font-semibold text-lg">Fiches sélectionnées</h2>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fermer le panier"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileDown className="h-12 w-12 mb-3 opacity-40" />
                <p className="font-medium">Panier vide</p>
                <p className="text-sm mt-1">
                  Sélectionnez des produits pour télécharger leurs fiches en ZIP
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{item.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{item.sku}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => remove(item.id)}
                      aria-label={`Retirer ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="p-4 border-t shrink-0 space-y-3">
              {isDownloading && (
                <p className="text-sm text-muted-foreground">
                  Téléchargement {progress.done}/{progress.total}…
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkDownload}
                  disabled={isDownloading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isDownloading ? 'Téléchargement…' : 'Télécharger en ZIP'}
                </Button>
                <Button variant="outline" onClick={clear} disabled={isDownloading}>
                  Vider
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}

export function CartTrigger({
  count,
  onClick,
  variant = 'default',
}: {
  count: number;
  onClick: () => void;
  variant?: 'default' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-sm group bg-card hover:bg-muted/80 border border-border"
        aria-label={`Liste de PDF : ${count} fiche${count !== 1 ? 's' : ''} sélectionnée${count !== 1 ? 's' : ''}`}
      >
        <FileText size={16} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline text-xs">Liste de PDF</span>
        <span
          className={cn(
            'flex items-center justify-center px-2 h-5 min-w-5 text-[10px] rounded-full',
            count > 0 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
          )}
        >
          {count}
        </span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative gap-2"
      aria-label={`Panier : ${count} fiche${count !== 1 ? 's' : ''} sélectionnée${count !== 1 ? 's' : ''}`}
    >
      <FileDown className="h-4 w-4" />
      <span className="hidden sm:inline">Panier</span>
      <Badge
        className={cn(
          'h-5 min-w-5 px-1.5 text-xs',
          count > 0 ? 'bg-primary text-primary-foreground border-0' : 'bg-muted text-muted-foreground border-0'
        )}
      >
        {count}
      </Badge>
    </Button>
  );
}
