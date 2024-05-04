create or replace function roiheimen.authenticate(
  num integer,
  meeting_id text,
  password text
) returns roiheimen.jwt_token as $$
declare
  person roiheimen.person;
  account roiheimen_private.person_account;
begin
  select * into person
    from roiheimen.person p
    where p.num = $1 and p.meeting_id = $2;
  select *  into account
    from roiheimen_private.person_account as a
    where person.id = a.person_id;

  if account.password_hash = crypt(password, account.password_hash) then
    update roiheimen_private.person_login
      set logout_at = now()
      where person_id = account.person_id
      and logout_at is null;
    insert into roiheimen_private.person_login (person_id)
      values (account.person_id);
    return (
      'roiheimen_person',
      account.person_id,
      $2,
      person.admin,
      extract(epoch from (now() + interval '6 days'))
    )::roiheimen.jwt_token;
  else
    return null;
  end if;
end;
$$ language plpgsql strict security definer;
comment on function roiheimen.authenticate(integer, text, text) is 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 6 days.';
