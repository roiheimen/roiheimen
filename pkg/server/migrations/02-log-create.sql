
drop table roiheimen.log;
drop type roiheimen.log_type;

create type roiheimen.log_type as enum (
  'log',
  'emoji',
  'online'
);
create table roiheimen.log (
  id               serial primary key,
  type             roiheimen.log_type not null default 'log',
  data             jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.log is 'A log of happenings';
