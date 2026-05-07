import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getOrCreateCart(sessionId: string) {
  const existing = await supabaseAdmin
    .from("carts")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const { data, error } = await supabaseAdmin
    .from("carts")
    .insert({ session_id: sessionId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "cart create failed");
  return data.id;
}

export const getCart = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const cartId = await getOrCreateCart(data.sessionId);
    const { data: items } = await supabaseAdmin
      .from("cart_items")
      .select("id, qty, product_id, products(*)")
      .eq("cart_id", cartId);
    return { cartId, items: items ?? [] };
  });

export const addToCart = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; productId: string; qty?: number }) => d)
  .handler(async ({ data }) => {
    const cartId = await getOrCreateCart(data.sessionId);
    const existing = await supabaseAdmin
      .from("cart_items")
      .select("id, qty")
      .eq("cart_id", cartId)
      .eq("product_id", data.productId)
      .maybeSingle();
    if (existing.data) {
      await supabaseAdmin
        .from("cart_items")
        .update({ qty: existing.data.qty + (data.qty ?? 1) })
        .eq("id", existing.data.id);
    } else {
      await supabaseAdmin
        .from("cart_items")
        .insert({ cart_id: cartId, product_id: data.productId, qty: data.qty ?? 1 });
    }
    return { ok: true };
  });

export const removeFromCart = createServerFn({ method: "POST" })
  .inputValidator((d: { itemId: string }) => d)
  .handler(async ({ data }) => {
    await supabaseAdmin.from("cart_items").delete().eq("id", data.itemId);
    return { ok: true };
  });

export const clearCart = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const cartId = await getOrCreateCart(data.sessionId);
    await supabaseAdmin.from("cart_items").delete().eq("cart_id", cartId);
    return { ok: true };
  });