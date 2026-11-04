-- Demo data for the prototype. All lodges are flagged is_demo = true and shown with a "Demo" badge.
-- People and lodges are fictional; prices are illustrative 2026 annual rents.
-- Seed accounts have no password and cannot sign in.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'landlord.demo@example.com', '', now(), '{"provider":"email","providers":["email"]}',
   '{"full_name":"Ngozi Okafor","role":"landlord","is_adult":true,"accepted_terms":true,"policy_version":"seed"}',
   now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'landlord2.demo@example.com', '', now(), '{"provider":"email","providers":["email"]}',
   '{"full_name":"Emeka Nwosu","role":"landlord","is_adult":true,"accepted_terms":true,"policy_version":"seed"}',
   now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'agent.demo@example.com', '', now(), '{"provider":"email","providers":["email"]}',
   '{"full_name":"Chidi Eze","role":"agent","is_adult":true,"accepted_terms":true,"policy_version":"seed"}',
   now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'scout.demo@example.com', '', now(), '{"provider":"email","providers":["email"]}',
   '{"full_name":"Amaka Obi","role":"student","is_adult":true,"accepted_terms":true,"policy_version":"seed"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

update public.profiles set identity_verified_at = now()
 where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
              'a0000000-0000-4000-8000-000000000003');
update public.profiles set role = 'scout' where id = 'a0000000-0000-4000-8000-000000000004';

insert into public.lodges (id, owner_id, agent_id, title, description, area, address, room_type, amenities,
                           distance_to_gate_m, nearest_gate, rent_kobo, agent_fee_kobo, status, is_demo)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'Divine Grace Lodge', 'Quiet self-contain on a fenced compound with 12 rooms. Tiled floors, POP ceiling and a private kitchenette. Borehole water runs daily.',
   'Eziobodo', 'Off Eziobodo Market Road, Eziobodo', 'self_contain',
   '{prepaid_meter,borehole,fenced,tiled,pop_ceiling,kitchenette,wardrobe}', 650, 'back_gate',
   35000000, 1500000, 'verified', true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', null,
   'Royal Palm Hostel', 'Budget single rooms with shared kitchen and bathroom. Listed directly by the landlord, so there is no agent fee.',
   'Eziobodo', 'Church Street, Eziobodo', 'single_room',
   '{borehole,fenced,shared_kitchen,shared_bathroom}', 900, 'back_gate',
   18000000, 0, 'verified', true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'Emerald Court', 'Room and parlour for students who want space to share. Solar backup keeps lights and fans on during outages.',
   'Eziobodo', 'Behind St. Paul''s, Eziobodo', 'room_and_parlour',
   '{prepaid_meter,borehole,fenced,security,tiled,solar_backup,kitchen,wardrobe}', 1200, 'back_gate',
   55000000, 2750000, 'verified', true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'Sunrise Lodge', 'Self-contain with a night guard and gated entry. Short walk to the shuttle stop.',
   'Umuchima', 'Umuchima Junction, Umuchima', 'self_contain',
   '{prepaid_meter,borehole,fenced,security,tiled,kitchenette}', 1500, 'main_gate',
   30000000, 1200000, 'verified', true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', null,
   'Unity Villa', 'Single rooms on an upstairs floor with good airflow. The landlord lives on the compound.',
   'Umuchima', 'Community School Road, Umuchima', 'single_room',
   '{borehole,fenced,shared_kitchen,shared_bathroom,wardrobe}', 1800, 'main_gate',
   16000000, 0, 'verified', true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'Peace Haven Apartments', 'Two-bedroom flat suited to two or three students sharing. It has its own kitchen, a parking space and 24h security.',
   'Umuchima', 'New Layout, Umuchima', 'flat',
   '{prepaid_meter,borehole,fenced,security,tiled,pop_ceiling,solar_backup,kitchen,parking,wardrobe}', 2200, 'main_gate',
   85000000, 4000000, 'verified', true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'Green Gate Lodge', 'Self-contain beside a tarred road, so it stays reachable in the rainy season. Each room has its own prepaid meter.',
   'Ihiagwa', 'Ihiagwa Road, Ihiagwa', 'self_contain',
   '{prepaid_meter,borehole,fenced,tiled,kitchenette}', 1400, 'main_gate',
   28000000, 1400000, 'verified', true),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000002', null,
   'Covenant Lodge', 'Simple single rooms at the lowest price on the list. Water comes from a shared tank that is refilled weekly.',
   'Ihiagwa', 'Market Square, Ihiagwa', 'single_room',
   '{fenced,shared_kitchen,shared_bathroom}', 2500, 'main_gate',
   15000000, 0, 'verified', true)
on conflict (id) do nothing;

-- Approved scout inspections for five lodges (the others show "not yet inspected").
insert into public.inspections (lodge_id, scout_id, status, checklist, notes, submitted_at)
select l.id, 'a0000000-0000-4000-8000-000000000004', 'approved',
       '{"matches_listing":true,"water_running":true,"power_working":true,"doors_lock":true,"no_leaks":true,"toilet_working":true}'::jsonb,
       'Seed inspection', now() - (n || ' days')::interval
  from (values ('b0000000-0000-4000-8000-000000000001'::uuid, 3), ('b0000000-0000-4000-8000-000000000003'::uuid, 5),
               ('b0000000-0000-4000-8000-000000000004'::uuid, 2), ('b0000000-0000-4000-8000-000000000006'::uuid, 9),
               ('b0000000-0000-4000-8000-000000000007'::uuid, 4)) as v(id, n)
  join public.lodges l on l.id = v.id
 where not exists (select 1 from public.inspections i where i.lodge_id = l.id);
