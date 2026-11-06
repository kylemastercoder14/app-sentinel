create table if not exists sentinel_events (
  id uuid primary key,
  type text not null,
  level text not null,
  timestamp timestamptz not null,
  app_name text not null,
  environment text not null,
  release text,
  fingerprint text,
  message text not null,
  error_name text,
  error_stack text,
  context jsonb,
  trace jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sentinel_events_fingerprint_time_idx
  on sentinel_events (fingerprint, timestamp desc);

create table if not exists sentinel_alert_state (
  app_name text not null,
  environment text not null,
  fingerprint text not null,
  last_notified_at timestamptz,
  suppressed_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (app_name, environment, fingerprint)
);
