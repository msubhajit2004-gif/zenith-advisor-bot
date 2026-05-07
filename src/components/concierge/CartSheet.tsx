import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getCart, removeFromCart } from "@/lib/cart.functions";
import { formatPrice } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string | null;
  refreshKey: number;
  onChanged: () => void;
};

export function CartSheet({ open, onOpenChange, sessionId, refreshKey, onChanged }: Props) {
  const getCartFn = useServerFn(getCart);
  const removeFn = useServerFn(removeFromCart);
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(() => {
    if (!sessionId) return;
    getCartFn({ data: { sessionId } }).then((r: any) => setItems(r.items));
  }, [sessionId, getCartFn]);

  useEffect(() => {
    if (open) load();
  }, [open, refreshKey, load]);

  const subtotal = items.reduce(
    (sum, i) => sum + (i.products?.price_cents ?? 0) * i.qty,
    0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Your cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3 rounded-lg border bg-card p-3">
                  {i.products?.image_url && (
                    <img
                      src={i.products.image_url}
                      alt={i.products.name}
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium leading-tight">{i.products?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(i.products?.price_cents ?? 0)} × {i.qty}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await removeFn({ data: { itemId: i.id } });
                      load();
                      onChanged();
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatPrice(subtotal)}</span>
          </div>
          <Button asChild className="w-full" disabled={items.length === 0}>
            <Link to="/cart" onClick={() => onOpenChange(false)}>
              Go to checkout
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}