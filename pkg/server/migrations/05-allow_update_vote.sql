
drop policy if exists update_vote on roiheimen.vote;
grant select, update, insert, delete on table roiheimen.vote to roiheimen_person;
create policy update_vote on roiheimen.vote for update to roiheimen_person
  using (
    person_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
    and
    exists (
      -- No need to check voteDisallow on update, since insert was allowed
      select from roiheimen.referendum r
      where r.id = referendum_id
        and r.finished_at is null
    )
  );
