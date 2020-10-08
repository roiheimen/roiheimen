drop schema if exists roiheimen_private cascade;
drop schema if exists roiheimen cascade;

create schema roiheimen;
create schema roiheimen_private;

-- Extensions
create extension if not exists "pgcrypto";

-- Roles

create role roiheimen_postgraphile login password 'xyz';
create role roiheimen_anonymous;
create role roiheimen_person;

-- R:jwt

create type roiheimen.jwt_token as (
  role text,
  person_id integer,
  meeting_id text,
  admin boolean,
  exp bigint
);

-- Tables

-- meeting
create table roiheimen.meeting (
  id               text primary key check (char_length(id) < 32),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.meeting is 'A meeting, i.e. "nmlm12"';

-- sak (like agendaitem)
create table roiheimen.sak (
  id               serial primary key,
  title            text not null,
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  finished_at      timestamptz default null
);
comment on table roiheimen.sak is 'A sak is one agende item that can have speeches connected to it.';
create index on roiheimen.sak(meeting_id);
create index on roiheimen.sak(created_at);
create index on roiheimen.sak(finished_at);

-- person
create table roiheimen.person (
  id               serial primary key,
  num              integer,
  name             text not null check (char_length(name) < 128),
  admin            boolean default false,
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
  org              text not null default '',
  room             text not null default '',
  created_at       timestamp default now(),
  updated_at       timestamp default now(),
  unique(num, meeting_id)
);
comment on table roiheimen.person is 'A registered person with name+num.';
create index on roiheimen.person(meeting_id);

-- person_account
create table roiheimen_private.person_account (
  person_id        integer primary key references roiheimen.person(id) on delete cascade,
  email            text null check (email ~* '^.+@.+\..+$'),
  password_hash    text not null
);
comment on table roiheimen_private.person_account is 'Private information about a person’s account.';
create index on roiheimen_private.person_account(person_id);

-- speech
create type roiheimen.speech_type as enum (
  'innleiing',
  'innlegg',
  'replikk',
  'saksopplysing'
);
create table roiheimen.speech (
  id               serial primary key,
  speaker_id       integer not null references roiheimen.person(id) on delete cascade,
  sak_id           integer not null references roiheimen.sak(id) on delete cascade,
  parent_id        integer null references roiheimen.speech(id) on delete set null,
  type             roiheimen.speech_type not null default 'innlegg',
  started_at       timestamp,
  ended_at         timestamp,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);
comment on table roiheimen.speech is 'A speech done by a person on a sak.';
create index on roiheimen.speech(speaker_id);
create index on roiheimen.speech(sak_id);
create index on roiheimen.speech(parent_id);
create index on roiheimen.speech(created_at);
create index on roiheimen.speech(started_at);
create index on roiheimen.speech(ended_at);

-- Views

drop view ordered_speech;
create view ordered_speech as
  select *
  from roiheimen.speech
  where sak_id = (select max(id) from roiheimen.sak)
  order by coalesce(parent_id, id) asc, created_at asc;

-- Functions

create function roiheimen.authenticate(
  num integer,
  meeting_id text,
  password text
) returns roiheimen.jwt_token as $$
declare
  person roiheimen.person;
  account roiheimen_private.person_account;
begin
  select * into person
    from roiheimen.person p
    where p.num = $1 and p.meeting_id = $2;
  select *  into account
    from roiheimen_private.person_account as a
    where person.id = a.person_id;

  if account.password_hash = crypt(password, account.password_hash) then
    return (
      'roiheimen_person',
      account.person_id,
      $2,
      person.admin,
      extract(epoch from (now() + interval '2 days'))
    )::roiheimen.jwt_token;
  else
    return null;
  end if;
end;
$$ language plpgsql strict security definer;
comment on function roiheimen.authenticate(integer, text, text) is 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 2 days.';

create function roiheimen.person_latest_speech(person roiheimen.person) returns roiheimen.speech as $$
  select speech.*
  from roiheimen.speech as speech
  where speech.speaker_id = person.id
  order by created_at desc
  limit 1
$$ language sql stable;
comment on function roiheimen.person_latest_speech(roiheimen.person) is 'Get’s the latest speech written by the person.';

create function roiheimen.register_person(
  num integer,
  name text,
  meeting_id text,
  password text,
  org text,
  email text default null
) returns roiheimen.person as $$
declare
  person roiheimen.person;
begin
  insert into roiheimen.person (num, name, org, meeting_id) values
    (num, name, org, meeting_id)
    returning * into person;

  insert into roiheimen_private.person_account (person_id, email, password_hash) values
    (person.id, email, crypt(password, gen_salt('bf')));

  return person;
end;
$$ language plpgsql security definer;
comment on function roiheimen.register_person(integer, text, text, text, text, text) is 'Registers a single user and creates an account.';

-- input type
drop type people_input;
create type people_input as (
  num integer,
  name text,
  password text,
  org text,
  email text
);

create function roiheimen.register_people(
  meeting_id text,
  people people_input[]
) returns roiheimen.person[] as $$
  declare
    pa people_input;
    p roiheimen.person[];
  begin
    delete from roiheimen.person rp where rp.meeting_id = register_people.meeting_id and id != nullif(current_setting('jwt.claims.person_id', true), '')::integer;

    foreach pa in array people loop
      p := p || (select roiheimen.register_person(pa.num, pa.name, meeting_id, pa.password, pa.org, pa.email));
    end loop;

    return p;
  end;
$$ language plpgsql volatile strict set search_path from current;

create function roiheimen.latest_sak(meeting_id text) returns roiheimen.sak as $$
  select *
    from roiheimen.sak
    where finished_at is null
    and meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
    order by created_at desc
    limit 1
$$ language sql stable;

create function forum.latest_post(forum_id text) returns forum.post as $$
  select *
    from forum.post
    where finished_at is null
    and forum_id = coalesce($1, current_setting('jwt.claims.forum_id', true))
    order by created_at desc
    limit 1
$$ language sql stable;

-- create function roiheimen.current_speeches(meeting_id text, sak_id int) returns roiheimen.speech as $$
--   select *
--     from roiheimen.sak
--     where finished_at is null
--     and meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
--     order by created_at desc
--     limit 1
-- $$ language sql stable;

create function roiheimen.current_person() returns roiheimen.person as $$
  select *
  from roiheimen.person
  where id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
$$ language sql stable;
comment on function roiheimen.current_person() is 'Gets the person who was identified by our JWT.';

-- Permissions

alter default privileges revoke execute on functions from public;

grant roiheimen_anonymous to roiheimen_postgraphile;
grant roiheimen_person to roiheimen_postgraphile;
grant usage on schema roiheimen to roiheimen_anonymous, roiheimen_person;

grant select on table roiheimen.meeting to roiheimen_anonymous, roiheimen_person;
grant insert, update on table roiheimen.meeting to roiheimen_person;

grant select on table roiheimen.sak to roiheimen_anonymous, roiheimen_person;
grant insert, update on table roiheimen.sak to roiheimen_person;
grant usage on sequence roiheimen.sak_id_seq to roiheimen_person;

grant select on table roiheimen.person to roiheimen_anonymous, roiheimen_person;
grant update, delete on table roiheimen.person to roiheimen_person;

grant select on table roiheimen.speech to roiheimen_anonymous, roiheimen_person;
grant insert, update, delete on table roiheimen.speech to roiheimen_person;
grant usage on sequence roiheimen.speech_id_seq to roiheimen_person;

grant select on roiheimen.ordered_speech to roiheimen_anonymous, roiheimen_person;

grant execute on function roiheimen.authenticate(integer, text, text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.register_person(integer, text, text, text, text, text) to roiheimen_person;
grant execute on function roiheimen.register_people(text, people_input[]) to roiheimen_person;
grant execute on function roiheimen.latest_sak(text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_person() to roiheimen_anonymous, roiheimen_person;

-- Row lewel security policy
alter table roiheimen.meeting enable row level security;
alter table roiheimen.sak enable row level security;
alter table roiheimen.person enable row level security;
alter table roiheimen.speech enable row level security;

create policy select_meeting on roiheimen.meeting for select using (true);

create policy select_sak on roiheimen.sak for select using (
    meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
  );
create policy update_sak on roiheimen.sak for all using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
  );

create policy select_person on roiheimen.person for select using (true);
create policy update_person on roiheimen.person for update to roiheimen_person
  using (id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy all_admin_person on roiheimen.person for all to roiheimen_person
  using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
  );

create policy select_speech on roiheimen.speech for select using (true);
create policy insert_speech on roiheimen.speech for insert to roiheimen_person
  with check (speaker_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy update_speech on roiheimen.speech for update to roiheimen_person
  using (speaker_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy delete_speech on roiheimen.speech for delete to roiheimen_person
  using (speaker_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy all_admin_speech on roiheimen.speech for all to roiheimen_person
  using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and exists (
      select 1 from roiheimen.person
      where id = speaker_id
      and meeting_id = current_setting('jwt.claims.meeting_id', true)
    )
  );

-- Triggers

create function roiheimen_private.set_updated_at() returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql;

create trigger person_updated_at before update
  on roiheimen.person
  for each row
  execute procedure roiheimen_private.set_updated_at();

create trigger speech_updated_at before update
  on roiheimen.speech
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- Test data
insert into roiheimen.meeting (id) values ('nmlm12');
select roiheimen.register_people(
  'nmlm12',
  array[
    (10, 'Gro Morken Endresen', 'test', 'Oslo Mållag', null),
    (11, 'Astrid Marie Grov', 'test', 'Oslo Mållag', null),
    (12, 'Per Henning Arntsen', 'test', 'Oslo Mållag', null),
    (13, 'Ingar Arnøy', 'test', 'Stavanger Mållag', null),
    (14, 'Erik Grov', 'test', 'Stavanger Mållag', null),
    (15, 'Hege Lothe', 'test', 'Stavanger Mållag', null),
    (16, 'Marit Aakre Tennø', 'test', 'Stavanger Mållag', null),
    (1000, 'Odin Hørthe Omdal', 'test', '', null)
  ]::people_input[]
);
update roiheimen.person set admin = true where num = 1000 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r10' where num = 10 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r11' where num = 11 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r12' where num = 12 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r13' where num = 13 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r14' where num = 14 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r15' where num = 15 and meeting_id = 'nmlm12';
update roiheimen.person set room = 'https://nm.whereby.com/r16' where num = 16 and meeting_id = 'nmlm12';


COPY roiheimen.sak (id, title, meeting_id, created_at, updated_at, finished_at) FROM stdin;
1	Opning	nmlm12	2020-09-29 20:54:07.189976+02	2020-09-29 20:54:07.189976+02	\N
\.


COPY roiheimen.speech (id, speaker_id, sak_id, type, created_at, updated_at) FROM stdin;
4	1	1	innleiing	2020-09-29 20:54:18.20359	2020-09-29 20:54:18.20359
5	3	1	innlegg	2020-09-29 21:28:21.216097	2020-09-29 21:28:21.216097
6	2	1	innlegg	2020-09-30 00:21:31.327424	2020-09-30 00:21:31.327424
7	1	1	innlegg	2020-09-30 00:33:39.560804	2020-09-30 00:33:39.560804
8	6	1	innlegg	2020-09-30 00:38:43.920796	2020-09-30 00:38:43.920796
\.

SELECT pg_catalog.setval('roiheimen.person_id_seq', 7, true);
SELECT pg_catalog.setval('roiheimen.sak_id_seq', 1, true);
SELECT pg_catalog.setval('roiheimen.speech_id_seq', 8, true);
