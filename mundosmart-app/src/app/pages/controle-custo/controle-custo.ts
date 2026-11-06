import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { GridAcao } from '../../components/grid-acao/grid-acao';
import { avisarErroUsuario } from '../../services/user-feedback.service';
import { agoraDataBrasil } from '../../utils/horario-brasil.util';
import {
  CATEGORIAS_CUSTO,
  ControleCustoColaborador,
  ControleCustoComparativo,
  ControleCustoPrevisao,
  ControleCustoLancamento,
  ControleCustoPainel,
  ControleCustoService,
  RECORRENCIAS_CUSTO,
  SETORES_CUSTO,
} from '../../services/controle-custo';

@Component({
  selector: 'app-controle-custo',
  standalone: true,
  imports: [CommonModule, FormsModule, GridAcao],
  templateUrl: './controle-custo.html',
  styles: [`
    .intro { margin: 0 0 16px; color: #475569; max-width: 760px; }
    .mes-barra { display: flex; gap: 8px; align-items: end; margin-bottom: 8px; flex-wrap: wrap; }
    .mes-barra label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .mes-nav { display: flex; gap: 8px; align-items: end; }
    .mes-aviso { margin: 0 0 16px; font-size: 13px; color: #9a3412; }
    .tabela-rolagem { overflow-x: auto; margin-bottom: 8px; }
    .comparativo { border-collapse: collapse; min-width: 640px; width: 100%; background: #fff; }
    .comparativo th, .comparativo td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; white-space: nowrap; }
    .comparativo th:first-child, .comparativo td:first-child { text-align: left; }
    .comparativo .grupo { font-weight: 700; background: #f8fafc; }
    .comparativo .marcado { background: #eef2ff; }
    .comparativo .mes-btn, .comparativo .celula-mes {
      border: 0; background: transparent; color: inherit; font: inherit; font-weight: 700;
      cursor: pointer; padding: 0; text-align: inherit;
    }
    .comparativo .celula-mes { font-weight: 500; width: 100%; }
    .comparativo .mes-btn:hover, .comparativo .celula-mes:hover { text-decoration: underline; }
    .subiu { color: #9a3412; }
    .caiu { color: #166534; }
    .totais { display: flex; gap: 16px; flex-wrap: wrap; margin: 0 0 16px; color: #334155; font-size: 14px; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 22px; }
    .card {
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #fff;
      display: flex; flex-direction: column; gap: 6px;
    }
    .card h3 { margin: 0; font-size: 15px; }
    .origem { margin: 0; font-size: 12px; line-height: 1.35; color: #64748b; }
    .card label { font-size: 12px; color: #64748b; }
    .card input[type="number"] { width: 100%; }
    .linha { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
    .linha strong { font-variant-numeric: tabular-nums; }
    .lucro { color: #166534; }
    .negativo { color: #9a3412; }
    .barra { height: 6px; border-radius: 99px; background: #e2e8f0; overflow: hidden; }
    .barra span { display: block; height: 100%; background: #0f172a; }
    .bloco { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 8px; }
    .bloco h3 { margin: 0 0 10px; font-size: 16px; }
    .form-linha { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 12px; }
    .form-linha .campo { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
    .form-linha .campo.largo { flex: 1 1 220px; }
    .form-linha label { font-size: 12px; color: #64748b; }
    .rateio { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .rateio label { display: flex; align-items: center; gap: 6px; font-size: 13px; background: #f8fafc; border-radius: 8px; padding: 6px 8px; }
    .rateio input { width: 72px; }
    .soma-rateio { font-size: 13px; margin: -4px 0 12px; }
    .ok { color: #166534; }
    .pessoas { display: flex; flex-wrap: wrap; gap: 8px; }
    .pessoa { display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px 8px 4px 12px; background: #fff; }
    .checks { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 13px; }
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 40; background: rgba(15, 23, 42, 0.45);
      display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px; overflow: auto;
    }
    .modal-box {
      width: min(760px, 100%); background: #fff; border-radius: 14px; padding: 16px 18px 18px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.2);
    }
    .modal-pessoa { width: min(480px, 100%); display: flex; flex-direction: column; gap: 12px; }
    .modal-pessoa .campo { display: flex; flex-direction: column; gap: 4px; }
    .modal-pessoa .campo label { font-size: 12px; color: #64748b; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
    .modal-header h3 { margin: 0; }
    .modal-close { background: transparent; color: #334155; border: 0; font-size: 18px; padding: 4px 8px; }
    .modal-dica { margin: 0 0 12px; color: #475569; }
    .modal-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
    .acoes { display: flex; gap: 4px; justify-content: flex-end; }
    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .cards { grid-template-columns: 1fr; } }
  `],
})
export class ControleCustoPage implements OnInit {
  readonly setores = SETORES_CUSTO;
  readonly categorias = CATEGORIAS_CUSTO;
  readonly recorrencias = RECORRENCIAS_CUSTO;
  readonly mesAtual = agoraDataBrasil().slice(0, 7);
  competencia = this.mesAtual;
  private focarCustos = false;
  painel: ControleCustoPainel | null = null;
  comparativo: ControleCustoComparativo | null = null;
  previsao: ControleCustoPrevisao | null = null;
  carregando = false;
  salvando = false;
  erro = '';

