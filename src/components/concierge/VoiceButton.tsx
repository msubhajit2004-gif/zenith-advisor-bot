import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onTranscript: (text: string) => void;
};

export function VoiceButton({ onTranscript }: Props) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scribe, setScribe] = useState<any>(null);

  const stop = useCallback(async () => {
    if (scribe) {
      try {
        await scribe.disconnect();
      } catch {}
    }
    setScribe(null);
    setActive(false);
  }, [scribe]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const tokenRes = await fetch("/api/scribe-token", { method: "POST" });
      if (!tokenRes.ok) {
        throw new Error(
          tokenRes.status === 503
            ? "Voice not configured. Add ELEVENLABS_API_KEY to enable."
            : "Could not start voice",
        );
      }
      const { token } = await tokenRes.json();

      const mod = await import("@elevenlabs/react");
      // useScribe is a hook; we need the imperative client. Fall back to dynamic Conversation API
      // The package also exports a low-level client; simplest is Web Speech if SDK unavailable here.
      // Use the SDK's plain client:
      // @ts-ignore - runtime import
      const { ScribeClient } = mod as any;
      if (!ScribeClient) {
        throw new Error("Voice SDK unavailable");
      }
      const client = new ScribeClient({
        modelId: "scribe_v2_realtime",
        commitStrategy: "vad",
        onCommittedTranscript: (data: any) => {
          if (data?.text) onTranscript(data.text);
        },
      });
      await client.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true } });
      setScribe(client);
      setActive(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Voice unavailable");
    } finally {
      setLoading(false);
    }
  }, [onTranscript]);

  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "outline"}
      onClick={active ? stop : start}
      disabled={loading}
      title="Voice input"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}