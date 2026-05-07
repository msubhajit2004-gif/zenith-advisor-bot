import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORIES = [
  "electronics",
  "audio",
  "fitness",
  "home",
  "kitchen",
  "outdoor",
] as const;

type GeneratedProduct = {
  name: string;
  category: string;
  price_cents: number;
  short_desc: string;
  specs: Record<string, string>;
  pros: string[];
  cons: string[];
};

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("category")
    .order("price_cents");
  if (error) throw new Error(error.message);
  return { products: data ?? [] };
});

export const seedCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: { force?: boolean }) => d)
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true });
    if (count && count > 0 && !data.force) {
      return { seeded: false, count };
    }
    if (data.force) {
      await supabaseAdmin.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const userPrompt = `Generate a realistic shopping catalog of 36 products spanning these categories: ${CATEGORIES.join(
      ", ",
    )}. Distribute them roughly evenly (5–7 per category). Cover a wide price range within each category (budget, mid, premium). Real-sounding brand-agnostic product names. Vary specs meaningfully so trade-offs are interesting (battery vs weight, comfort vs price, capacity vs noise, etc.).`;

    const tool = {
      type: "function" as const,
      function: {
        name: "save_catalog",
        description: "Save the generated catalog of products.",
        parameters: {
          type: "object",
          properties: {
            products: {
              type: "array",
              minItems: 30,
              maxItems: 40,
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string", enum: [...CATEGORIES] },
                  price_cents: { type: "integer", minimum: 500, maximum: 500000 },
                  short_desc: { type: "string" },
                  specs: {
                    type: "object",
                    description: "Map of 4-6 spec name -> value strings.",
                    additionalProperties: { type: "string" },
                  },
                  pros: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                  cons: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
                },
                required: ["name", "category", "price_cents", "short_desc", "specs", "pros", "cons"],
                additionalProperties: false,
              },
            },
          },
          required: ["products"],
          additionalProperties: false,
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You generate realistic ecommerce catalogs as structured data." },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "save_catalog" } },
      }),
    });
    if (!res.ok) {
      throw new Error(`Catalog generation failed (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No tool call in catalog response");
    const args = JSON.parse(call.function.arguments) as { products: GeneratedProduct[] };

    const rows = args.products.map((p) => ({
      name: p.name,
      category: p.category,
      price_cents: p.price_cents,
      short_desc: p.short_desc,
      specs: p.specs,
      pros: p.pros,
      cons: p.cons,
      image_url: `https://picsum.photos/seed/${encodeURIComponent(p.name)}/600/400`,
      search_text: [
        p.name,
        p.category,
        p.short_desc,
        ...Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`),
        ...p.pros,
      ].join(" \n "),
    }));

    const { error: insertErr } = await supabaseAdmin.from("products").insert(rows);
    if (insertErr) throw new Error(insertErr.message);

    return { seeded: true, count: rows.length };
  });