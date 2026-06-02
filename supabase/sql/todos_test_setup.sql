create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_complete boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
before update on public.todos
for each row
execute function public.set_updated_at();

alter table public.todos enable row level security;

drop policy if exists todos_public_select on public.todos;
drop policy if exists todos_public_insert on public.todos;
drop policy if exists todos_public_update on public.todos;
drop policy if exists todos_public_delete on public.todos;

create policy todos_public_select on public.todos
for select
using (true);

create policy todos_public_insert on public.todos
for insert
with check (true);

create policy todos_public_update on public.todos
for update
using (true)
with check (true);

create policy todos_public_delete on public.todos
for delete
using (true);

insert into public.todos (name, is_complete)
values
  ('Verify Supabase connection', false),
  ('Render rows in visual test page', false),
  ('Continue backend migration', false)
on conflict do nothing;
