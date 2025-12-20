-- Migration: Remove meeting_id from JWT
-- Meeting context is now derived from person record via current_meeting_id() helper

-- 1. Create helper function to get meeting_id from person record
CREATE FUNCTION roiheimen_private.current_meeting_id() RETURNS text AS $$
  SELECT meeting_id FROM roiheimen.person
  WHERE id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute on helper function to roles that need it
GRANT USAGE ON SCHEMA roiheimen_private TO roiheimen_person;
GRANT EXECUTE ON FUNCTION roiheimen_private.current_meeting_id() TO roiheimen_person;

-- 2. Update functions that use jwt.claims.meeting_id

-- latest_sak
CREATE OR REPLACE FUNCTION roiheimen.latest_sak(meeting_id text) RETURNS roiheimen.sak AS $$
  SELECT *
    FROM roiheimen.sak
    WHERE finished_at IS NULL
    AND meeting_id = coalesce($1, roiheimen_private.current_meeting_id())
    ORDER BY created_at DESC
    LIMIT 1
$$ LANGUAGE sql STABLE;

-- current_speech
CREATE OR REPLACE FUNCTION roiheimen.current_speech(meeting_id text) RETURNS roiheimen.speech AS $$
SELECT *
  FROM roiheimen.speech
  WHERE ended_at IS NULL
  AND started_at IS NOT NULL
  AND sak_id = (
    SELECT id
      FROM roiheimen.sak
      WHERE finished_at IS NULL
      AND meeting_id = coalesce($1, roiheimen_private.current_meeting_id())
      ORDER BY created_at DESC
      LIMIT 1)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- current_participant
CREATE OR REPLACE FUNCTION roiheimen.current_participant() RETURNS roiheimen.meeting_participant AS $$
  SELECT mp.*
  FROM roiheimen.meeting_participant mp
  WHERE mp.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    AND mp.meeting_id = roiheimen_private.current_meeting_id()
$$ LANGUAGE sql STABLE;

-- stats_people_meeting
CREATE OR REPLACE FUNCTION roiheimen.stats_people_meeting(meeting_id text)
  RETURNS TABLE (
    person_id int,
    speeches_innlegg bigint,
    speeches_replikk bigint,
    speeches bigint,
    votes bigint
  ) AS $$
SELECT id AS person_id,
  (SELECT count(*) FROM roiheimen.speech s WHERE s.speaker_id = p.id AND type = 'innlegg') speeches_innlegg,
  (SELECT count(*) FROM roiheimen.speech s WHERE s.speaker_id = p.id AND type = 'replikk') speeches_replikk,
  (SELECT count(*) FROM roiheimen.speech s WHERE s.speaker_id = p.id) speeches,
  (SELECT count(*) FROM roiheimen.vote v WHERE v.person_id = p.id) votes
  FROM roiheimen.person p
  WHERE meeting_id = coalesce($1, roiheimen_private.current_meeting_id())
  ORDER BY num DESC;
$$ LANGUAGE sql STABLE;

-- 3. Update RLS policies

-- Drop and recreate select_meeting_participant policy
DROP POLICY IF EXISTS select_meeting_participant ON roiheimen.meeting;
CREATE POLICY select_meeting_participant ON roiheimen.meeting
  FOR SELECT TO roiheimen_person
  USING (id = roiheimen_private.current_meeting_id());

-- Drop and recreate select_sak policy
DROP POLICY IF EXISTS select_sak ON roiheimen.sak;
CREATE POLICY select_sak ON roiheimen.sak FOR SELECT USING (
    meeting_id = roiheimen_private.current_meeting_id()
  );

-- Drop and recreate update_sak policy
DROP POLICY IF EXISTS update_sak ON roiheimen.sak;
CREATE POLICY update_sak ON roiheimen.sak FOR ALL USING (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    AND meeting_id = roiheimen_private.current_meeting_id()
  );

