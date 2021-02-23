ALTER TABLE roiheimen.sak ADD COLUMN config jsonb default '{}';

UPDATE roiheimen.meeting SET config = config || '{ "speechDisabled": true }' WHERE config -> 'speechDisabled' IS NULL RETURNING *;
