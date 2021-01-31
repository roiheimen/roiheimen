ALTER TABLE roiheimen.sak ADD COLUMN config jsonb default '{}';

UPDATE roiheimen.meeting SET config = config || '{ "speechAllowed": true }' WHERE config -> 'speechAllowed' IS NULL RETURNING *;
