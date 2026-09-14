import { Injectable } from '@angular/core';
import { PaymobiStatus, PaymobiStatusCobranca } from './paymobi-vendas.service';
import { PaymobiLinhaView, soDigitos, statusCobrancaSalvo } from './paymobi-calculo.service';

export interface PaymobiFiltrosEstado {
  status: PaymobiStatus | 'todos' | 'ativos';
  resultado: 'todos' | 'aguardando' | 'lucro' | 'prejuizo' | 'cancelamento';
  bloqueado: 'todos' | 'sim' | 'nao';
  atraso: 'todos' | 'com' | 'sem';
  parcelasAtrasoDe: number | null;
  parcelasAtrasoAte: number | null;
  cobranca: 'todos' | PaymobiStatusCobranca;
  nome: string;
  cpf: string;
  telefone: string;
  imei: string;
  dataDe: string;
  dataAte: string;
}

export const FILTROS_VAZIOS: PaymobiFiltrosEstado = {
  status: 'ativos',
  resultado: 'todos',
  bloqueado: 'todos',
  atraso: 'todos',
  parcelasAtrasoDe: null,
  parcelasAtrasoAte: null,
  cobranca: 'todos',
  nome: '',
  cpf: '',
  telefone: '',
  imei: '',
  dataDe: '',
  dataAte: '',
};

function qtdFiltro(n: number | null | undefined): number | null {
  if (n == null || n === ('' as unknown as number)) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

@Injectable({ providedIn: 'root' })
export class PaymobiFiltrosService {
  aplicar(linhas: PaymobiLinhaView[], f: PaymobiFiltrosEstado): PaymobiLinhaView[] {
    const nome = f.nome.trim().toLowerCase();
    const cpf = soDigitos(f.cpf);
    const tel = soDigitos(f.telefone);
    const imei = soDigitos(f.imei);
    return linhas.filter(l => {
      const v = l.venda;
      if (f.status === 'ativos') {
        if (l.status !== 'aberta' && l.status !== 'atrasada') return false;
      } else if (f.status !== 'todos' && l.status !== f.status) return false;
      if (f.bloqueado === 'sim' && !l.bloqueado) return false;
      if (f.bloqueado === 'nao' && l.bloqueado) return false;
      if (f.atraso === 'com' && l.parcelasAtraso <= 0) return false;
      if (f.atraso === 'sem' && l.parcelasAtraso > 0) return false;
      const atrasoDe = qtdFiltro(f.parcelasAtrasoDe);
      const atrasoAte = qtdFiltro(f.parcelasAtrasoAte);
      if (atrasoDe != null && l.parcelasAtraso < atrasoDe) return false;
      if (atrasoAte != null && l.parcelasAtraso > atrasoAte) return false;
      if (f.cobranca !== 'todos' && statusCobrancaSalvo(l) !== f.cobranca) return false;
      if (nome && !(v.clienteNome ?? '').toLowerCase().includes(nome)) return false;
      if (cpf && !soDigitos(v.clienteCpf).includes(cpf)) return false;
      if (tel && !soDigitos(v.clienteTelefone).includes(tel)) return false;
      if (imei && !soDigitos(v.aparelhoImei).includes(imei)) return false;
      const data = (v.dataVenda ?? '').slice(0, 10);
      if (f.dataDe && data < f.dataDe) return false;
      if (f.dataAte && data > f.dataAte) return false;
      if (f.resultado === 'todos') return true;
      if (f.resultado === 'aguardando') return !l.concretizada;
      if (f.resultado === 'cancelamento') return l.status === 'cancelada';
      if (f.resultado === 'lucro') return l.deuLucroParaRateio;
      return l.contaCusto && l.lucroAntesPlataforma < 0;
    });
  }

  contarAtivos(f: PaymobiFiltrosEstado): number {
    let n = 0;
    if (f.status !== 'ativos') n++;
    if (f.resultado !== 'todos') n++;
    if (f.bloqueado !== 'todos') n++;
    if (f.atraso !== 'todos') n++;
    if (qtdFiltro(f.parcelasAtrasoDe) != null) n++;
    if (qtdFiltro(f.parcelasAtrasoAte) != null) n++;
    if (f.cobranca !== 'todos') n++;
    if (f.nome.trim()) n++;
    if (f.cpf.trim()) n++;
    if (f.telefone.trim()) n++;
    if (f.imei.trim()) n++;
    if (f.dataDe) n++;
    if (f.dataAte) n++;
    return n;
  }
}
