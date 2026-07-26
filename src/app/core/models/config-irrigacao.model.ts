export type FaseCrescimento = 1 | 2 | 3 | 4;

export interface ConfigIrrigacao {
  kc: number;
  cultura: string;
  faseCrescimento: FaseCrescimento;
  espacamento_plantas_m: number;
  espacamento_linhas_m: number;
  vazao_gotejador_lph: number;
  num_gotejadores_planta: number;
  numero_total_plantas: number;
  limiar_umidade_minima: number;
}
