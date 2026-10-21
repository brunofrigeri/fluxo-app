-- OPTIONAL, development only: fictional clients so the screens are not empty.
-- Do not run this on the production database.

insert into clients (document, name, email, phone, date_of_birth) values
  ('111.111.111-11', 'Bruno Almeida',        'bruno@example.com',  '(11) 98123-4501', '1989-03-14'),
  ('222.222.222-22', 'José "Zé" Carvalho',   'ze@example.com',     '(11) 98455-7712', '1976-11-02'),
  ('333.333.333-33', 'Luís Fernando Moreira','luis@example.com',   '(11) 99234-8805', '1992-07-21'),
  ('444.444.444-44', 'João Pedro Tavares',   'joao@example.com',   '(11) 97766-3120', '1985-01-30'),
  ('555.555.555-55', 'Marina Duarte',        'marina@example.com', '(11) 98012-6639', '1990-10-08'),
  ('666.666.666-66', 'Helena Barros',        'helena@example.com', '(11) 99871-2043', '1968-05-17');

insert into client_modality_instructors (client_id, modality_id)
select c.id, (select id from modalities where key = 'pilates') from clients c
on conflict do nothing;

insert into recurring_slots (client_id, weekday, start_time, active_from, modality_id)
select c.id, s.weekday, s.start_time::time, current_date, (select id from modalities where key = 'pilates')
from clients c
join (values
  ('Bruno Almeida', 1, '07:00'), ('Bruno Almeida', 4, '10:00'),
  ('José "Zé" Carvalho', 1, '07:00'), ('José "Zé" Carvalho', 3, '18:00'), ('José "Zé" Carvalho', 5, '07:00'),
  ('Luís Fernando Moreira', 1, '07:00'), ('Luís Fernando Moreira', 4, '07:00'),
  ('João Pedro Tavares', 1, '07:00'), ('João Pedro Tavares', 3, '09:00'),
  ('Marina Duarte', 2, '08:00'), ('Marina Duarte', 4, '08:00'),
  ('Helena Barros', 2, '18:00'), ('Helena Barros', 5, '18:00'), ('Helena Barros', 6, '09:00')
) as s(name, weekday, start_time) on s.name = c.name;

select generate_bookings(8);
