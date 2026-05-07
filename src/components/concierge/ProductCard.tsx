import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Scale } from "lucide-react";
import { formatPrice, type ProductRow } from "./types";

type Props = {
  product: ProductRow;
  whyFits?: string;
  onAdd: (id: string) => void;
  onCompareToggle: (id: string) => void;
  inCompare: boolean;
};

export function ProductCard({ product, whyFits, onAdd, onCompareToggle, inCompare }: Props) {
  const topSpecs = Object.entries(product.specs).slice(0, 4);
  return (
    <Card className="overflow-hidden flex flex-col gap-0 p-0 transition-all hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant="secondary" className="mb-1 text-[10px] uppercase tracking-wide">
              {product.category}
            </Badge>
            <h3 className="font-serif text-lg leading-tight">{product.name}</h3>
          </div>
          <div className="text-lg font-semibold whitespace-nowrap">
            {formatPrice(product.price_cents)}
          </div>
        </div>

        {whyFits && (
          <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground/70">
              Why this fits you
            </div>
            <p className="leading-snug text-foreground">{whyFits}</p>
          </div>
        )}

        <ul className="space-y-1 text-xs text-muted-foreground">
          {topSpecs.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2">
              <span className="capitalize">{k.replace(/_/g, " ")}</span>
              <span className="text-foreground text-right">{v}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={() => onAdd(product.id)}>
            <Plus className="h-4 w-4" /> Add to cart
          </Button>
          <Button
            size="sm"
            variant={inCompare ? "default" : "outline"}
            onClick={() => onCompareToggle(product.id)}
          >
            <Scale className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}