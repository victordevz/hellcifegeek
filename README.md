# hellcifegeek

Portfolio marketplace neobrutalist built with Next.js, TypeScript and a monorepo structure.

## Supabase shared state

By default, the API uses `apps/api/data/db.json` for local development. To make local and production read/write the same Supabase state, create this table in the Supabase SQL editor:

```sql
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
```

Then set these variables in `apps/api/.env` locally and in Railway/production:

```env
API_STORE_DRIVER=supabase
SUPABASE_STATE_TABLE=app_state
SUPABASE_STATE_ID=main
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

With the same `SUPABASE_STATE_ID`, admin users, products, categories, hellpoints, tickets, bans and deletions are shared between local and production.
