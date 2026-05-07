import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const compareProducts = createServerFn({ method: "POST" })
  .inputValidator((d: { productIds: string[] }) => d)
  .handler(async ({ data }) => {
    const ids = data.productIds.slice(0, 3);
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("*")
      .in("id", ids);
    if (!products || products.length < 2) return { products: products ?? [], summary: "" };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { products, summary: "" };

    const prompt = `Compare these products in 2 short sentences. Be specific about the trade-offs (price vs feature). Do not list specs, just the verdict.\n\n${products
      .map(
        (p) =>
          `${p.name} ($${(p.price_cents / 100).toFixed(0)}) — ${p.short_desc}\nSpecs: ${JSON.stringify(p.specs)}`,
      )
      .join("\n\n")}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a concise shopping advisor." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const json = await res.json();
    const summary = json.choices?.[0]?.message?.content ?? "";
    return { products, summary };
  });