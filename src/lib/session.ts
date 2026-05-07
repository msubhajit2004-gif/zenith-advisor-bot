import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ensureSession = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId?: string | null }) => d)
  .handler(async ({ data }) => {
    if (data.sessionId) {
      const { data: row } = await supabaseAdmin
        .from("chat_sessions")
        .select("id")
        .eq("id", data.sessionId)
        .maybeSingle();
      if (row) return { sessionId: row.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("chat_sessions")
      .insert({})
      .select("id")
      .single();
    if (error || !row) throw new Error("Failed to create session");
    return { sessionId: row.id };
  });