drop function if exists update_vehicle(text, text, text, text, text);

create or replace function update_vehicle(
  target_record_id text,
  plate_number text,
  owner_name text,
  vehicle_type text,
  requested_slot text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_record_id text := trim(target_record_id);
  normalized_plate text := upper(trim(plate_number));
  normalized_owner text := trim(owner_name);
  normalized_type text := trim(vehicle_type);
  normalized_requested_slot text := nullif(upper(trim(coalesce(requested_slot, ''))), '');
  target_id uuid;
  target_status text;
begin
  lock table parking_records in exclusive mode;

  if normalized_record_id = '' then
    return jsonb_build_object('ok', false, 'message', 'Record ID is required.');
  end if;

  if normalized_plate = '' or normalized_owner = '' or normalized_type = '' then
    return jsonb_build_object('ok', false, 'message', 'Plate number, owner name, and vehicle type are required.');
  end if;

  if normalized_type not in ('Car', 'Motorcycle', 'Van', 'Truck') then
    return jsonb_build_object('ok', false, 'message', 'Vehicle type is invalid.');
  end if;

  if normalized_requested_slot is null or normalized_requested_slot not in ('P001', 'P002', 'P003', 'P004', 'P005') then
    return jsonb_build_object('ok', false, 'message', 'Parking slot is invalid.');
  end if;

  select records.id, records.status
  into target_id, target_status
  from parking_records records
  where records.record_id = normalized_record_id
    and records.status in ('Parked', 'Waiting')
  limit 1;

  if target_id is null then
    return jsonb_build_object('ok', false, 'message', normalized_record_id || ' is not an active parking record.');
  end if;

  if exists (
    select 1
    from parking_records records
    where upper(records.plate_number) = normalized_plate
      and records.status in ('Parked', 'Waiting')
      and records.id <> target_id
  ) then
    return jsonb_build_object('ok', false, 'message', normalized_plate || ' is already parked or waiting.');
  end if;

  if exists (
    select 1
    from parking_records records
    where records.slot_id = normalized_requested_slot
      and records.status = 'Parked'
      and records.id <> target_id
  ) then
    return jsonb_build_object('ok', false, 'message', normalized_requested_slot || ' is already occupied.');
  end if;

  update parking_records records
  set plate_number = normalized_plate,
      owner_name = normalized_owner,
      vehicle_type = normalized_type,
      slot_id = case when target_status = 'Parked' then normalized_requested_slot else null end
  where records.id = target_id;

  return jsonb_build_object('ok', true, 'message', normalized_plate || ' updated successfully.');
end;
$$;

revoke all on function update_vehicle(text, text, text, text, text) from public;
grant execute on function update_vehicle(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
