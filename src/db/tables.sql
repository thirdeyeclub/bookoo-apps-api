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

create table if not exists public.splash_pages (
  id bigserial primary key,
  company_id text not null,
  experience_id text not null,
  created_by_user_id text not null,
  product_id text not null,
  slug text not null unique,
  short_code text not null unique,
  template_key text not null default 'droplet_v1',
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_splash_pages_company_id on public.splash_pages (company_id);
create index if not exists idx_splash_pages_experience_id on public.splash_pages (experience_id);
create index if not exists idx_splash_pages_product_id on public.splash_pages (product_id);

create table if not exists public.splash_leads (
  id bigserial primary key,
  splash_page_id bigint not null references public.splash_pages(id) on delete cascade,
  company_id text not null,
  experience_id text not null,
  created_by_user_id text not null,
  email text not null,
  name text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  utm_term text null,
  referrer text null,
  landing_url text null,
  created_at timestamptz not null default now(),
  unique (splash_page_id, email)
);

create index if not exists idx_splash_leads_splash_page_id on public.splash_leads (splash_page_id);
create index if not exists idx_splash_leads_company_id on public.splash_leads (company_id);
create index if not exists idx_splash_leads_email on public.splash_leads (email);

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

drop trigger if exists trg_splash_pages_set_updated_at on public.splash_pages;
create trigger trg_splash_pages_set_updated_at
before update on public.splash_pages
for each row
execute function public.set_updated_at();