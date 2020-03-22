create schema roiheimen;
create schema roiheimen_private;

-- Extensions
create extension if not exists "pgcrypto";

-- Roles

create role roiheimen_postgraphile login password 'xyz';
create role roiheimen_anonymous;
create role roiheimen_person;
grant roiheimen_anonymous to roiheimen_postgraphile;
grant roiheimen_person to roiheimen_postgraphile;

-- R:jwt

create type roiheimen.jwt_token as (
  role text,
  person_id integer,
  exp bigint
);

-- Tables

create table roiheimen.person (
  id               serial primary key,
  num              integer not null,
  name             text not null check (char_length(name) < 128),
  sub_org          text,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);
comment on table roiheimen.person is 'A registered person with name+num.';
comment on column roiheimen.person.sub_org is 'The sub-organization of person, for information.';

create type roiheimen.speech_type as enum (
  'innleiing',
  'innlegg',
  'replikk',
  'saksopplysing'
);
create table roiheimen.speech (
  id               serial primary key,
  speaker_id       integer not null references roiheimen.person(id),
  type             roiheimen.speech_type not null,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);
comment on table roiheimen.speech is 'A forum speech written by a user.';

create table roiheimen_private.person_account (
  person_id        integer primary key references roiheimen.person(id) on delete cascade,
  email            text not null unique check (email ~* '^.+@.+\..+$'),
  password_hash    text not null
);
comment on table roiheimen_private.person_account is 'Private information about a person’s account.';

-- Functions

create function roiheimen.person_latest_speech(person roiheimen.person) returns roiheimen.speech as $$
  select speech.*
  from roiheimen.speech as speech
  where speech.speaker_id = person.id
  order by created_at desc
  limit 1
$$ language sql stable;
comment on function roiheimen.person_latest_speech(roiheimen.person) is 'Get’s the latest speech written by the person.';

create function roiheimen.register_person(
  name text,
  num integer,
  email text,
  password text
) returns roiheimen.person as $$
declare
  person roiheimen.person;
begin
  insert into roiheimen.person (name, num) values
    (name, num)
    returning * into person;

  insert into roiheimen_private.person_account (person_id, email, password_hash) values
    (person.id, email, crypt(password, gen_salt('bf')));

  return person;
end;
$$ language plpgsql strict security definer;
comment on function roiheimen.register_person(text, integer, text, text) is 'Registers a single user and creates an account.';

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
