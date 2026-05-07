import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
};

export function VoiceButton({ onPartial, onFinal }: Props) {
  const [active, setActive] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {}
    };
  }, []);

  const toggle = useCallback(() => {
    if (active) {
      try {
        recRef.current?.stop();
      } catch {}
      setActive(false);
      return;
    }
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      toast.error("Voice input not supported in this browser. Try Chrome.");
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let interim = "";
      let finalTxt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) onPartial(interim);
      if (finalTxt) onFinal(finalTxt.trim());
    };
    rec.onerror = (e: any) => {
      toast.error(`Voice error: ${e.error}`);
      setActive(false);
    };
    rec.onend = () => setActive(false);
    rec.start();
    recRef.current = rec;
    setActive(true);
  }, [active, onPartial, onFinal]);

  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "outline"}
      onClick={toggle}
      title="Voice input"
      className={active ? "animate-pulse" : ""}
    >
      {active ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}