-- Actually not a good idea, since admins will have access to users pws,
-- and can therefore read their votes
drop policy if exists select_vote_yourself on roiheimen.vote;
create policy select_vote_yourself on roiheimen.vote for select to roiheimen_person
  using (
    person_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
  );
