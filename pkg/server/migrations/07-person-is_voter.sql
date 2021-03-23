create or replace function roiheimen_private.update_disallowed_voters_on_sak() returns trigger as $$
begin
  if old.finished_at is null and new.config ? 'voteDisallowNum' then
    update roiheimen.meeting m
      set config = m.config || jsonb_build_object('voteDisallowNum', (new.config->>'voteDisallowNum')::jsonb)
      where m.id = new.meeting_id;
  end if;
  return new;
end;
$$ language plpgsql strict security definer;

drop trigger if exists sak_config_update_disallowed_voters on roiheimen.sak;
create trigger sak_config_update_disallowed_voters
    before update on roiheimen.sak
    for each row
    execute procedure roiheimen_private.update_disallowed_voters_on_sak();

