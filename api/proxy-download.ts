import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://www.xeilom.fr', 'https://xeilom.fr'];

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = typeof req.query.url === 'string' ? req.query.url : null;
  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ error: 'URL invalide ou non autorisée' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ProductHub/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).send('Erreur de récupération');
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType =
      response.headers.get('content-type') || 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fiche.pdf"`
    );
    return res.send(buffer);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
