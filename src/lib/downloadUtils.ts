import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getProxyDownloadUrl } from './config';

export interface BulkDownloadResult {
  success: number;
  failed: number;
  total: number;
}

/** Erreur renvoyée par /api/proxy-download (corps JSON) */
export interface ProxyDownloadErrorInfo {
  code: string;
  message: string;
  httpStatus: number;
}

const CONCURRENCY = 5;

function parseProxyError(
  res: Response,
  bodyText: string
): ProxyDownloadErrorInfo {
  try {
    const j = JSON.parse(bodyText) as {
      code?: string;
      message?: string;
      status?: number;
    };
    if (typeof j.code === 'string' && typeof j.message === 'string') {
      return {
        code: j.code,
        message: j.message,
        httpStatus: res.status,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    code: 'UNKNOWN',
    message: 'Échec du téléchargement via le proxy',
    httpStatus: res.status,
  };
}

type FetchViaProxyResult =
  | { ok: true; blob: Blob }
  | { ok: false; error: ProxyDownloadErrorInfo };

async function fetchViaProxy(url: string): Promise<FetchViaProxyResult> {
  const proxyUrl = getProxyDownloadUrl(url);
  let res: Response;
  try {
    res = await fetch(proxyUrl);
  } catch {
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: 'Impossible de joindre le proxy (réseau ou CORS)',
        httpStatus: 0,
      },
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: parseProxyError(res, text) };
  }

  const blob = await res.blob();
  return { ok: true, blob };
}

/**
 * Toast quand le proxy échoue : on ouvre l’URL directe.
 * On ne peut pas enchaîner un téléchargement automatique depuis un autre domaine (limite navigateur).
 */
export function formatFallbackToast(info: ProxyDownloadErrorInfo): string {
  const hints: Record<string, string> = {
    PDF_NOT_FOUND: 'Fichier PDF introuvable.',
    NOT_PDF: 'La réponse n’est pas un PDF.',
    RATE_LIMIT: 'Trop de requêtes vers le proxy, réessayez plus tard.',
    UPSTREAM_RATE_LIMIT: 'Trop de requêtes côté serveur distant.',
    TIMEOUT: 'Délai dépassé.',
    INVALID_URL: 'URL de fiche invalide.',
    URL_NOT_ALLOWED: 'URL non autorisée pour le proxy.',
    MISSING_URL: 'Paramètre manquant.',
    PB_RESOLVE_FAILED: 'Lien intermédiaire non résolu.',
    FILE_TOO_LARGE: 'Fichier trop volumineux.',
    FETCH_FAILED: 'Impossible de joindre le serveur distant.',
    READ_BODY_FAILED: 'Lecture du fichier impossible.',
    UPSTREAM_ERROR: 'Erreur du serveur distant.',
    SERVER_ERROR: 'Erreur serveur du proxy.',
    NETWORK: 'Connexion au proxy impossible.',
    UNKNOWN: 'Échec du téléchargement via le proxy.',
    UPSTREAM_FORBIDDEN:
      'Le serveur bloque le téléchargement automatique. Enregistrez le PDF depuis l’onglet (Ctrl+S / Cmd+S ou menu du lecteur).',
  };

  const detail = info.message?.trim() || hints[info.code] || hints.UNKNOWN;
  return `Ouverture dans un nouvel onglet — ${detail}`;
}

export async function downloadSingle(
  url: string,
  filename: string,
  onFallback?: (info: ProxyDownloadErrorInfo) => void
): Promise<boolean> {
  const result = await fetchViaProxy(url);
  if (result.ok) {
    saveAs(result.blob, filename || 'fiche.pdf');
    return true;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  onFallback?.(result.error);
  return false;
}

export interface BulkDownloadItem {
  name: string;
  sheetUrl: string;
  sku: string;
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number
): Promise<void> {
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

export async function downloadBulk(
  items: BulkDownloadItem[],
  baseFolderName = 'fiches-techniques',
  onProgress?: (done: number, total: number) => void
): Promise<BulkDownloadResult> {
  const zip = new JSZip();
  const safeBaseFolderName = (baseFolderName || 'fiches-techniques').replace(
    /[^a-zA-Z0-9.-]/g,
    '_'
  );
  const rootFolder = zip.folder(safeBaseFolderName);
  let success = 0;
  let failed = 0;
  let completed = 0;

  await runWithConcurrency(
    items,
    async (item) => {
      const result = await fetchViaProxy(item.sheetUrl);
      if (result.ok) {
        try {
          const productFolder = rootFolder?.folder(
            (item.sku || 'produit').replace(/[^a-zA-Z0-9.-]/g, '_')
          );
          const pdfName = `${item.sku}-${item.name.slice(0, 50)}.pdf`.replace(
            /[^a-zA-Z0-9.-]/g,
            '_'
          );
          productFolder?.file(pdfName, result.blob);
          success++;
        } catch {
          failed++;
        }
      } else {
        failed++;
      }
      completed++;
      onProgress?.(completed, items.length);
    },
    CONCURRENCY
  );

  const date = new Date().toISOString().slice(0, 10);
  const filename = `fiches-techniques-XEILOM-${date}.zip`;
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, filename);

  return { success, failed, total: items.length };
}
