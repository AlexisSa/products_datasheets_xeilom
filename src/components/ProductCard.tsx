import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ExternalLink, FileWarning, FileX } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useToastStore } from '@/store/toastStore';
import { downloadSingle } from '@/lib/downloadUtils';
import { getProductUrl } from '@/lib/config';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { toggle, isInCart } = useCartStore();
  const addToast = useToastStore((s) => s.add);
  const inCart = isInCart(product.id);

  const canDownload = product.sheetStatus === 'available';
  const isUnavailable = product.sheetStatus === 'unavailable';

  const handleAddToCart = () => {
    if (canDownload) {
      toggle({
        id: product.id,
        name: product.name,
        sku: product.sku,
        sheetUrl: product.sheetUrl,
        image: product.image,
        imageSmall: product.imageSmall,
      });
    }
  };

  return (
    <Card
      className={`overflow-hidden group hover:shadow-lg transition-shadow flex flex-col ${canDownload ? 'cursor-pointer' : ''} ${isUnavailable ? 'opacity-75' : ''}`}
      onClick={canDownload ? handleAddToCart : undefined}
    >
      <div className="aspect-square bg-muted relative">
        <img
          src={product.image || product.imageSmall}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-contain p-4"
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23e5e7eb" width="100" height="100"/><text x="50" y="55" font-size="12" fill="%239ca3af" text-anchor="middle">No image</text></svg>';
          }}
        />
        <div
          className="absolute top-2 right-2"
          onClick={(e) => e.stopPropagation()}
        >
          {canDownload && (
            <Checkbox
              checked={inCart}
              onChange={handleAddToCart}
              className="bg-background/90 cursor-pointer"
            />
          )}
        </div>
        {isUnavailable && (
          <div className="absolute top-2 left-2">
            <Badge
              className="bg-amber-500/90 text-white border-0 text-[10px] px-1.5 py-0.5 gap-1"
            >
              <FileWarning className="h-3 w-3" />
              PDF indisponible
            </Badge>
          </div>
        )}
        {product.sheetStatus === 'none' && (
          <div className="absolute top-2 left-2">
            <Badge
              className="bg-muted text-muted-foreground border-0 text-[10px] px-1.5 py-0.5 gap-1 opacity-70"
            >
              <FileX className="h-3 w-3" />
              Pas de PDF
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground">
          {product.sku} • {product.brand}
        </p>
        <h3 className="font-medium line-clamp-2 mt-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{product.category}</p>
      </CardContent>
      <CardFooter className="flex gap-2 p-4 pt-0">
        {canDownload && (
          <Button
            size="sm"
            variant="outline"
            onClick={async (e) => {
              e.stopPropagation();
              await downloadSingle(
                product.sheetUrl,
                `${product.sku}.pdf`,
                () => addToast('Fiche ouverte dans un nouvel onglet (CORS)', 'info')
              );
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Télécharger
          </Button>
        )}
        {isUnavailable && (
          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <FileWarning className="h-3.5 w-3.5" />
            Fiche supprimée
          </span>
        )}
        <a
          href={getProductUrl(product.id, product.productUrl)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Voir le produit"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent hover:text-accent-foreground ml-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </CardFooter>
    </Card>
  );
}
