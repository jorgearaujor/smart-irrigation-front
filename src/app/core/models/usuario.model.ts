export type TipoUsuario = 'Administrador' | 'Visualizador';

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  tipo: TipoUsuario;
  urlImg: string;
}
