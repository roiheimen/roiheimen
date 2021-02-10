drop function if exists roiheimen.register_people(text, roiheimen.people_input[]);
drop function if exists roiheimen.update_person(integer, text, text, text, text);
drop function if exists roiheimen.change_person(integer, text, text, text, text);
drop type if exists roiheimen.people_input;
create type roiheimen.people_input as (
  num integer,
  name text,
  password text,
  org text,
  email text
);

create function roiheimen.register_people(
  meeting_id text,
  people roiheimen.people_input[]
) returns roiheimen.person[] as $$
  declare
    pa roiheimen.people_input;
    p roiheimen.person[];
    pp roiheimen.person;
  begin
    foreach pa in array people loop
      select * from roiheimen.person rp
        where rp.meeting_id = register_people.meeting_id
        and rp.num = pa.num
        into pp;
      if pp.id <> 0 then
        p := p || (select roiheimen.change_person(pp.id, pa.name, pa.password, pa.org, pa.email));
      else
        p := p || (select roiheimen.register_person(pa.num, pa.name, meeting_id, pa.password, pa.org, pa.email));
      end if;
    end loop;

    return p;
  end;
$$ language plpgsql volatile strict set search_path from current;

create function roiheimen.change_person(
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
comment on function roiheimen.change_person(integer, text, text, text, text) is 'Updates a single person and their account.';

grant execute on function roiheimen.change_person(integer, text, text, text, text) to roiheimen_person;
grant execute on function roiheimen.register_people(text, roiheimen.people_input[]) to roiheimen_person;
