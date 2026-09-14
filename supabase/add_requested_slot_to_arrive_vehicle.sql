drop function if exists arrive_vehicle(text, text, text, text);
drop function if exists arrive_vehicle(text, text, text);

create or replace function arrive_vehicle(
  plate_number text,
  owner_name text,
  vehicle_type text,
  requested_slot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plate text := upper(trim(plate_number));
  normalized_owner text := trim(owner_name);
  normalized_type text := trim(vehicle_type);
  normalized_requested_slot text := nullif(upper(trim(coalesce(requested_slot, ''))), '');
  available_slot text;
  assigned_queue integer;
begin
  lock table parking_records in exclusive mode;

  if normalized_plate = '' or normalized_owner = '' or normalized_type = '' then
    return jsonb_build_object('ok', false, 'message', 'Plate number, owner name, and vehicle type are required.');
  end if;

  if normalized_type not in ('Car', 'Motorcycle', 'Van', 'Truck') then
    return jsonb_build_object('ok', false, 'message', 'Vehicle type is invalid.');
  end if;

  if normalized_requested_slot is not null and normalized_requested_slot not in ('P001', 'P002', 'P003', 'P004', 'P005') then
    return jsonb_build_object('ok', false, 'message', 'Parking slot is invalid.');
  end if;

  if exists (
    select 1
    from parking_records records
    where upper(records.plate_number) = normalized_plate
      and records.status in ('Parked', 'Waiting')
  ) then
    return jsonb_build_object('ok', false, 'message', normalized_plate || ' is already parked or waiting.');
  end if;

  if normalized_requested_slot is not null then
    if exists (
      select 1
      from parking_records records
      where records.slot_id = normalized_requested_slot
        and records.status = 'Parked'
    ) then
      return jsonb_build_object('ok', false, 'message', normalized_requested_slot || ' is already occupied.');
    end if;

    available_slot := normalized_requested_slot;
  else
    select slots.slot_id
    into available_slot
    from (
      values ('P001'), ('P002'), ('P003'), ('P004'), ('P005')
    ) slots(slot_id)
    where not exists (
      select 1
      from parking_records records
      where records.slot_id = slots.slot_id
        and records.status = 'Parked'
    )
    order by slots.slot_id
    limit 1;
  end if;

  if available_slot is not null then
    insert into parking_records (
      record_id,
      plate_number,
      owner_name,
      vehicle_type,
      slot_id,
      status,
      queue_number,
      entry_time,
      exit_time
    )
    values (
      next_record_id(),
      normalized_plate,
      normalized_owner,
      normalized_type,
      available_slot,
      'Parked',
      null,
      now(),
      null
    );

    return jsonb_build_object('ok', true, 'message', normalized_plate || ' parked in ' || available_slot || '.');
  end if;

  select coalesce(max(records.queue_number), 0) + 1
  into assigned_queue
  from parking_records records
  where records.status = 'Waiting';

  insert into parking_records (
    record_id,
    plate_number,
    owner_name,
    vehicle_type,
    slot_id,
    status,
    queue_number,
    entry_time,
    exit_time
  )
  values (
    next_record_id(),
    normalized_plate,
    normalized_owner,
    normalized_type,
    null,
    'Waiting',
    assigned_queue,
    null,
    null
  );

  return jsonb_build_object(
    'ok',
    true,
    'message',
    'No slot available. ' || normalized_plate || ' is waiting in queue number ' || assigned_queue || '.'
  );
end;
$$;

revoke all on function arrive_vehicle(text, text, text, text) from public;
grant execute on function arrive_vehicle(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
