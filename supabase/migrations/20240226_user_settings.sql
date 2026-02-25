-- Enable RLS
alter table if exists user_settings enable row level security;

-- Create table for user settings
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registry_config jsonb default '{}'::jsonb,
  jimeng_config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_settings_user_id_key unique (user_id)
);

-- Policy: Users can insert their own settings
create policy "Users can insert their own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own settings
create policy "Users can update their own settings"
  on user_settings for update
  using (auth.uid() = user_id);

-- Policy: Users can select their own settings
create policy "Users can select their own settings"
  on user_settings for select
  using (auth.uid() = user_id);

-- Function to handle updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for updated_at
create trigger handle_updated_at
  before update on user_settings
  for each row
  execute procedure handle_updated_at();
