export interface Property {
  id: string;
  name: string;
  address: string;
  created_at: string;
  user_id: string;
}

export interface ExerciseYear {
  id: string;
  property_id: string;
  year_label: string;
  balance_start_casa: number;
  balance_start_box: number;
  balance_start_cantina: number;
  rates_paid_casa: number;
  rates_paid_box: number;
  rates_paid_cantina: number;
  created_at: string;
}

export interface FixedExpenses {
  id: string;
  property_id: string;
  year_label: string;
  spese_personali: number;
  prop_casa: number; prop_box: number; prop_cantina: number;
  gen_prop_casa: number; gen_prop_box: number; gen_prop_cantina: number;
  prop_alloggi: number;
  man_ord_casa: number; man_ord_box: number; man_ord_cantina: number;
  scale_prop_casa: number; scale_prop_box: number; scale_prop_cantina: number;
  scala_c_casa: number; scala_c_box: number; scala_c_cantina: number;
  asc_c_casa: number; asc_c_box: number; asc_c_cantina: number;
  addebiti_unita: number; addebiti_unita_imm: number;
  prop_box_extra: number;
  created_at: string;
}

export interface ConsumptionData {
  id: string;
  property_id: string;
  year_label: string;
  acqua_potabile: number;
  riscaldamento_involontario: number;
  riscaldamento_consumo: number;
  acqua_calda_involontaria: number;
  acqua_calda_consumo: number;
  energia_elettrica_box: number;
  movimenti_personali: number;
  risc_lettura_iniziale: number | null;
  risc_lettura_finale: number | null;
  acqua_calda_lettura_iniziale: number | null;
  acqua_calda_lettura_finale: number | null;
  acqua_fredda_lettura_iniziale: number | null;
  acqua_fredda_lettura_finale: number | null;
  totale_casa: number;
  totale_box: number;
  totale_cantina: number;
  created_at: string;
}

export interface Note {
  id: string;
  property_id: string;
  year_label: string | null;
  title: string;
  content: string;
  created_at: string;
}