  modalCusto = false;
  modalContasFixas = false;
  reabrirContasFixas = false;
  contasFixas: ControleCustoLancamento[] = [];
  custoEditandoId = '';
  custoCategoria = 'colaborador';
  custoRecorrencia = 'unico';
  custoMeses = 6;
  custoInicio = '';
  custoColaboradorId = '';
  custoDescricao = '';
  custoValor: number | null = null;
  rateio: Record<string, number> = {};

  reinvSetor = 'assistencia';
  reinvDescricao = '';
  reinvValor: number | null = null;

  modalPlano = false;
  planoSetor = 'assistencia';
  planoInicio = '';
  planoMeses = 6;
  planoDescricao = '';
  planoValor: number | null = null;

  modalPessoa = false;
  buscaPessoa = '';
  pessoaNome = '';
  pessoaCargo = '';
  pessoaSetores: Record<string, boolean> = {};
  pessoaEditandoId = '';

  constructor(private api: ControleCustoService) {}

  ngOnInit(): void {
    this.zerarRateio();
    this.carregar();
  }

  carregar(): void {
    if (this.competencia > this.mesAtual) this.competencia = this.mesAtual;
    this.carregando = true;
    this.erro = '';
    this.api.painel(this.competencia).subscribe({
      next: painel => {
        this.aplicarPainel(painel);
        this.carregando = false;
        if (this.focarCustos) this.rolarAteCustos();
      },
      error: err => {
        this.erro = err.error?.erro || 'Erro ao carregar o controle de custo.';
        this.carregando = false;
      },
    });
  }

  mudarMes(delta: number): void {
    const [ano, mes] = this.competencia.split('-').map(Number);
    const data = new Date(ano, mes - 1 + delta, 1);
    const proximo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    if (proximo > this.mesAtual) return;
    this.verMes(proximo);
  }

  verMes(mes: string): void {
    if (!mes || mes > this.mesAtual) return;
    this.focarCustos = true;
    if (mes === this.competencia) {
      this.rolarAteCustos();
      return;
    }
    this.competencia = mes;
    this.carregar();
  }

  mesDoComparativo(indice: number): string {
    return this.comparativo?.meses?.[indice] ?? '';
  }

  abrirContasFixas(): void {
    this.modalContasFixas = true;
    this.erro = '';
    this.api.contasFixas().subscribe({
      next: lista => { this.contasFixas = lista; },
      error: () => this.falhar('Não foi possível carregar as contas fixas.'),
    });
  }

  fecharContasFixas(): void {
    if (this.salvando) return;
    this.modalContasFixas = false;
  }

  editarContaFixa(item: ControleCustoLancamento): void {
    this.modalContasFixas = false;
    this.reabrirContasFixas = true;
    this.editarCusto(item);
  }

  abrirCusto(): void {
    this.custoEditandoId = '';
    this.custoInicio = this.competencia;
    this.custoRecorrencia = 'unico';
    this.custoMeses = 6;
    this.custoCategoria = 'aluguel';
    this.custoColaboradorId = '';
    this.custoDescricao = '';
    this.custoValor = null;
    this.dividir(this.setores.map(s => s.id));
    this.modalCusto = true;
    this.erro = '';
  }