-- Drop and recreate all_admin_person policy
DROP POLICY IF EXISTS all_admin_person ON roiheimen.person;
CREATE POLICY all_admin_person ON roiheimen.person FOR ALL TO roiheimen_person
  USING (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    AND meeting_id = roiheimen_private.current_meeting_id()
  );

-- Drop and recreate all_admin_speech policy
DROP POLICY IF EXISTS all_admin_speech ON roiheimen.speech;
CREATE POLICY all_admin_speech ON roiheimen.speech FOR ALL TO roiheimen_person
  USING (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    AND EXISTS (
      SELECT 1 FROM roiheimen.person
      WHERE id = speaker_id
      AND meeting_id = roiheimen_private.current_meeting_id()
    )
  );

-- Drop and recreate all_admin_test policy
DROP POLICY IF EXISTS all_admin_test ON roiheimen.test;
CREATE POLICY all_admin_test ON roiheimen.test FOR ALL TO roiheimen_person
  USING (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    AND EXISTS (
      SELECT 1 FROM roiheimen.person
      WHERE id = requester_id
      AND meeting_id = roiheimen_private.current_meeting_id()
    )
  );

-- Drop and recreate update_referendum policy
DROP POLICY IF EXISTS update_referendum ON roiheimen.referendum;
CREATE POLICY update_referendum ON roiheimen.referendum FOR ALL USING (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    AND EXISTS (
      SELECT 1 FROM roiheimen.sak
      WHERE id = sak_id
      AND meeting_id = roiheimen_private.current_meeting_id()
    )
  );

-- Drop and recreate select_vote policy
DROP POLICY IF EXISTS select_vote ON roiheimen.vote;
CREATE POLICY select_vote ON roiheimen.vote FOR SELECT TO roiheimen_person
  USING (
    EXISTS (
      SELECT 1 FROM roiheimen.referendum
      WHERE id = referendum_id
      AND sak_id = sak_id
      AND type = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM roiheimen.person
      WHERE id = person_id
      AND meeting_id = roiheimen_private.current_meeting_id()
    )
  );

-- 4. Remove meeting_id from jwt_token type
-- Note: This requires recreating functions that return jwt_token

-- First, drop functions that use jwt_token
DROP FUNCTION IF EXISTS roiheimen.authenticate_user(text, text);
DROP FUNCTION IF EXISTS roiheimen.get_meeting_token(text);

-- Alter the type to remove meeting_id
ALTER TYPE roiheimen.jwt_token DROP ATTRIBUTE meeting_id;

-- Recreate authenticate_user function
CREATE OR REPLACE FUNCTION roiheimen.authenticate_user(
  email text,
  password text
) RETURNS roiheimen.jwt_token AS $$
DECLARE
  user_record roiheimen.user_account;
  credentials roiheimen_private.user_credentials;
  lockout_duration interval := interval '5 minutes';
  max_attempts integer := 3;
