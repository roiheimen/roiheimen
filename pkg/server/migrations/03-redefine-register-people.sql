drop function if exists roiheimen.register_people(text, people_input[]);
create function roiheimen.register_people(
  meeting_id text,
  people people_input[]
) returns roiheimen.person[] as $$
  declare
    pa people_input;
    p roiheimen.person[];
    pp roiheimen.person;
  begin
    foreach pa in array people loop
      select * from roiheimen.person rp
        where rp.meeting_id = register_people.meeting_id
        and rp.num = pa.num
        into pp;
      if pp.id <> 0 then
        p := p || (select roiheimen.update_person(pp.id, pa.name, pa.password, pa.org, pa.email));
      else
        p := p || (select roiheimen.register_person(pa.num, pa.name, meeting_id, pa.password, pa.org, pa.email));
      end if;
    end loop;

    return p;
  end;
$$ language plpgsql volatile strict set search_path from current;

drop function if exists roiheimen.update_person(integer, text, text, text, text);
create function roiheimen.update_person(
  l_id integer,
  l_name text,
  l_password text,
  l_org text,
  l_email text default null
) returns roiheimen.person as $$
declare
  person roiheimen.person;
begin
  update roiheimen.person
    set name=l_name, org=l_org
    where id = l_id
    returning * into person;

  update roiheimen_private.person_account
    set email=l_email, password_hash=crypt(l_password, gen_salt('bf'))
    where person_id = l_id;

  return person;
end;
$$ language plpgsql security definer;
comment on function roiheimen.update_person(integer, text, text, text, text) is 'Updates a single person and their account.';

grant execute on function roiheimen.update_person(integer, text, text, text, text) to roiheimen_person;
grant execute on function roiheimen.register_people(text, people_input[]) to roiheimen_person;
