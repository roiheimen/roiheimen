
--
-- Triggers
--

-- updated_at
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

-- update meeting disallow when sak is
create function roiheimen_private.update_disallowed_voters_on_sak() returns trigger as $$
begin
  if old.finished_at is null and (new.config ? 'voteDisallowNum') then
    update roiheimen.meeting m
      set config = m.config || jsonb_build_object('voteDisallowNum', (new.config->>'voteDisallowNum')::jsonb)
      where m.id = new.meeting_id;
  end if;
  return new;
end;
$$ language plpgsql strict security definer;

create trigger sak_config_update_disallowed_voters
    before update on roiheimen.sak
    for each row
    execute procedure roiheimen_private.update_disallowed_voters_on_sak();

-- updated_at trigger for user_account
create trigger user_account_updated_at before update
  on roiheimen.user_account
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- updated_at trigger for organization
create trigger organization_updated_at before update
  on roiheimen.organization
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- Email triggers (via graphile_worker)
-- These functions check if graphile_worker is available before queuing emails

create or replace function roiheimen_private.queue_verification_email()
returns trigger as $$
declare
  user_record roiheimen.user_account;
begin
  -- Only queue if graphile_worker is available
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
             where n.nspname = 'graphile_worker' and p.proname = 'add_job') then
    -- Get user info for the email
    select * into user_record
      from roiheimen.user_account
      where id = NEW.user_id;

    -- Queue email job via graphile_worker
    perform graphile_worker.add_job(
      'send_email',
      json_build_object(
        'type', 'verification',
        'email', user_record.email,
        'token', NEW.token,
        'name', user_record.name
      )
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger queue_verification_email_on_insert
  after insert on roiheimen_private.email_verification
  for each row
  execute function roiheimen_private.queue_verification_email();

create or replace function roiheimen_private.queue_password_reset_email()
returns trigger as $$
declare
  user_record roiheimen.user_account;
begin
  -- Only queue if graphile_worker is available
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
             where n.nspname = 'graphile_worker' and p.proname = 'add_job') then
    -- Get user info for the email
    select * into user_record
      from roiheimen.user_account
      where id = NEW.user_id;

    -- Queue email job via graphile_worker
    perform graphile_worker.add_job(
      'send_email',
      json_build_object(
        'type', 'password_reset',
        'email', user_record.email,
        'token', NEW.token
      )
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger queue_password_reset_email_on_insert
  after insert on roiheimen_private.password_reset
  for each row
  execute function roiheimen_private.queue_password_reset_email();

-- Test data removed - use new auth system to create test data
