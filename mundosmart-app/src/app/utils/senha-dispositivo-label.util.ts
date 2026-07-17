import { BlingOrdemServico } from '../models/bling.models';

export function labelSenhaDispositivoOs(os: BlingOrdemServico): string {
  const tipo = os.senhaDispositivoTipo;
  const valor = os.senhaDispositivo?.trim();

  if (!tipo) return '—';
  if (tipo === 'nao_deixou') return 'Cliente não deixou senha';
  if (tipo === 'sem_senha') return 'Sem senha';
  if (tipo === 'numerica') return valor ? `Senha: ${valor}` : 'Senha';
  if (tipo === 'desenho') return valor ? 'Desenho registrado' : 'Desenho';
  return '—';
}
