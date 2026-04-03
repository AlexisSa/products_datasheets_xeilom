import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://www.xeilom.fr',
  'https://xeilom.fr',
  'http://xeilom.cluster003.ovh.net',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 20_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

interface ProxyErrorBody {
  code: string;
  message: string;
  status: number;
}

function jsonError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string
) {
  const body: ProxyErrorBody = { code, message, status };
  return res.status(status).json(body);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function encodePathnameSegments(pathname: string): string {
  const segments = pathname.split('/').map((part) => {
    if (!part) return '';
    try {
      return encodeURIComponent(decodeURIComponent(part));
    } catch {
      return encodeURIComponent(part);
    }
  });
  return segments.join('/') || '/';
}

function normalizePdfUrl(raw: string): string | null {
  const t = raw.trim();
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    const m = t.match(/^(https?:\/\/[^/?#]+)([^#]*)(#.*)?$/i);
    if (!m) return null;
    const originAndHost = m[1];
    const pathQuery = m[2] || '/';
    const hash = m[3] || '';
    const qIndex = pathQuery.indexOf('?');
    const pathname =
      qIndex >= 0 ? pathQuery.slice(0, qIndex) : pathQuery || '/';
    const search = qIndex >= 0 ? pathQuery.slice(qIndex) : '';
    const encodedPath = encodePathnameSegments(pathname);
    const rebuilt = `${originAndHost}${encodedPath}${search}${hash}`;
    try {
      u = new URL(rebuilt);
    } catch {
      return null;
    }
  }
  const newPath = encodePathnameSegments(u.pathname);
  try {
    return new URL(newPath + u.search + u.hash, u.origin).href;
  } catch {
    return null;
  }
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some(
      (origin) =>
        parsed.origin === origin || parsed.href.startsWith(origin + '/')
    );
  } catch {
    return false;
  }
}

function extractFilename(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop();
    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function isXeilomHost(hostname: string): boolean {
  return hostname === 'www.xeilom.fr' || hostname === 'xeilom.fr';
}

/** Un seul jeu d’en-têtes, un seul fetch — pas de warm-up ni de retries. */
function browserFetchHeaders(targetUrl: string): Record<string, string> {
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return {
      'User-Agent': BROWSER_UA,
      Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      Referer: 'https://www.xeilom.fr/',
    };
  }
  const xeilom = isXeilomHost(u.hostname);
  return {
    'User-Agent': BROWSER_UA,
    Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    Referer: xeilom ? `${u.origin}/` : 'https://www.xeilom.fr/',
    Origin: xeilom ? u.origin : 'https://www.xeilom.fr',
  };
}

function isPBFilePlayerUrl(url: string): boolean {
  return url.includes('PBFilePlayer.asp');
}

async function resolvePBFilePlayer(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: browserFetchHeaders(url),
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/window\.location\s*=\s*'([^']+)'/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

type FetchPdfSuccess = {
  ok: true;
  buffer: Buffer;
  contentType: string;
  filename: string;
};
type FetchPdfFailure = {
  ok: false;
  code: string;
  message: string;
  upstreamStatus?: number;
};

async function fetchPdf(url: string): Promise<FetchPdfSuccess | FetchPdfFailure> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: browserFetchHeaders(url),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return {
        ok: false,
        code: 'TIMEOUT',
        message: 'Délai dépassé lors du téléchargement du PDF',
      };
    }
    return {
      ok: false,
      code: 'FETCH_FAILED',
      message: 'Impossible de joindre le serveur distant',
    };
  }

  if (!response.ok) {
    const st = response.status;
    if (st === 403) {
      return {
        ok: false,
        code: 'UPSTREAM_FORBIDDEN',
        message:
          'Accès refusé par le serveur distant. Ouvrez l’onglet puis enregistrez le PDF (menu ou Ctrl+S / Cmd+S).',
        upstreamStatus: st,
      };
    }
    if (st === 404) {
      return {
        ok: false,
        code: 'PDF_NOT_FOUND',
        message: 'Fichier PDF introuvable',
        upstreamStatus: st,
      };
    }
    if (st === 429) {
      return {
        ok: false,
        code: 'UPSTREAM_RATE_LIMIT',
        message: 'Trop de requêtes côté serveur distant',
        upstreamStatus: st,
      };
    }
    return {
      ok: false,
      code: 'UPSTREAM_ERROR',
      message: `Erreur distante (${st})`,
      upstreamStatus: st,
    };
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: 'Fichier trop volumineux',
    };
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    return {
      ok: false,
      code: 'READ_BODY_FAILED',
      message: 'Lecture du contenu impossible',
    };
  }

  if (blob.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: 'Fichier trop volumineux',
    };
  }

  const contentType = response.headers.get('content-type') || 'application/pdf';

  if (contentType.includes('text/html')) {
    return {
      ok: false,
      code: 'NOT_PDF',
      message: 'La réponse n’est pas un PDF (page HTML)',
    };
  }

  return {
    ok: true,
    buffer: Buffer.from(await blob.arrayBuffer()),
    contentType,
    filename: extractFilename(url, 'fiche.pdf'),
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée');
  }

  const clientIp =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : (req.headers['x-real-ip'] as string)) || 'unknown';

  if (isRateLimited(clientIp)) {
    return jsonError(
      res,
      429,
      'RATE_LIMIT',
      'Trop de requêtes, réessayez plus tard'
    );
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url : null;
  if (!rawUrl) {
    return jsonError(res, 400, 'MISSING_URL', 'Paramètre url manquant');
  }

  const normalized = normalizePdfUrl(rawUrl);
  if (!normalized) {
    return jsonError(
      res,
      400,
      'INVALID_URL',
      'URL invalide ou impossible à normaliser'
    );
  }

  if (!isAllowedUrl(normalized)) {
    return jsonError(
      res,
      400,
      'URL_NOT_ALLOWED',
      'URL non autorisée pour le proxy'
    );
  }

  try {
    let targetUrl = normalized;

    if (isPBFilePlayerUrl(normalized)) {
      const resolvedUrl = await resolvePBFilePlayer(normalized);
      if (!resolvedUrl) {
        return jsonError(
          res,
          404,
          'PB_RESOLVE_FAILED',
          'Impossible de résoudre le lien PBFilePlayer'
        );
      }
      let absolute = resolvedUrl;
      try {
        absolute = new URL(resolvedUrl, 'https://www.xeilom.fr/').href;
      } catch {
        /* garder resolvedUrl */
      }
      const resolvedNorm = normalizePdfUrl(absolute);
      targetUrl = resolvedNorm || absolute;
      if (!isAllowedUrl(targetUrl)) {
        return jsonError(
          res,
          400,
          'URL_NOT_ALLOWED',
          'URL résolue non autorisée'
        );
      }
    }

    const result = await fetchPdf(targetUrl);

    if (!result.ok) {
      const map: Record<string, number> = {
        PDF_NOT_FOUND: 404,
        NOT_PDF: 404,
        UPSTREAM_FORBIDDEN: 403,
        UPSTREAM_RATE_LIMIT: 429,
        TIMEOUT: 504,
        FILE_TOO_LARGE: 413,
        FETCH_FAILED: 502,
        READ_BODY_FAILED: 502,
        UPSTREAM_ERROR: 502,
      };
      const status = map[result.code] ?? 502;
      return jsonError(res, status, result.code, result.message);
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/"/g, '')}"`
    );
    return res.send(result.buffer);
  } catch (err) {
    console.error('Proxy error:', err);
    return jsonError(res, 500, 'SERVER_ERROR', 'Erreur serveur');
  }
}
