import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, Trash2, FileDown, X, FolderOpen } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { downloadBulk } from '@/lib/downloadUtils';
import { useToastStore } from '@/store/toastStore';
import { useState, useRef, useEffect } from 'react';

const DEFAULT_FOLDER_NAME = 'fiches-techniques-XEILOM';

export function DownloadCart() {
  const { items, remove, clear } = useCartStore();
  const addToast = useToastStore((s) => s.add);
  const [isOpen, setIsOpen] = useState(false);
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
          `${result.success} fiche(s) dans le ZIP. ${result.failed} non disponible(s) (CORS).`,
          'info'
        );
      } else {
        addToast(`${result.success} fiche(s) téléchargée(s)`, 'success');
      }
      clear();
      setIsOpen(false);
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
                  Choisissez le nom du dossier principal dans l’archive
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
      {items.length > 0 && (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {isOpen && (
          <div
            className="bg-card border rounded-lg shadow-lg p-4 w-80 max-h-64 overflow-hidden flex flex-col"
            role="dialog"
            aria-label="Panier de téléchargement"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Fiches sélectionnées</h3>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer le panier"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ul className="flex-1 overflow-y-auto space-y-1 text-sm">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0"
                >
                  <span className="truncate flex-1">{item.name}</span>
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
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t">
              {isDownloading && (
                <p className="text-xs text-muted-foreground">
                  Téléchargement {progress.done}/{progress.total}…
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleBulkDownload}
                  disabled={isDownloading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-1" />
                  {isDownloading
                    ? 'Téléchargement...'
                    : 'Télécharger la sélection'}
                </Button>
                <Button variant="outline" size="sm" onClick={clear}>
                  Vider
                </Button>
              </div>
            </div>
          </div>
        )}
        <Button
          size="lg"
          className="rounded-full shadow-lg h-14 px-6"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <FileDown className="h-5 w-5 mr-2" />
          Panier
          <Badge className="ml-2 bg-primary/20 text-primary-foreground">
            {items.length}
          </Badge>
        </Button>
      </div>
      )}
    </>
  );
}
