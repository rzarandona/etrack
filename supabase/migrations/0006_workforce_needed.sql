-- Add a planning-stage headcount estimate to events. Stored as a bucketed
-- string ('1-5', '6-10', etc.) — admin picks before crew is actually
-- assigned. Doesn't feed the suggested pay rate (which uses actual
-- assignments); it's a sizing hint for capacity planning.

alter table public.events
  add column if not exists workforce_needed varchar(16);
