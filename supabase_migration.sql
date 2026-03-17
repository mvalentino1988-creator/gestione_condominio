-- ============================================================
-- CONDO MANAGER — Schema Supabase
-- Incolla tutto in: Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- Case / Immobili
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text default '',
  created_at timestamptz default now()
);

-- Saldo Esercizio per anno
create table if not exists exercise_years (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade not null,
  year_label text not null,
  balance_start_casa numeric default 0,
  balance_start_box numeric default 0,
  balance_start_cantina numeric default 0,
  rates_paid_casa numeric default 0,
  rates_paid_box numeric default 0,
  rates_paid_cantina numeric default 0,
  created_at timestamptz default now(),
  unique(property_id, year_label)
);

-- Spese Fisse
create table if not exists fixed_expenses (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade not null,
  year_label text not null,
  spese_personali numeric default 0,
  prop_casa numeric default 0,
  prop_box numeric default 0,
  prop_cantina numeric default 0,
  gen_prop_casa numeric default 0,
  gen_prop_box numeric default 0,
  gen_prop_cantina numeric default 0,
  prop_alloggi numeric default 0,
  man_ord_casa numeric default 0,
  man_ord_box numeric default 0,
  man_ord_cantina numeric default 0,
  scale_prop_casa numeric default 0,
  scale_prop_box numeric default 0,
  scale_prop_cantina numeric default 0,
  scala_c_casa numeric default 0,
  scala_c_box numeric default 0,
  scala_c_cantina numeric default 0,
  asc_c_casa numeric default 0,
  asc_c_box numeric default 0,
  asc_c_cantina numeric default 0,
  addebiti_unita numeric default 0,
  addebiti_unita_imm numeric default 0,
  prop_box_extra numeric default 0,
  created_at timestamptz default now(),
  unique(property_id, year_label)
);

-- Dati Consumi
create table if not exists consumption_data (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade not null,
  year_label text not null,
  acqua_potabile numeric default 0,
  riscaldamento_involontario numeric default 0,
  riscaldamento_consumo numeric default 0,
  acqua_calda_involontaria numeric default 0,
  acqua_calda_consumo numeric default 0,
  energia_elettrica_box numeric default 0,
  movimenti_personali numeric default 0,
  risc_lettura_iniziale numeric,
  risc_lettura_finale numeric,
  acqua_calda_lettura_iniziale numeric,
  acqua_calda_lettura_finale numeric,
  acqua_fredda_lettura_iniziale numeric,
  acqua_fredda_lettura_finale numeric,
  totale_casa numeric default 0,
  totale_box numeric default 0,
  totale_cantina numeric default 0,
  created_at timestamptz default now(),
  unique(property_id, year_label)
);

-- Note
create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade not null,
  year_label text,
  title text not null,
  content text default '',
  created_at timestamptz default now()
);

-- RLS: accesso libero (app privata)
alter table properties enable row level security;
alter table exercise_years enable row level security;
alter table fixed_expenses enable row level security;
alter table consumption_data enable row level security;
alter table notes enable row level security;

create policy "public_all" on properties for all using (true) with check (true);
create policy "public_all" on exercise_years for all using (true) with check (true);
create policy "public_all" on fixed_expenses for all using (true) with check (true);
create policy "public_all" on consumption_data for all using (true) with check (true);
create policy "public_all" on notes for all using (true) with check (true);
