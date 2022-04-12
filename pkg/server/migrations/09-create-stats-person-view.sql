drop view if exists roiheimen.stats_person; -- old view

create or replace function roiheimen.stats_people_meeting(meeting_id text)
  returns table (
    person_id int,
    speeches_innlegg bigint,
    speeches_replikk bigint,
    speeches bigint,
    votes bigint
  ) as $$
select id as person_id,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id and type = 'innlegg') speeches_innlegg,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id and type = 'replikk') speeches_replikk,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id) speeches,
  (select count(*) from roiheimen.vote v where v.person_id = p.id) votes
  from roiheimen.person p
  where meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
  order by num desc;
$$ language sql stable;
comment on function roiheimen.stats_people_meeting(text) is E'@foreignKey (person_id) references person (id)\nGets some basic stats on participation in meeting.';

grant execute on function roiheimen.stats_people_meeting(text) to roiheimen_person;

-- tighten restrictions here
drop policy if exists select_person on roiheimen.person;
create policy select_person on roiheimen.person for select using (
    meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
);
