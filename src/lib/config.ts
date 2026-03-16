/**
 * URL de base pour les pages produits.
 * Exemple: https://www.monsite.com
 * Si vide, utilise les URLs du CSV (xeilom.fr).
 */
export const PRODUCT_BASE_URL =
  import.meta.env.VITE_PRODUCT_BASE_URL || '';

/**
 * Construit l'URL de la page produit.
 */
export function getProductUrl(productId: string, fallbackUrl: string): string {
  if (PRODUCT_BASE_URL) {
    return `${PRODUCT_BASE_URL.replace(/\/$/, '')}/PBSCProduct.asp?PGFLngID=0&ItmID=${productId}`;
  }
  return fallbackUrl;
}

/**
 * URL du proxy pour contourner CORS lors des téléchargements.
 * En dev: utilise le proxy Vite ou une URL absolue.
 * En prod: /api/proxy-download (même origine).
 */
export function getProxyDownloadUrl(targetUrl: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const apiBase = base ? base.replace(/\/$/, '') : '';
  return `${apiBase}/api/proxy-download?url=${encodeURIComponent(targetUrl)}`;
}
