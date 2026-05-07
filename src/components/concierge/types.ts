export type ProductRow = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  short_desc: string;
  image_url: string | null;
  specs: Record<string, string>;
  pros: string[];
  cons: string[];
};

export type Recommendations = {
  product_ids: string[];
  products: ProductRow[];
  why_this_fits: string[];
  tradeoffs: string;
};

export type Followups = {
  questions: { question: string; quick_replies: string[] }[];
};

export type Reasoning = {
  detected_intent: string;
  constraints: string[];
  why_chosen: string;
  why_rejected: string;
};

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  recommendations?: Recommendations | null;
  followups?: Followups | null;
  reasoning?: Reasoning | null;
};

export const formatPrice = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;