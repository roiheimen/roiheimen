drop view if exists roiheimen.stats_person;
create view roiheimen.stats_person as
  select id, num, meeting_id,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id and type = 'innlegg') speeches_innlegg,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id and type = 'replikk') speeches_replikk,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id) speeches,
  (select count(*) from roiheimen.vote v where v.person_id = p.id) votes
  from roiheimen.person p
  order by meeting_id, num;
grant select on roiheimen.stats_person to roiheimen_person;
