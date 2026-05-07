import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COOKIE = "concierge_sid";

function parseCookie(header: string | null | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function getOrCreateSessionId(): Promise<string> {
  const cookieHeader = getRequestHeader("cookie");
  let sid = parseCookie(cookieHeader, COOKIE);
  if (sid) {
    const { data } = await supabaseAdmin.from("chat_sessions").select("id").eq("id", sid).maybeSingle();
    if (data) return sid;
  }
  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({})
    .select("id")
    .single();
  if (error || !data) throw new Error("Failed to create session");
  setResponseHeader(
    "set-cookie",
    `${COOKIE}=${data.id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`,
  );
  return data.id;
}

export const ensureSession = createServerFn({ method: "POST" }).handler(async () => {
  const sid = await getOrCreateSessionId();
  return { sessionId: sid };
});