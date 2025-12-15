create table if not exists public.funnels (
  id bigserial primary key,
  experience_id text not null unique,
  company_id text not null,
  steps jsonb not null default '[]'::jsonb,
  counting_mode text not null default 'B' check (counting_mode in ('A', 'B')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funnels_company_id on public.funnels (company_id);

create table if not exists public.product_memberships (
  company_id text not null,
  product_id text not null,
  user_id text not null,
  joined_at timestamptz null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  most_recent_action_at timestamptz null,
  left_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, product_id, user_id)
);

create index if not exists idx_product_memberships_company_product_last_seen
  on public.product_memberships (company_id, product_id, last_seen_at desc);

create index if not exists idx_product_memberships_company_product_joined_at
  on public.product_memberships (company_id, product_id, joined_at);

create index if not exists idx_product_memberships_company_product_left_at
  on public.product_memberships (company_id, product_id, left_at);

create table if not exists public.product_snapshots (
  id bigserial primary key,
  company_id text not null,
  product_id text not null,
  snapshot_at timestamptz not null,
  member_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_snapshots_company_product_snapshot_at
  on public.product_snapshots (company_id, product_id, snapshot_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_product_memberships_set_updated_at on public.product_memberships;
create trigger trg_product_memberships_set_updated_at
before update on public.product_memberships
for each row
execute function public.set_updated_at();

drop trigger if exists trg_funnels_set_updated_at on public.funnels;
create trigger trg_funnels_set_updated_at
before update on public.funnels
for each row
execute function public.set_updated_at();