create table if not exists sentinel_relay_apps (
  app_name text primary key,
  recipient_email text not null,
  api_key_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
