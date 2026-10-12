-- Catalog: products, recipes, recipe_ingredients, recipe_likes
-- Anonymous family access (same model as family_shared_state).

create table if not exists public.products (
  id text primary key,
  name text not null,
  unit text not null check (unit in ('г', 'мл', 'шт.')),
  group_key text not null check (group_key in ('month', 'week', 'day')),
  category text not null default 'other',
  note text not null default '',
  kcal_per_100 numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key,
  title text not null,
  meal text not null,
  mins text not null default '',
  servings int not null default 2 check (servings > 0),
  per_occurrence boolean not null default false,
  days jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tip text not null default '',
  description text not null default '',
  is_custom boolean not null default false,
  likes_count int not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null references public.recipes(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  sort_order int not null default 0,
  note text not null default '',
  unique (recipe_id, product_id)
);

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);
create index if not exists recipe_ingredients_product_id_idx on public.recipe_ingredients(product_id);

create table if not exists public.recipe_likes (
  recipe_id text not null references public.recipes(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, device_id)
);

create index if not exists recipe_likes_device_id_idx on public.recipe_likes(device_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

create or replace function public.sync_recipe_likes_count()
returns trigger
language plpgsql
as $$
declare
  rid text;
begin
  rid := coalesce(new.recipe_id, old.recipe_id);
  update public.recipes
  set likes_count = (select count(*)::int from public.recipe_likes where recipe_id = rid)
  where id = rid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists recipe_likes_sync_count on public.recipe_likes;
create trigger recipe_likes_sync_count
after insert or delete on public.recipe_likes
for each row execute function public.sync_recipe_likes_count();

alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_likes enable row level security;

drop policy if exists products_anon_all on public.products;
create policy products_anon_all on public.products
  for all to anon, authenticated using (true) with check (true);

drop policy if exists recipes_anon_all on public.recipes;
create policy recipes_anon_all on public.recipes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists recipe_ingredients_anon_all on public.recipe_ingredients;
create policy recipe_ingredients_anon_all on public.recipe_ingredients
  for all to anon, authenticated using (true) with check (true);

drop policy if exists recipe_likes_anon_all on public.recipe_likes;
create policy recipe_likes_anon_all on public.recipe_likes
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update, delete on public.recipes to anon, authenticated;
grant select, insert, update, delete on public.recipe_ingredients to anon, authenticated;
grant select, insert, update, delete on public.recipe_likes to anon, authenticated;
