import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://www.xeilom.fr',
  'https://xeilom.fr',
  'http://xeilom.cluster003.ovh.net',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

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
  } catch { /* ignore */ }
  return fallback;
}

function isPBFilePlayerUrl(url: string): boolean {
  return url.includes('PBFilePlayer.asp');
}

async function resolvePBFilePlayer(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Referer': 'https://www.xeilom.fr/',
      },
      redirect: 'manual',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/window\.location\s*=\s*'([^']+)'/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function fetchPdf(url: string): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
  });

  if (!response.ok) return null;

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) return null;

  const blob = await response.blob();
  if (blob.size > MAX_FILE_SIZE) return null;

  const contentType = response.headers.get('content-type') || 'application/pdf';

  if (contentType.includes('text/html')) return null;

  return {
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : (req.headers['x-real-ip'] as string)) || 'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Trop de requêtes, réessayez plus tard' });
  }

  const url = typeof req.query.url === 'string' ? req.query.url : null;
  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ error: 'URL invalide ou non autorisée' });
  }

  try {
    let targetUrl = url;

    if (isPBFilePlayerUrl(url)) {
      const resolvedUrl = await resolvePBFilePlayer(url);
      if (!resolvedUrl) {
        return res.status(404).json({ error: 'Impossible de résoudre le lien PBFilePlayer' });
      }
      targetUrl = resolvedUrl;
    }

    const result = await fetchPdf(targetUrl);

    if (!result) {
      return res.status(404).json({ error: 'PDF non disponible ou réponse invalide' });
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    );
    return res.send(result.buffer);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