BEGIN
  -- Find user by email (case-insensitive)
  SELECT * INTO user_record
    FROM roiheimen.user_account ua
    WHERE lower(ua.email) = lower(trim(authenticate_user.email));

  IF user_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get credentials
  SELECT * INTO credentials
    FROM roiheimen_private.user_credentials uc
    WHERE uc.user_id = user_record.id;

  -- Check for lockout (3 failures within 5 minutes)
  IF credentials.failed_attempts >= max_attempts
     AND credentials.first_failed_at > (now() - lockout_duration) THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.';
  END IF;

  -- Reset failed attempts if lockout period has passed
  IF credentials.first_failed_at IS NOT NULL
     AND credentials.first_failed_at <= (now() - lockout_duration) THEN
    UPDATE roiheimen_private.user_credentials
      SET failed_attempts = 0, first_failed_at = NULL
      WHERE user_id = user_record.id;
    SELECT * INTO credentials
      FROM roiheimen_private.user_credentials uc
      WHERE uc.user_id = user_record.id;
  END IF;

  -- Check password
  IF credentials.password_hash = crypt(password, credentials.password_hash) THEN
    IF NOT credentials.email_verified THEN
      RAISE EXCEPTION 'Email not verified. Please check your inbox.';
    END IF;

    UPDATE roiheimen_private.user_credentials
      SET failed_attempts = 0, first_failed_at = NULL
      WHERE user_id = user_record.id;

    INSERT INTO roiheimen_private.user_session (user_id)
      VALUES (user_record.id);

    RETURN (
      'roiheimen_user',
      NULL,
      false,
      extract(epoch FROM (now() + interval '6 days')),
      user_record.id
    )::roiheimen.jwt_token;
  ELSE
    UPDATE roiheimen_private.user_credentials
      SET
        failed_attempts = CASE
          WHEN first_failed_at IS NULL OR first_failed_at <= (now() - lockout_duration)
          THEN 1
          ELSE failed_attempts + 1
        END,
        first_failed_at = CASE
          WHEN first_failed_at IS NULL OR first_failed_at <= (now() - lockout_duration)
          THEN now()
          ELSE first_failed_at
        END
      WHERE user_id = user_record.id;

    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION roiheimen.authenticate_user(text, text) IS 'Authenticates a user by email and password, returns JWT token';
GRANT EXECUTE ON FUNCTION roiheimen.authenticate_user(text, text) TO roiheimen_anonymous;

-- Recreate get_meeting_token function
CREATE OR REPLACE FUNCTION roiheimen.get_meeting_token(
  p_meeting_id text
) RETURNS roiheimen.jwt_token AS $$
DECLARE
  current_user_id integer;
  participant roiheimen.meeting_participant;
  new_person roiheimen.person;
  user_name text;
  next_num integer;
BEGIN
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to get a meeting token';
  END IF;

  -- Check if user is a participant
  SELECT * INTO participant
    FROM roiheimen.meeting_participant
    WHERE meeting_id = p_meeting_id AND user_id = current_user_id;

  IF participant.id IS NULL THEN
    -- Check if user is an org member (organizers automatically have access)
    IF NOT EXISTS (
      SELECT 1 FROM roiheimen.meeting m
      JOIN roiheimen.organization_member om ON om.organization_id = m.organization_id
      WHERE m.id = p_meeting_id
        AND om.user_id = current_user_id
    ) THEN
      RAISE EXCEPTION 'You are not a participant in this meeting';
    END IF;

    -- Get user name for the person/participant records
    SELECT name INTO user_name FROM roiheimen.user_account WHERE id = current_user_id;

    -- Get next participant number (considering both tables)
    SELECT greatest(
      coalesce((SELECT max(participant_num) + 1 FROM roiheimen.meeting_participant WHERE meeting_id = p_meeting_id), 1),
      coalesce((SELECT max(num) + 1 FROM roiheimen.person WHERE meeting_id = p_meeting_id), 1)
    ) INTO next_num;

    -- Create person record for org member/organizer (for legacy compatibility)
    INSERT INTO roiheimen.person (num, name, admin, meeting_id, org)
      VALUES (next_num, user_name, true, p_meeting_id, '')
      RETURNING * INTO new_person;

    -- Create organizer participant entry with link to person
    INSERT INTO roiheimen.meeting_participant (meeting_id, user_id, display_name, participant_num, is_organizer, person_id)
      VALUES (p_meeting_id, current_user_id, user_name, next_num, true, new_person.id)
      RETURNING * INTO participant;
  END IF;

  -- Return JWT with person_id (meeting_id is derived from person record via current_meeting_id())
  RETURN (
    'roiheimen_person',
    participant.person_id,
    participant.is_organizer,
    extract(epoch FROM (now() + interval '6 days')),
    current_user_id
  )::roiheimen.jwt_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION roiheimen.get_meeting_token(text) IS 'Returns a meeting-scoped JWT for a participant';
GRANT EXECUTE ON FUNCTION roiheimen.get_meeting_token(text) TO roiheimen_user;
