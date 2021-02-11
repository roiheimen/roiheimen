drop policy if exists insert_vote on roiheimen.vote;

create policy insert_vote on roiheimen.vote for insert to roiheimen_person
  with check (
    person_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
    and exists (
      select 1 from roiheimen.referendum r
      join roiheimen.sak s on (s.id = r.sak_id)
      join roiheimen.meeting m on (m.id = s.meeting_id)
      where r.id = referendum_id
        and r.finished_at is null
        and not (m.config->'voteDisallowNum') @> (
            select num::text::jsonb from roiheimen.person
            where id = person_id
        )
    )
  );
