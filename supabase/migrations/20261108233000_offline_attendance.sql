create function public.vu_sync_training_attendance(
  p_category uuid, p_date date, p_session uuid, p_base jsonb, p_rows jsonb
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_session_id uuid;
  current_rows jsonb;
begin
  if auth.uid() is null or not coalesce(public.vu_attendance_can_edit(p_category), false) then
    raise exception 'Permessi insufficienti' using errcode = '42501';
  end if;
  if not exists (select 1 from jsonb_each_text(p_rows) where value = 'true') then
    raise exception 'Seleziona almeno un presente';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_category::text || '/' || p_date::text, 0));
  select s.id into v_session_id from public.training_sessions s
  where s.category_id = p_category and s.training_date = p_date for update;

  select coalesce(jsonb_object_agg(a.player_id, a.present), '{}'::jsonb)
    into current_rows from public.training_attendance a where a.session_id = v_session_id;

  if v_session_id is not null and current_rows @> p_rows then return 'saved'; end if;
  if v_session_id is distinct from p_session or current_rows is distinct from p_base then
    return 'conflict';
  end if;

  if v_session_id is null then
    insert into public.training_sessions(category_id, training_date, created_by)
      values (p_category, p_date, auth.uid())
      on conflict (category_id, training_date) do nothing returning id into v_session_id;
    if v_session_id is null then return 'conflict'; end if;
  end if;

  insert into public.training_attendance(session_id, player_id, present)
    select v_session_id, key::uuid, value::boolean from jsonb_each_text(p_rows)
    on conflict on constraint training_attendance_pkey do update set present = excluded.present;
  return 'saved';
end;
$$;
revoke all on function public.vu_sync_training_attendance(uuid,date,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.vu_sync_training_attendance(uuid,date,uuid,jsonb,jsonb) to authenticated;
