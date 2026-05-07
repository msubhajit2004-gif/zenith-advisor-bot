import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { getCart, removeFromCart, clearCart } from "@/lib/cart.functions";
import { formatPrice } from "@/components/concierge/types";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Checkout — Concierge" },
      { name: "description", content: "Review your cart and complete your purchase." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const getCartFn = useServerFn(getCart);
  const removeFn = useServerFn(removeFromCart);
  const clearFn = useServerFn(clearCart);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const load = useCallback(
    async (sid: string) => {
      const r: any = await getCartFn({ data: { sessionId: sid } });
      setItems(r.items);
      setLoading(false);
    },
    [getCartFn],
  );

  useEffect(() => {
    const sid = localStorage.getItem("concierge_session_id");
    if (!sid) {
      setLoading(false);
      return;
    }
    setSessionId(sid);
    load(sid);
  }, [load]);

  const subtotal = items.reduce(
    (sum, i) => sum + (i.products?.price_cents ?? 0) * i.qty,
    0,
  );
  const tax = Math.round(subtotal * 0.08);

  const checkout = async () => {
    if (!sessionId) return;
    await clearFn({ data: { sessionId } });
    setDone(true);
    setItems([]);
    toast.success("Order confirmed (demo)");
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Concierge
        </Link>
        <h1 className="mt-3 font-serif text-3xl">Checkout</h1>

        {done ? (
          <div className="mt-10 rounded-xl border bg-card p-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
            <h2 className="mt-3 font-serif text-2xl">Order placed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This is a demo — no payment was processed.
            </p>
            <Button asChild className="mt-6">
              <Link to="/">Shop more</Link>
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Your cart is empty. <Link to="/" className="underline">Ask the Concierge</Link>.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex gap-4 rounded-xl border bg-card p-4">
                  {i.products?.image_url && (
                    <img
                      src={i.products.image_url}
                      alt={i.products.name}
                      className="h-20 w-20 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{i.products?.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {i.products?.category}
                    </div>
                    <div className="mt-1 text-sm">
                      {formatPrice(i.products?.price_cents ?? 0)} × {i.qty}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await removeFn({ data: { itemId: i.id } });
                      if (sessionId) load(sessionId);
                    }}
                    className="self-start text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (est.)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatPrice(subtotal + tax)}</span>
              </div>
              <Button className="mt-4 w-full" onClick={checkout}>
                Complete purchase (demo)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}