import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://www.xeilom.fr',
  'https://xeilom.fr',
  'http://xeilom.cluster003.ovh.net',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SEC_CH_UA =
  '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';

const FETCH_TIMEOUT_MS = 25_000;
/** Tentatives supplémentaires après échec (403 Cloudflare souvent transitoire ou sensible au profil d’en-têtes). */
const MAX_RETRIES = 4;
const RETRY_DELAY_MS_MIN = 450;
const RETRY_DELAY_MS_MAX = 1600;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

/** JSON d'erreur structuré pour le client */
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

/**
 * Encode chaque segment du pathname (espaces, etc.). new URL() échoue si le raw contient des espaces.
 */
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

/**
 * Normalise l’URL cible pour fetch (pathname encodé).
 */
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

type HeaderProfile = 'full' | 'minimal';

function isXeilomHost(hostname: string): boolean {
  return hostname === 'www.xeilom.fr' || hostname === 'xeilom.fr';
}

/**
 * En-têtes proches de Chrome : Client Hints + Sec-Fetch pour mieux passer certains WAF Cloudflare.
 * `minimal` : repli si 403 (certaines configs réagissent mal à Sec-Fetch / Origin).
 */
function browserFetchHeaders(
  targetUrl: string,
  profile: HeaderProfile = 'full'
): Record<string, string> {
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return {
      'User-Agent': BROWSER_UA,
      Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    };
  }

  const xeilom = isXeilomHost(u.hostname);

  if (profile === 'minimal') {
    return {
      'User-Agent': BROWSER_UA,
      Accept: '*/*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      ...(xeilom
        ? { Referer: `${u.origin}/` }
        : { Referer: 'https://www.xeilom.fr/' }),
    };
  }

  const base: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    Referer: xeilom ? `${u.origin}/` : 'https://www.xeilom.fr/',
    Origin: xeilom ? u.origin : 'https://www.xeilom.fr',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Ch-Ua': SEC_CH_UA,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  };

  if (xeilom) {
    base['Sec-Fetch-Dest'] = 'document';
    base['Sec-Fetch-Mode'] = 'navigate';
    base['Sec-Fetch-Site'] = 'same-origin';
    base['Sec-Fetch-User'] = '?1';
    base['Upgrade-Insecure-Requests'] = '1';
  } else {
    base['Sec-Fetch-Dest'] = 'document';
    base['Sec-Fetch-Mode'] = 'navigate';
    base['Sec-Fetch-Site'] = 'cross-site';
    base['Sec-Fetch-User'] = '?1';
  }

  return base;
}

/** Récupère des cookies __cf_* / session après une visite de la page d’accueil (souvent utile avec Cloudflare). */
async function tryWarmCookiesForXeilom(): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.xeilom.fr/', {
      method: 'GET',
      headers: browserFetchHeaders('https://www.xeilom.fr/', 'full'),
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    });
    await res.arrayBuffer();
    const h = res.headers as Headers & { getSetCookie?: () => string[] };
    if (typeof h.getSetCookie === 'function') {
      const parts = h
        .getSetCookie()
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function isPBFilePlayerUrl(url: string): boolean {
  return url.includes('PBFilePlayer.asp');
}

async function resolvePBFilePlayer(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: browserFetchHeaders(url, 'full'),
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetryUpstream(status: number): boolean {
  return (
    status === 403 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
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

async function fetchPdfOnce(
  url: string,
  headers: Record<string, string>
): Promise<FetchPdfSuccess | FetchPdfFailure> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
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
          'Accès refusé par le serveur (protection type Cloudflare). Essayez depuis un nouvel onglet.',
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

async function fetchPdfWithRetries(url: string): Promise<FetchPdfSuccess | FetchPdfFailure> {
  let last: FetchPdfFailure | null = null;
  let profile: HeaderProfile = 'full';

  const u = new URL(url);
  const cookies = isXeilomHost(u.hostname)
    ? await tryWarmCookiesForXeilom()
    : undefined;

  function withCookies(h: Record<string, string>): Record<string, string> {
    if (!cookies) return h;
    return { ...h, Cookie: cookies };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay =
        RETRY_DELAY_MS_MIN +
        Math.random() * (RETRY_DELAY_MS_MAX - RETRY_DELAY_MS_MIN);
      await sleep(delay);
    }

    const hdrs = withCookies(browserFetchHeaders(url, profile));
    const result = await fetchPdfOnce(url, hdrs);
    if (result.ok) return result;

    last = result;
    const st = result.upstreamStatus;

    if (st === 403) {
      profile = profile === 'full' ? 'minimal' : 'full';
      continue;
    }

    if (st !== undefined && shouldRetryUpstream(st)) {
      continue;
    }
    return result;
  }

  return last ?? {
    ok: false,
    code: 'UNKNOWN',
    message: 'Échec après plusieurs tentatives',
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

    const result = await fetchPdfWithRetries(targetUrl);

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
