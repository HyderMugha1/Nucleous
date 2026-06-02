# Supabase PostgreSQL Blueprint For Nucleus

## What changed

MongoDB design docs have been removed and replaced with a Supabase-first relational model.

The main schema now lives in:

- [supabase/migrations/20260501_initial_platform_schema.sql](/d:/nucleus-whisper-watch-main/supabase/migrations/20260501_initial_platform_schema.sql)

## Core design choices

- `auth.users` is the identity source
- `public.profiles` stores app profile fields
- `public.organization_members` handles multi-tenant membership and role access
- all platform data is scoped by `organization_id`
- many-to-many relationships are normalized through join tables
- row level security is enabled so users can only access their own organizations

## Main modules covered

- organizations, profiles, memberships, invitations
- entities and sources
- mentions, narratives, trends, sentiment snapshots
- alert rules and alerts
- campaigns and crisis incidents
- influencers and influencer posts
- TV, news, and e-paper intelligence
- reports, chatbot conversations, notifications, saved views
- ingestion jobs, audit logs, and contact inquiries

## Supabase auth mapping

Mongo-style `users.passwordHash` and `sessions` are no longer needed in the database schema.

Use:

- `auth.users`
- `public.profiles`
- `public.organization_members`
- `public.organization_invitations`

## React / Vite frontend setup

Use Vite environment variables, not Next.js variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Create a browser client in the React app:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

## Recommended next migration steps

1. Create a Supabase project
2. Run the SQL migration file in the Supabase SQL editor or via Supabase CLI
3. Replace Mongo/Mongoose backend access with Supabase client or direct Postgres queries
4. Move auth flows to Supabase Auth
5. Replace JWT/session logic with Supabase session handling
6. Update API and frontend pages to use the new relational tables

## Important note

This turn adds the complete PostgreSQL structure for your project, but it does not yet rewrite the Node backend away from Mongoose. The database contract is now ready for that migration.
