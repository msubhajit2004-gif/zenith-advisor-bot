import { createFileRoute } from "@tanstack/react-router";
import { Concierge } from "@/components/concierge/Concierge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Concierge — your AI shopping advisor" },
      {
        name: "description",
        content:
          "An agentic AI shopping concierge that uncovers your true intent, recommends 2–3 products with explicit trade-offs, and closes the loop to checkout.",
      },
    ],
  }),
  component: Concierge,
});
