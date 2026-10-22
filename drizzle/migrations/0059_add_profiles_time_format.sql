alter table public.profiles add column if not exists time_format text not null default '12' check (time_format in ('12','24'));

comment on column public.profiles.time_format is 'Preferred clock display for kickoff times: 12 or 24 hour.';