  fecharCusto(): void {
    if (this.salvando) return;
    this.modalCusto = false;
    this.custoEditandoId = '';
    this.voltarContasFixas();
  }

  editarCusto(item: ControleCustoLancamento): void {
    this.custoEditandoId = item.id ?? '';
    this.custoInicio = item.competencia || this.competencia;
    this.custoRecorrencia = item.recorrencia || 'unico';
    this.custoMeses = item.meses || item.totalParcelas || 6;
    this.custoCategoria = item.categoria || 'outro';
    this.custoColaboradorId = item.colaboradorId || '';
    this.custoDescricao = item.descricao || '';
    this.custoValor = item.valor;
    this.zerarRateio();
    for (const parte of item.rateio ?? []) this.rateio[parte.setor] = parte.percentual;
    this.modalCusto = true;
    this.erro = '';
  }

  @HostListener('document:keydown.escape')
  fecharModalPorTecla(): void {
    if (this.modalPessoa) this.fecharPessoa();
    else if (this.modalPlano) this.fecharPlano();
    else if (this.modalCusto) this.fecharCusto();
    else if (this.modalContasFixas) this.fecharContasFixas();
  }

  lancarCusto(): void {
    const valor = Number(this.custoValor);
    if (!(valor > 0)) {
      this.falhar('Informe o valor do custo.');
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.custoInicio)) {
      this.falhar('Informe o mês do custo.');
      return;
    }
    if (this.custoInicio > this.mesAtual) {
      this.falhar('O custo só pode ser lançado no mês atual ou em um mês passado.');
      return;
    }
    if (this.custoCategoria === 'colaborador' && !this.custoColaboradorId) {
      this.falhar('Escolha o colaborador.');
      return;
    }
    if (this.pedeQuantidade && !(Number(this.custoMeses) >= this.minimoMeses)) {
      this.falhar(this.custoRecorrencia === 'anual' ? 'Informe a quantidade de anos.' : 'Informe a quantidade de meses.');
      return;
    }
    if (Math.abs(this.somaRateio - 100) > 0.05) {
      this.falhar('A soma do rateio precisa fechar em 100%.');
      return;
    }
    const editando = this.custoEditandoId;
    const body = {
      competencia: this.custoInicio,
      categoria: this.custoCategoria,
      colaboradorId: this.custoCategoria === 'colaborador' ? this.custoColaboradorId : undefined,
      descricao: this.custoDescricao.trim(),
      valor,
      recorrencia: this.custoRecorrencia,
      meses: this.pedeQuantidade ? Number(this.custoMeses) : undefined,
      rateio: this.setores
        .filter(s => (this.rateio[s.id] || 0) > 0)
        .map(s => ({ setor: s.id, percentual: this.rateio[s.id] })),
    };
    const req = editando
      ? this.api.atualizarCusto(editando, this.competencia, body)
      : this.api.lancarCusto(body);
    this.executar(req, () => {
      this.modalCusto = false;
      this.custoEditandoId = '';
      this.custoDescricao = '';
      this.custoValor = null;
      if (!editando && this.custoInicio !== this.competencia) this.competencia = this.custoInicio;
      this.voltarContasFixas();
    });
  }

  abrirPlano(): void {
    this.planoSetor = this.reinvSetor;
    this.planoInicio = this.competencia;
    this.planoMeses = 6;
    this.planoDescricao = '';
    this.planoValor = null;
    this.modalPlano = true;
    this.erro = '';
  }

  fecharPlano(): void {
    if (this.salvando) return;
    this.modalPlano = false;
  }

  lancarPlano(): void {
    const valor = Number(this.planoValor);
    const meses = Number(this.planoMeses);
    if (!(valor > 0)) {
      this.falhar('Informe o valor por mês do plano.');
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.planoInicio)) {
      this.falhar('Informe o mês de início do plano.');
      return;
    }
    if (this.planoInicio > this.mesAtual) {
      this.falhar('O plano começa no mês atual ou em um mês passado.');
      return;
    }
    if (!(meses >= 1) || meses > 60) {
      this.falhar('Informe de 1 a 60 meses para o plano.');
      return;
    }
    if (this.planoDescricao.trim().length < 2) {
      this.falhar('Descreva em que o valor será reinvestido.');
      return;
    }
    this.executar(this.api.lancarReinvestimento({
      competencia: this.planoInicio,
      setor: this.planoSetor,
      descricao: this.planoDescricao.trim(),
      valor,
      recorrencia: 'mensal',
      meses,
    }), () => {
      this.modalPlano = false;
      if (this.planoInicio !== this.competencia) this.competencia = this.planoInicio;
    });
  }

  get previsaoPlano(): string {
    const valor = Number(this.planoValor);
    const meses = Number(this.planoMeses);
    if (!(valor > 0) || !(meses >= 1) || !this.planoInicio) return '';
    return `${this.dinheiro(valor)} por mês, durante ${meses} ${meses === 1 ? 'mês' : 'meses'}, em ${this.nomeSetor(this.planoSetor)}, a partir de ${this.formatarMes(this.planoInicio)}.`;
  }

  lancarReinvestimento(): void {
    const valor = Number(this.reinvValor);
    if (!(valor > 0)) {
      this.falhar('Informe o valor do reinvestimento.');
      return;
    }
    if (this.reinvDescricao.trim().length < 2) {
      this.falhar('Descreva em que o valor foi reinvestido.');
      return;
    }
    this.executar(this.api.lancarReinvestimento({
      competencia: this.competencia,
      setor: this.reinvSetor,
      descricao: this.reinvDescricao.trim(),
      valor,
    }), () => {
      this.reinvDescricao = '';
      this.reinvValor = null;
    });
  }

  excluirLancamento(item: ControleCustoLancamento): void {
    if (!item.id) return;
    const serie = !!item.recorrencia && item.recorrencia !== 'unico';
    const pergunta = !serie
      ? 'Excluir este lançamento?'
      : item.tipo === 'reinvestimento'
        ? 'Excluir este plano? Ele sai deste mês e dos outros meses.'
        : 'Excluir este custo? Ele sai deste mês e dos outros meses da série.';
    if (!confirm(pergunta)) return;
    this.executar(this.api.excluirLancamento(item.id, this.competencia));
  }

  get colaboradoresFiltrados(): ControleCustoColaborador[] {
    const lista = this.painel?.colaboradores ?? [];
    const termo = this.normalizarBusca(this.buscaPessoa);
    if (!termo) return lista;
    return lista.filter(pessoa => this.normalizarBusca(`${pessoa.nome} ${pessoa.cargo ?? ''} ${this.setoresDaPessoa(pessoa)}`).includes(termo));
  }

  abrirPessoa(): void {
    this.pessoaEditandoId = '';
    this.pessoaNome = '';
    this.pessoaCargo = '';
    this.pessoaSetores = {};
    this.modalPessoa = true;
    this.erro = '';
  }

  fecharPessoa(): void {
    if (this.salvando) return;
    this.limparPessoa();
  }

  salvarPessoa(): void {
    const setores = this.setores.filter(s => this.pessoaSetores[s.id]).map(s => s.id);
    if (this.pessoaNome.trim().length < 2) {
      this.falhar('Informe o nome do colaborador.');
      return;
    }
    if (setores.length === 0) {
      this.falhar('Escolha ao menos um setor.');
      return;
    }
    this.executar(this.api.salvarColaborador({
      id: this.pessoaEditandoId || undefined,
      nome: this.pessoaNome.trim(),
      cargo: this.pessoaCargo.trim(),
      setores,
      competencia: this.competencia,
    }), () => this.limparPessoa());
  }

  editarPessoa(pessoa: ControleCustoColaborador): void {
    this.pessoaEditandoId = pessoa.id ?? '';
    this.pessoaNome = pessoa.nome;
    this.pessoaCargo = pessoa.cargo ?? '';
    this.pessoaSetores = {};
    for (const setor of this.setores) this.pessoaSetores[setor.id] = pessoa.setores.includes(setor.id);
    this.modalPessoa = true;
    this.erro = '';
  }

  excluirPessoa(pessoa: ControleCustoColaborador): void {
    if (!pessoa.id || !confirm(`Excluir ${pessoa.nome} do controle? Os lançamentos já feitos permanecem.`)) return;
    this.executar(this.api.excluirColaborador(pessoa.id, this.competencia), () => {
      if (this.pessoaEditandoId === pessoa.id) this.limparPessoa();
    });
  }

  aoMudarCategoria(): void {
    if (this.custoCategoria === 'colaborador') this.aoMudarColaborador();
    else this.dividir(this.setores.map(s => s.id));
  }

  aoMudarColaborador(): void {
    const pessoa = this.painel?.colaboradores.find(c => c.id === this.custoColaboradorId);
    this.dividir(pessoa?.setores?.length ? pessoa.setores : []);
  }

  dividirMarcados(): void {
    const marcados = this.setores.filter(s => (this.rateio[s.id] || 0) > 0).map(s => s.id);
    this.dividir(marcados.length ? marcados : this.setores.map(s => s.id));
  }

  get pedeQuantidade(): boolean {
    return this.custoRecorrencia === 'mensal' || this.custoRecorrencia === 'parcelado' || this.custoRecorrencia === 'anual';
  }

  get minimoMeses(): number {
    return this.custoRecorrencia === 'parcelado' ? 2 : 1;
  }

  get rotuloQuantidade(): string {
    return this.custoRecorrencia === 'anual' ? 'Quantos anos' : 'Quantos meses';
  }

  get rotuloValor(): string {
    if (this.custoRecorrencia === 'parcelado') return 'Valor total';
    if (this.custoRecorrencia === 'anual') return 'Valor do ano';
    if (this.custoRecorrencia === 'unico') return 'Valor';
    return 'Valor por mês';
  }

  get dicaRecorrencia(): string {
    return this.recorrencias.find(r => r.id === this.custoRecorrencia)?.dica ?? '';
  }

  get previsaoCusto(): string {
    const valor = Number(this.custoValor);
    if (!(valor > 0) || !this.custoInicio) return '';
    const dinheiro = this.dinheiro(valor);
    if (this.custoRecorrencia === 'unico') return `${dinheiro} em ${this.formatarMes(this.custoInicio)}.`;
    if (this.custoRecorrencia === 'fixo') return `${dinheiro} todo mês, a partir de ${this.formatarMes(this.custoInicio)}.`;
    const qtd = Number(this.custoMeses) || 0;
    if (this.custoRecorrencia === 'anual' && qtd > 0) {
      return `${dinheiro} uma vez por ano, por ${qtd} ${qtd === 1 ? 'ano' : 'anos'}, a partir de ${this.formatarMes(this.custoInicio)}.`;
    }
    if (this.custoRecorrencia === 'mensal' && qtd > 0) {
      return `${dinheiro} por mês, durante ${qtd} ${qtd === 1 ? 'mês' : 'meses'}, a partir de ${this.formatarMes(this.custoInicio)}.`;
    }
    if (this.custoRecorrencia === 'parcelado' && qtd > 1) {
      const parcela = Math.round((valor / qtd) * 100) / 100;
      return `${dinheiro} dividido em ${qtd} meses de ${this.dinheiro(parcela)}, a partir de ${this.formatarMes(this.custoInicio)}.`;
    }
    return '';
  }

  get somaRateio(): number {
    const soma = this.setores.reduce((acc, s) => acc + (Number(this.rateio[s.id]) || 0), 0);
    return Math.round(soma * 100) / 100;
  }

  get disponivelReinvestimento(): number {
    return this.painel?.setores.find(s => s.id === this.reinvSetor)?.disponivel ?? 0;
  }

  rotuloRecorrencia(item: ControleCustoLancamento): string {
    const tipo = item.recorrencia || 'unico';
    if (item.tipo === 'reinvestimento' && tipo === 'mensal') {
      return item.parcela && item.totalParcelas ? `Plano mensal ${item.parcela}/${item.totalParcelas}` : 'Plano mensal';
    }
    const nome = this.recorrencias.find(r => r.id === tipo)?.nome ?? 'Único';
    if (!item.parcela || !item.totalParcelas || tipo === 'unico' || tipo === 'fixo') return nome;
    return `${nome} ${item.parcela}/${item.totalParcelas}`;
  }

  valorDoMes(item: ControleCustoLancamento): number {
    return item.valorNoMes ?? item.valor;
  }

  nomeSetor(id?: string | null): string {
    return this.setores.find(s => s.id === id)?.nome ?? id ?? '';
  }

  nomeCategoria(id?: string | null): string {
    return this.categorias.find(c => c.id === id)?.nome ?? id ?? '';
  }

  setoresDaPessoa(pessoa: ControleCustoColaborador): string {
    return pessoa.setores.map(id => this.nomeSetor(id)).join(', ');
  }

  rateioTexto(rateio: { setor: string; percentual: number }[]): string {
    return (rateio ?? []).map(r => `${this.nomeSetor(r.setor)} ${this.formatarPercentual(r.percentual)}`).join(' · ');
  }

  fatiaReinvestimento(lucro: number, reinvestimento: number): number {
    if (!(lucro > 0)) return 0;
    return Math.max(0, Math.min(100, (reinvestimento / lucro) * 100));
  }

  dinheiro(valor: number | null | undefined): string {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  variacao(valores: number[]): number | null {
    if (!valores || valores.length < 2) return null;
    return (Number(valores[valores.length - 1]) || 0) - (Number(valores[valores.length - 2]) || 0);
  }

  private rolarAteCustos(): void {
    this.focarCustos = false;
    setTimeout(() => document.getElementById('custos-do-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  temParcelaNaPrevisao(): boolean {
    return !!this.previsao?.linhas.some(linha => linha.grupo === 'parcela' && linha.valores.some(valor => valor > 0));
  }

  private carregarComparativo(): void {
    this.api.comparativo(this.competencia, 6).subscribe({
      next: comparativo => { this.comparativo = comparativo; },
      error: () => { this.comparativo = null; },
    });
  }

  private carregarPrevisao(): void {
    this.api.previsao().subscribe({
      next: previsao => { this.previsao = previsao; },
      error: () => { this.previsao = null; },
    });
  }

  private voltarContasFixas(): void {
    if (!this.reabrirContasFixas) return;
    this.reabrirContasFixas = false;
    this.abrirContasFixas();
  }

  private aplicarPainel(painel: ControleCustoPainel): void {
    this.painel = painel;
    this.competencia = painel.competencia || this.competencia;
    this.carregarComparativo();
    this.carregarPrevisao();
  }

  private executar(req: Observable<ControleCustoPainel>, depois?: () => void): void {
    this.salvando = true;
    this.erro = '';
    req.subscribe({
      next: painel => {
        this.aplicarPainel(painel);
        this.salvando = false;
        depois?.();
      },
      error: (err: { error?: { erro?: string } }) => {
        this.falhar(err.error?.erro || 'Não foi possível salvar.');
        this.salvando = false;
      },
    });
  }

  private falhar(mensagem: string): void {
    this.erro = mensagem;
    avisarErroUsuario(mensagem);
  }

  private dividir(ids: string[]): void {
    this.zerarRateio();
    if (ids.length === 0) return;
    const base = Math.floor(10000 / ids.length) / 100;
    let acc = 0;
    ids.forEach((id, i) => {
      const percentual = i === ids.length - 1 ? Math.round((100 - acc) * 100) / 100 : base;
      acc += percentual;
      this.rateio[id] = percentual;
    });
  }

  private zerarRateio(): void {
    this.rateio = {};
    for (const setor of this.setores) this.rateio[setor.id] = 0;
  }

  limparPessoa(): void {
    this.modalPessoa = false;
    this.pessoaNome = '';
    this.pessoaCargo = '';
    this.pessoaEditandoId = '';
    this.pessoaSetores = {};
  }

  private normalizarBusca(texto: string): string {
    return (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  formatarMes(competencia: string): string {
    const [ano, mes] = competencia.split('-');
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const indice = Number(mes) - 1;
    return indice >= 0 && indice < 12 ? `${nomes[indice]}/${ano}` : competencia;
  }

  private formatarPercentual(valor: number): string {
    return `${(Number(valor) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }
}
