-- Интеграция с Velora: venue_id и токен заведения в Velora, куда пушить
-- заказы. Пусто у заведения = интеграция выключена (см. src/lib/velora-actions.ts).
alter table public.venues
  add column if not exists velora_venue_id uuid,
  add column if not exists velora_token text;
