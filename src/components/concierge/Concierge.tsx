import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Brain,
  Loader2,
  Send,
  ShoppingBag,
  Sparkles,
  Scale,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { ensureSession } from "@/lib/session";
import { seedCatalog } from "@/lib/catalog.functions";
import { addToCart } from "@/lib/cart.functions";
import { ProductCard } from "./ProductCard";
import { CompareDrawer } from "./CompareDrawer";
import { CartSheet } from "./CartSheet";
import { VoiceButton } from "./VoiceButton";
import type { ChatTurn, Recommendations } from "./types";

const SESSION_KEY = "concierge_session_id";
const STARTER_PROMPTS = [
  "I need new wireless headphones",
  "Help me pick a coffee maker",
  "Best running watch under $300",
  "Suggest a small kitchen gadget I'd actually use",
];

export function Concierge() {
  const ensureSessionFn = useServerFn(ensureSession);
  const seedFn = useServerFn(seedCatalog);
  const addFn = useServerFn(addToCart);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartRefresh, setCartRefresh] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize session + ensure catalog seeded
  useEffect(() => {
    const existing = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    ensureSessionFn({ data: { sessionId: existing } }).then((r: any) => {
      setSessionId(r.sessionId);
      localStorage.setItem(SESSION_KEY, r.sessionId);
    });
    setSeeding(true);
    seedFn({ data: {} })
      .then((r: any) => {
        if (r.seeded) toast.success(`Catalog ready (${r.count} products)`);
      })
      .catch((e) => toast.error(`Catalog seed failed: ${e.message}`))
      .finally(() => setSeeding(false));
  }, [ensureSessionFn, seedFn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  const send = async (text: string) => {
    if (!text.trim() || !sessionId || sending) return;
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text: text.trim(),
    };
    setTurns((t) => [...t, userTurn]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chat failed");
      const assistantTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: json.text ?? "",
        recommendations: json.recommendations,
        followups: json.followups,
        reasoning: json.reasoning,
      };
      setTurns((t) => [...t, assistantTurn]);
      if (json.cartAdded?.length) {
        toast.success("Added to your cart");
        setCartRefresh((n) => n + 1);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const handleAdd = async (productId: string) => {
    if (!sessionId) return;
    await addFn({ data: { sessionId, productId } });
    toast.success("Added to cart");
    setCartRefresh((n) => n + 1);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= 3) {
        toast.info("Compare up to 3 products");
        return ids;
      }
      return [...ids, id];
    });
  };

  const latestRecs = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const r = turns[i].recommendations;
      if (r) return r;
    }
    return null as Recommendations | null;
  }, [turns]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-xl leading-tight">Concierge</h1>
              <p className="text-xs text-muted-foreground">Your AI shopping advisor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Switch
                id="reasoning"
                checked={showReasoning}
                onCheckedChange={setShowReasoning}
              />
              <Label htmlFor="reasoning" className="text-xs cursor-pointer">
                <Brain className="mr-1 inline h-3 w-3" />
                Show reasoning
              </Label>
            </div>
            {compareIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCompareOpen(true)}>
                <Scale className="h-4 w-4" /> Compare ({compareIds.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="h-4 w-4" /> Cart
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        {/* Chat column */}
        <section className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border bg-card shadow-sm">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
            {turns.length === 0 && (
              <div className="mx-auto max-w-2xl text-center">
                <div className="mb-3 inline-flex rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs uppercase tracking-wide text-accent-foreground">
                  Browse · Search · Compare · Buy
                </div>
                <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                  Tell me what you're shopping for.
                </h2>
                <p className="mt-3 text-muted-foreground">
                  I'll ask a couple of sharp questions, surface 2–3 options that actually fit, and
                  walk you through the trade-offs — no scrolling endless results.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      disabled={seeding}
                      className="rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {seeding && (
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating live catalog…
                  </p>
                )}
              </div>
            )}

            <div className="space-y-6">
              {turns.map((t) => (
                <TurnView
                  key={t.id}
                  turn={t}
                  showReasoning={showReasoning}
                  onSendQuickReply={send}
                  onAdd={handleAdd}
                  onToggleCompare={toggleCompare}
                  compareIds={compareIds}
                />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t bg-background/60 p-3"
          >
            <VoiceButton
              onPartial={(t) => setInput(t)}
              onFinal={(t) => {
                setInput(t);
              }}
            />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you need…"
              disabled={sending || !sessionId}
              className="flex-1"
            />
            <Button type="submit" disabled={sending || !input.trim() || !sessionId}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>

        {/* Right rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-serif text-lg">Latest picks</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {latestRecs
                  ? "From the most recent recommendation."
                  : "Recommendations will appear here as we chat."}
              </p>
              {latestRecs && (
                <ul className="mt-3 space-y-2">
                  {latestRecs.products.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        ${(p.price_cents / 100).toFixed(0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border bg-accent/10 p-4 text-xs">
              <div className="font-semibold uppercase tracking-wide">Tip for judges</div>
              <p className="mt-1 text-muted-foreground">
                Toggle <strong>Show reasoning</strong> in the header to see the agent's
                detected intent, constraints, tool calls, and why it picked vs rejected each
                product.
              </p>
            </div>
          </div>
        </aside>
      </main>

      <CompareDrawer
        open={compareOpen}
        productIds={compareIds}
        onOpenChange={setCompareOpen}
        onRemove={(id) => setCompareIds((ids) => ids.filter((x) => x !== id))}
        onAdd={handleAdd}
      />
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        sessionId={sessionId}
        refreshKey={cartRefresh}
        onChanged={() => setCartRefresh((n) => n + 1)}
      />
    </div>
  );
}

function TurnView({
  turn,
  showReasoning,
  onSendQuickReply,
  onAdd,
  onToggleCompare,
  compareIds,
}: {
  turn: ChatTurn;
  showReasoning: boolean;
  onSendQuickReply: (text: string) => void;
  onAdd: (id: string) => void;
  onToggleCompare: (id: string) => void;
  compareIds: string[];
}) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-foreground">
          {turn.text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {turn.text && (
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-foreground whitespace-pre-wrap">
          {turn.text}
        </div>
      )}

      {turn.followups && (
        <div className="space-y-2 pl-2">
          {turn.followups.questions.map((q, idx) => (
            <div key={idx}>
              <p className="text-sm font-medium">{q.question}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {q.quick_replies.map((r) => (
                  <button
                    key={r}
                    onClick={() => onSendQuickReply(r)}
                    className="rounded-full border bg-background px-3 py-1 text-xs hover:border-accent hover:bg-accent/10"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {turn.recommendations && (
        <div className="space-y-3">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${turn.recommendations.products.length}, minmax(0, 1fr))`,
            }}
          >
            {turn.recommendations.products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                whyFits={turn.recommendations!.why_this_fits[i]}
                onAdd={onAdd}
                onCompareToggle={onToggleCompare}
                inCompare={compareIds.includes(p.id)}
              />
            ))}
          </div>
          {turn.recommendations.tradeoffs && (
            <div className="rounded-md border-l-4 border-accent bg-accent/10 p-3 text-sm">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                Trade-off
              </div>
              {turn.recommendations.tradeoffs}
            </div>
          )}
        </div>
      )}

      {showReasoning && turn.reasoning && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Brain className="h-3 w-3" /> Concierge reasoning
            <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-dashed bg-muted/40 p-3 text-xs">
            <ReasoningRow label="Detected intent" value={turn.reasoning.detected_intent} />
            <ReasoningRow
              label="Constraints"
              value={turn.reasoning.constraints.join(" · ") || "—"}
            />
            <ReasoningRow label="Why these were chosen" value={turn.reasoning.why_chosen} />
            <ReasoningRow
              label="Why others were rejected"
              value={turn.reasoning.why_rejected}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function ReasoningRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}