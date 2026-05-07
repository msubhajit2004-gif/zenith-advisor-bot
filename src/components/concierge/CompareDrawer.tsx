import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { compareProducts } from "@/lib/compare.functions";
import { formatPrice, type ProductRow } from "./types";

type Props = {
  open: boolean;
  productIds: string[];
  onOpenChange: (v: boolean) => void;
  onRemove: (id: string) => void;
  onAdd: (id: string) => void;
};

export function CompareDrawer({ open, productIds, onOpenChange, onRemove, onAdd }: Props) {
  const compareFn = useServerFn(compareProducts);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || productIds.length < 2) {
      setProducts([]);
      setSummary("");
      return;
    }
    setLoading(true);
    compareFn({ data: { productIds } })
      .then((r: any) => {
        setProducts(r.products);
        setSummary(r.summary);
      })
      .finally(() => setLoading(false));
  }, [open, productIds, compareFn]);

  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.specs ?? {}))),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Side-by-side comparison</SheetTitle>
        </SheetHeader>

        {productIds.length < 2 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Select at least 2 products to compare.
          </p>
        ) : loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {summary && (
              <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                  Concierge verdict
                </div>
                <p>{summary}</p>
              </div>
            )}

            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))` }}
            >
              {products.map((p) => (
                <div key={p.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-serif text-base leading-tight">{p.name}</h3>
                    <button
                      onClick={() => onRemove(p.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-lg font-semibold">{formatPrice(p.price_cents)}</div>
                  <Button size="sm" className="mt-3 w-full" onClick={() => onAdd(p.id)}>
                    Add to cart
                  </Button>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {allSpecKeys.map((key) => {
                    const values = products.map((p) => p.specs?.[key] ?? "—");
                    const allSame = values.every((v) => v === values[0]);
                    return (
                      <tr key={key} className="border-t first:border-t-0">
                        <td className="bg-muted/40 p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </td>
                        {values.map((v, i) => (
                          <td
                            key={i}
                            className={`p-3 ${allSame ? "" : "bg-accent/5 font-medium"}`}
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}