import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ExternalLink } from 'lucide-react';
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

  const handleAddToCart = () => {
    if (product.hasSheet) {
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
      className={`overflow-hidden group hover:shadow-lg transition-shadow flex flex-col ${product.hasSheet ? 'cursor-pointer' : ''}`}
      onClick={product.hasSheet ? handleAddToCart : undefined}
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
          {product.hasSheet && (
            <Checkbox
              checked={inCart}
              onChange={handleAddToCart}
              className="bg-background/90 cursor-pointer"
            />
          )}
        </div>
      </div>
      <CardContent className="p-4 flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground">
          {product.sku} • {product.brand}
        </p>
        <h3 className="font-medium line-clamp-2 mt-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{product.category}</p>
      </CardContent>
      <CardFooter className="flex gap-2 p-4 pt-0">
        {product.hasSheet && (
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
        <a
          href={getProductUrl(product.id, product.productUrl)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Voir le produit"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent hover:text-accent-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </CardFooter>
    </Card>
  );
}
