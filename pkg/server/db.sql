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

-- person
create table roiheimen.person (
  id               serial primary key,
  num              integer,
  name             text not null check (char_length(name) < 128),
  admin            boolean default false,
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
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
  type             roiheimen.speech_type not null,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);
comment on table roiheimen.speech is 'A forum speech written by a user.';
create index on roiheimen.speech(speaker_id);

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
  email text default null
) returns roiheimen.person as $$
declare
  person roiheimen.person;
begin
  insert into roiheimen.person (num, name, meeting_id) values
    (num, name, meeting_id)
    returning * into person;

  insert into roiheimen_private.person_account (person_id, email, password_hash) values
    (person.id, email, crypt(password, gen_salt('bf')));

  return person;
end;
$$ language plpgsql security definer;
comment on function roiheimen.register_person(integer, text, text, text, text) is 'Registers a single user and creates an account.';

-- input type
drop type people_input;
create type people_input as (
  num integer,
  name text,
  password text,
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
    -- delete from roiheimen.person rp where rp.sub_org = register_people.sub_org and id != nullif(current_setting('jwt.claims.person_id', true), '')::integer;

    foreach pa in array people loop
      p := p || (select roiheimen.register_person(pa.num, pa.name, meeting_id, pa.password, pa.email));
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

grant execute on function roiheimen.authenticate(integer, text, text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.register_person(integer, text, text, text, text) to roiheimen_person;
grant execute on function roiheimen.register_people(text, people_input[]) to roiheimen_person;
grant execute on function roiheimen.latest_sak(text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_person() to roiheimen_anonymous, roiheimen_person;

-- Row lewel security policy
alter table roiheimen.meeting enable row level security;
alter table roiheimen.sak enable row level security;
alter table roiheimen.person enable row level security;
alter table roiheimen.speech enable row level security;

create policy select_meeting on roiheimen.meeting for select using (true);

create policy select_sak on roiheimen.sak for select using (true);
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
    (13, 'Odin', 'test', null),
    (14, 'Test', 'yes', 'test@example.com'),
    (1000, 'Admin (Odin)', 'test', null)
  ]::people_input[]
);
update roiheimen.person set admin = true where num = 1000 and meeting_id = 'nmlm12';
