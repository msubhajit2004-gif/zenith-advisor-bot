
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price_cents integer not null,
  image_url text,
  short_desc text not null,
  specs jsonb not null default '{}'::jsonb,
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  search_text text not null default '',
  created_at timestamptz not null default now()
);
create index on public.products (category);
create index on public.products using gin (to_tsvector('english', search_text));

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null default '',
  tool_calls jsonb,
  reasoning jsonb,
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.chat_messages (session_id, created_at);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.chat_sessions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

alter table public.products enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

create policy "products are public" on public.products for select using (true);
create policy "demo open sessions r" on public.chat_sessions for select using (true);
create policy "demo open sessions w" on public.chat_sessions for insert with check (true);
create policy "demo open msgs r" on public.chat_messages for select using (true);
create policy "demo open msgs w" on public.chat_messages for insert with check (true);
create policy "demo open carts r" on public.carts for select using (true);
create policy "demo open carts w" on public.carts for insert with check (true);
create policy "demo open carts u" on public.carts for update using (true);
create policy "demo open items r" on public.cart_items for select using (true);
create policy "demo open items w" on public.cart_items for insert with check (true);
create policy "demo open items u" on public.cart_items for update using (true);
create policy "demo open items d" on public.cart_items for delete using (true);
