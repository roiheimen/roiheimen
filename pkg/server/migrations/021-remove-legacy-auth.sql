-- Migration: Remove legacy authentication system
-- The new organization/invite-based system is fully functional

-- Revoke permissions on legacy functions
REVOKE EXECUTE ON FUNCTION roiheimen.authenticate(integer, text, text) FROM roiheimen_anonymous, roiheimen_person;
REVOKE EXECUTE ON FUNCTION roiheimen.register_person(integer, text, text, text, text, text) FROM roiheimen_person;
REVOKE EXECUTE ON FUNCTION roiheimen.change_person(integer, text, text, text, text) FROM roiheimen_person;
REVOKE EXECUTE ON FUNCTION roiheimen.register_people(text, roiheimen.people_input[]) FROM roiheimen_person;

-- Drop legacy functions
DROP FUNCTION IF EXISTS roiheimen.register_people(text, roiheimen.people_input[]);
DROP FUNCTION IF EXISTS roiheimen.change_person(integer, text, text, text, text);
DROP FUNCTION IF EXISTS roiheimen.register_person(integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS roiheimen.authenticate(integer, text, text);
DROP FUNCTION IF EXISTS roiheimen.logout(integer);

-- Drop legacy type
DROP TYPE IF EXISTS roiheimen.people_input;

-- Drop legacy tables
DROP TABLE IF EXISTS roiheimen_private.person_login;
DROP TABLE IF EXISTS roiheimen_private.person_account;

-- Remove ALL legacy meetings (where organization_id IS NULL)
-- This includes the "meet20" test meeting
DELETE FROM roiheimen.speech WHERE sak_id IN (
  SELECT s.id FROM roiheimen.sak s
  JOIN roiheimen.meeting m ON s.meeting_id = m.id
  WHERE m.organization_id IS NULL
);
DELETE FROM roiheimen.vote WHERE person_id IN (
  SELECT p.id FROM roiheimen.person p
  JOIN roiheimen.meeting m ON p.meeting_id = m.id
  WHERE m.organization_id IS NULL
);
DELETE FROM roiheimen.referendum WHERE sak_id IN (
  SELECT s.id FROM roiheimen.sak s
  JOIN roiheimen.meeting m ON s.meeting_id = m.id
  WHERE m.organization_id IS NULL
);
DELETE FROM roiheimen.sak WHERE meeting_id IN (
  SELECT id FROM roiheimen.meeting WHERE organization_id IS NULL
);
DELETE FROM roiheimen.person WHERE meeting_id IN (
  SELECT id FROM roiheimen.meeting WHERE organization_id IS NULL
);
DELETE FROM roiheimen.meeting WHERE organization_id IS NULL;

-- Update join_meeting to not create person_account records
-- (This is handled by removing the INSERT statement from the function in db.sql)

-- Update get_meeting_token to not create person_account records
-- (This is handled by removing the INSERT statement from the function in db.sql)
