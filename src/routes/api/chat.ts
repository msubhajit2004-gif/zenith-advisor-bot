import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CONCIERGE_SYSTEM_PROMPT } from "@/lib/system-prompt";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "ask_followup",
      description:
        "Ask 2-3 clarifying questions to discover hidden constraints before recommending. Use in Phase 1 only.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                quick_replies: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 5,
                },
              },
              required: ["question", "quick_replies"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "Search the live product catalog using a natural-language query and optional filters.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
          max_price_cents: { type: "integer" },
          min_price_cents: { type: "integer" },
          limit: { type: "integer", minimum: 1, maximum: 12 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "present_recommendations",
      description:
        "Show 2 or 3 product recommendations to the user with personalized 'why this fits' and explicit trade-offs.",
      parameters: {
        type: "object",
        properties: {
          product_ids: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: { type: "string" },
          },
          why_this_fits: {
            type: "array",
            description: "One per product_id, in the same order.",
            items: { type: "string" },
          },
          tradeoffs: {
            type: "string",
            description:
              "Explicit trade-off explanation. Format: 'Product A is the [Budget/Premium/Value] choice. You pay $X more/less for [feature].'",
          },
          reasoning: {
            type: "object",
            properties: {
              detected_intent: { type: "string" },
              constraints: { type: "array", items: { type: "string" } },
              why_chosen: { type: "string" },
              why_rejected: { type: "string" },
            },
            required: ["detected_intent", "constraints", "why_chosen", "why_rejected"],
            additionalProperties: false,
          },
        },
        required: ["product_ids", "why_this_fits", "tradeoffs", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a specific product to the user's cart when they explicitly ask to buy / add it.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          qty: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
] as const;

async function searchCatalog(args: {
  query: string;
  category?: string;
  max_price_cents?: number;
  min_price_cents?: number;
  limit?: number;
}) {
  let q = supabaseAdmin.from("products").select("*");
  if (args.category) q = q.eq("category", args.category);
  if (args.max_price_cents) q = q.lte("price_cents", args.max_price_cents);
  if (args.min_price_cents) q = q.gte("price_cents", args.min_price_cents);
  q = q.textSearch("search_text", args.query.split(/\s+/).filter(Boolean).join(" | "), {
    type: "websearch",
    config: "english",
  });
  const { data, error } = await q.limit(args.limit ?? 8);
  if (error || !data || data.length === 0) {
    // fallback: ilike on name + short_desc
    const tokens = args.query.split(/\s+/).filter(Boolean).slice(0, 4);
    let f = supabaseAdmin.from("products").select("*");
    if (args.category) f = f.eq("category", args.category);
    if (args.max_price_cents) f = f.lte("price_cents", args.max_price_cents);
    if (args.min_price_cents) f = f.gte("price_cents", args.min_price_cents);
    if (tokens.length) {
      const ors = tokens
        .map((t) => `name.ilike.%${t}%,short_desc.ilike.%${t}%,search_text.ilike.%${t}%`)
        .join(",");
      f = f.or(ors);
    }
    const fb = await f.limit(args.limit ?? 8);
    return fb.data ?? [];
  }
  return data;
}

async function getOrCreateCartId(sessionId: string) {
  const existing = await supabaseAdmin
    .from("carts")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const { data } = await supabaseAdmin
    .from("carts")
    .insert({ session_id: sessionId })
    .select("id")
    .single();
  return data!.id;
}

async function callAi(messages: any[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: TOOLS,
    }),
  });
  if (res.status === 429) {
    throw Object.assign(new Error("Rate limit reached. Try again in a moment."), { status: 429 });
  }
  if (res.status === 402) {
    throw Object.assign(new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage."), {
      status: 402,
    });
  }
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            sessionId: string;
            message: string;
          };
          if (!body.sessionId || !body.message) {
            return new Response(JSON.stringify({ error: "Missing sessionId or message" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // load history
          const { data: history } = await supabaseAdmin
            .from("chat_messages")
            .select("role, content, tool_calls")
            .eq("session_id", body.sessionId)
            .order("created_at");

          await supabaseAdmin
            .from("chat_messages")
            .insert({ session_id: body.sessionId, role: "user", content: body.message });

          const messages: any[] = [
            { role: "system", content: CONCIERGE_SYSTEM_PROMPT },
            ...(history ?? [])
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: body.message },
          ];

          // tool loop (max 4 iterations)
          let finalText = "";
          let recommendations: any = null;
          let followups: any = null;
          let reasoning: any = null;
          let cartAdded: { productId: string }[] = [];
          const productResultsCache: Record<string, any> = {};

          for (let i = 0; i < 4; i++) {
            const json = await callAi(messages);
            const msg = json.choices?.[0]?.message;
            if (!msg) break;
            messages.push(msg);

            const toolCalls = msg.tool_calls ?? [];
            if (toolCalls.length === 0) {
              finalText = msg.content ?? "";
              break;
            }

            for (const call of toolCalls) {
              const name = call.function.name;
              const args = JSON.parse(call.function.arguments || "{}");
              let result: any = { ok: true };

              if (name === "search_catalog") {
                const products = await searchCatalog(args);
                products.forEach((p: any) => (productResultsCache[p.id] = p));
                result = {
                  products: products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price_cents: p.price_cents,
                    short_desc: p.short_desc,
                    specs: p.specs,
                    pros: p.pros,
                    cons: p.cons,
                  })),
                };
              } else if (name === "ask_followup") {
                followups = args;
                result = { shown: true };
              } else if (name === "present_recommendations") {
                const validIds = (args.product_ids ?? []).filter(
                  (id: string) => productResultsCache[id],
                );
                if (validIds.length < 2) {
                  result = { error: "Invalid product_ids — call search_catalog first." };
                } else {
                  const products = validIds.map((id: string) => productResultsCache[id]);
                  recommendations = {
                    product_ids: validIds,
                    products,
                    why_this_fits: args.why_this_fits,
                    tradeoffs: args.tradeoffs,
                  };
                  reasoning = args.reasoning;
                  result = { displayed: true };
                }
              } else if (name === "add_to_cart") {
                const cartId = await getOrCreateCartId(body.sessionId);
                const existing = await supabaseAdmin
                  .from("cart_items")
                  .select("id, qty")
                  .eq("cart_id", cartId)
                  .eq("product_id", args.product_id)
                  .maybeSingle();
                if (existing.data) {
                  await supabaseAdmin
                    .from("cart_items")
                    .update({ qty: existing.data.qty + (args.qty ?? 1) })
                    .eq("id", existing.data.id);
                } else {
                  await supabaseAdmin
                    .from("cart_items")
                    .insert({
                      cart_id: cartId,
                      product_id: args.product_id,
                      qty: args.qty ?? 1,
                    });
                }
                cartAdded.push({ productId: args.product_id });
                result = { added: true };
              }

              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
            }
          }

          const productIds: string[] = recommendations?.product_ids ?? [];

          await supabaseAdmin.from("chat_messages").insert({
            session_id: body.sessionId,
            role: "assistant",
            content: finalText,
            tool_calls: { recommendations, followups, cartAdded } as any,
            reasoning: reasoning as any,
            product_ids: productIds,
          });

          return new Response(
            JSON.stringify({
              text: finalText,
              recommendations,
              followups,
              reasoning,
              cartAdded,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          const status = e?.status ?? 500;
          return new Response(JSON.stringify({ error: e?.message ?? "Server error" }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});