-- Test accounts and catalog rows the security tests act on (run.sh loads
-- this after the migrations). A, B, C, D are free users, PRO a subscriber,
-- ADM an admin (app_metadata role).
-- users: A (free), B (free), ADM (admin), PRO (subscriber)
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@test','{"full_name":"Alice"}','{}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@test','{"full_name":"Bob"}','{}'),
 ('cccccccc-0000-0000-0000-000000000003','c@test','{"full_name":"Carol"}','{}'),
 ('dddddddd-0000-0000-0000-000000000004','d@test','{"full_name":"Dan"}','{}'),
 ('adadadad-0000-0000-0000-00000000000a','adm@test','{"full_name":"Admin"}','{"role":"admin"}'),
 ('9a9a9a9a-0000-0000-0000-000000000009','pro@test','{"full_name":"Pro"}','{}');
update public.users set pro_until = now() + interval '30 days' where id='9a9a9a9a-0000-0000-0000-000000000009';
insert into public.meals(id,name,status,price,serving_size,procedure) select ('11111111-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'Catalog meal '||g, 'approved', 100+g, 2, array['step 1','step 2'] from generate_series(1,20) g;
insert into public.ingredients(id, canonical_name, price_source) values ('22222222-0000-0000-0000-000000000001','pork','manual');
