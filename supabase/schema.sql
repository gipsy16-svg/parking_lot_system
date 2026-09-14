create extension if not exists pgcrypto;

drop function if exists exit_vehicle(text);
drop function if exists arrive_vehicle(text, text, text);
drop function if exists normalize_waiting_queue();
drop function if exists next_record_id();
drop table if exists parking_records;

create table parking_records (
  id uuid primary key default gen_random_uuid(),
  record_id text not null unique,
  plate_number text not null,
  owner_name text not null,
  vehicle_type text not null check (vehicle_type in ('Car', 'Motorcycle', 'Van', 'Truck')),
  slot_id text check (slot_id is null or slot_id in ('P001', 'P002', 'P003', 'P004', 'P005')),
  status text not null check (status in ('Parked', 'Waiting', 'Exited')),
  queue_number integer check (queue_number is null or queue_number > 0),
  entry_time timestamptz,
  exit_time timestamptz,
  created_at timestamptz not null default now(),
  constraint waiting_records_have_queue check (
    (status = 'Waiting' and queue_number is not null and slot_id is null)
    or status <> 'Waiting'
  ),
  constraint parked_records_have_slot check (
    (status = 'Parked' and slot_id is not null and entry_time is not null)
    or status <> 'Parked'
  ),
  constraint exited_records_have_exit_time check (
    (status = 'Exited' and exit_time is not null)
    or status <> 'Exited'
  )
);

create unique index one_parked_vehicle_per_slot
on parking_records (slot_id)
where status = 'Parked';

create unique index one_active_record_per_plate
on parking_records (upper(plate_number))
where status in ('Parked', 'Waiting');

create index parking_records_status_idx
on parking_records (status);

create index parking_records_queue_idx
on parking_records (queue_number, created_at)
where status = 'Waiting';

alter table parking_records enable row level security;

revoke all on parking_records from anon, authenticated;
revoke all on table parking_records from public;

grant usage on schema public to anon, authenticated;
grant select on parking_records to anon, authenticated;

create policy "Anyone can read parking records"
on parking_records for select
using (true);

create or replace function next_record_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  highest integer;
begin
  select coalesce(max(substring(records.record_id from 2)::integer), 0)
  into highest
  from parking_records records
  where records.record_id ~ '^R[0-9]+$';

  return 'R' || lpad((highest + 1)::text, 3, '0');
end;
$$;

create or replace function normalize_waiting_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ordered as (
    select
      records.id,
      row_number() over (order by records.queue_number, records.created_at) as position
    from parking_records records
    where records.status = 'Waiting'
  )
  update parking_records records
  set queue_number = ordered.position
  from ordered
  where records.id = ordered.id;
end;
$$;

create or replace function arrive_vehicle(
  plate_number text,
  owner_name text,
  vehicle_type text
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

  if exists (
    select 1
    from parking_records records
    where upper(records.plate_number) = normalized_plate
      and records.status in ('Parked', 'Waiting')
  ) then
    return jsonb_build_object('ok', false, 'message', normalized_plate || ' is already parked or waiting.');
  end if;

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

create or replace function exit_vehicle(plate_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plate text := upper(trim(plate_number));
  exiting_id uuid;
  freed_slot text;
  promoted_plate text;
  promoted_id uuid;
begin
  lock table parking_records in exclusive mode;

  if normalized_plate = '' then
    return jsonb_build_object('ok', false, 'message', 'Plate number is required.');
  end if;

  select records.id, records.slot_id
  into exiting_id, freed_slot
  from parking_records records
  where upper(records.plate_number) = normalized_plate
    and records.status = 'Parked'
  order by records.created_at
  limit 1;

  if exiting_id is null then
    return jsonb_build_object('ok', false, 'message', normalized_plate || ' is not currently parked.');
  end if;

  update parking_records records
  set status = 'Exited',
      exit_time = now()
  where records.id = exiting_id;

  select records.id, records.plate_number
  into promoted_id, promoted_plate
  from parking_records records
  where records.status = 'Waiting'
  order by records.queue_number, records.created_at
  limit 1;

  if promoted_id is not null then
    update parking_records records
    set status = 'Parked',
        slot_id = freed_slot,
        queue_number = null,
        entry_time = now()
    where records.id = promoted_id;

    perform normalize_waiting_queue();

    return jsonb_build_object(
      'ok',
      true,
      'message',
      normalized_plate || ' exited from ' || freed_slot || '. ' || promoted_plate ||
      ' automatically moved from waiting queue into ' || freed_slot || '.'
    );
  end if;

  return jsonb_build_object(
    'ok',
    true,
    'message',
    normalized_plate || ' exited from ' || freed_slot || '. ' || freed_slot || ' is now available.'
  );
end;
$$;

revoke all on function next_record_id() from public, anon, authenticated;
revoke all on function normalize_waiting_queue() from public, anon, authenticated;
revoke all on function arrive_vehicle(text, text, text) from public;
revoke all on function exit_vehicle(text) from public;
grant execute on function arrive_vehicle(text, text, text) to anon, authenticated;
grant execute on function exit_vehicle(text) to anon, authenticated;

insert into parking_records
  (record_id, plate_number, owner_name, vehicle_type, slot_id, status, queue_number, entry_time, exit_time, created_at)
values
  ('R001', 'OKI222', 'SECRET', 'Car', 'P001', 'Exited', null, '2026-08-26 22:12:27+08', '2026-08-26 22:28:40+08', '2026-08-26 22:12:27+08'),
  ('R002', 'ABC123', 'SOYA', 'Van', 'P002', 'Parked', null, '2026-08-26 22:25:47+08', null, '2026-08-26 22:25:47+08'),
  ('R003', 'DEF456', 'WENEBEE', 'Truck', 'P003', 'Exited', null, '2026-08-26 22:26:13+08', '2026-08-27 13:12:33+08', '2026-08-26 22:26:13+08'),
  ('R004', 'XYZ000', 'GOODWIN', 'Motorcycle', 'P004', 'Exited', null, '2026-08-26 22:26:38+08', '2026-08-27 14:28:20+08', '2026-08-26 22:26:38+08'),
  ('R005', '000KKK', 'ARADA', 'Car', 'P005', 'Exited', null, '2026-08-26 22:27:02+08', '2026-08-27 12:48:05+08', '2026-08-26 22:27:02+08'),
  ('R006', '789HAH', 'IORI', 'Car', 'P001', 'Parked', null, '2026-08-26 22:28:40+08', null, '2026-08-26 22:28:40+08'),
  ('R007', 'ASD123', 'vfdfgdg', 'Car', 'P005', 'Parked', null, '2026-08-27 12:48:05+08', null, '2026-08-27 12:48:05+08'),
  ('R008', '72A377', 'AAJJ', 'Motorcycle', 'P003', 'Parked', null, '2026-08-27 13:12:33+08', null, '2026-08-27 13:12:33+08');
