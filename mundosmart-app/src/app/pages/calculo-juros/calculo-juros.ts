import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CalculoJurosConfig,
  OpcaoParcela,
  ResultadoLiquido,
  calcularLiquido,
  carregarCalculoJurosConfig,
  formatarMoedaBr,
  formatarTaxaPct,
  gerarOpcoesParcelas,
} from '../../config/calculo-juros.config';

type ModoCalculo = 'parcelas' | 'liquido';

@Component({
  selector: 'app-calculo-juros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculo-juros.html',
  styleUrl: './calculo-juros.scss',
})
export class CalculoJurosPage implements OnInit {
  modo: ModoCalculo = 'parcelas';
  cfg: CalculoJurosConfig = carregarCalculoJurosConfig();
  mostrarTaxas = false;

  valorBase = '';
  opcoes: OpcaoParcela[] = [];
  opcaoSelecionada: OpcaoParcela | null = null;

  valorVenda = '';
  qtdParcelas = 1;
  entradaPorParcela = false;
  valorParcelaInput = '';
  resultadoLiquido: ResultadoLiquido | null = null;

  ngOnInit(): void {
    this.recalcular();
  }

  get subModo(): string {
    return this.modo === 'parcelas'
      ? 'Parcelamento mensal: taxa da maquininha de cada parcela, com 5% a mais só sobre a taxa.'
      : 'Valor cobrado → líquido pela mesma taxa (maquininha + 5% sobre a taxa).';
  }

  selecionarModo(modo: ModoCalculo): void {
    this.modo = modo;
    this.opcaoSelecionada = null;
    this.recalcular();
  }

  onValorChange(): void {
    this.opcaoSelecionada = null;
    this.recalcular();
  }

  selecionarOpcao(op: OpcaoParcela): void {
    this.opcaoSelecionada = op;
  }

  limparSelecao(): void {
    this.opcaoSelecionada = null;
  }

  formatarMoeda(v: number): string {
    return formatarMoedaBr(v);
  }

  formatarTaxa(v: number): string {
    return formatarTaxaPct(v);
  }

  valorBaseNumerico(): number {
    return this.parseMoeda(this.valorBase);
  }

  private parseMoeda(texto: string): number {
    const t = (texto ?? '').trim().replace(/\s/g, '');
    if (!t) return 0;
    if (t.includes(',') && t.includes('.')) {
      return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (t.includes(',')) {
      return Number(t.replace(',', '.')) || 0;
    }
    return Number(t) || 0;
  }

  private recalcular(): void {
    if (this.modo === 'parcelas') {
      const valor = this.parseMoeda(this.valorBase);
      this.opcoes = gerarOpcoesParcelas(valor, this.cfg);
      this.resultadoLiquido = null;
      return;
    }

    this.opcoes = [];
    let total = this.parseMoeda(this.valorVenda);
    const n = Math.max(1, Math.min(18, Math.round(Number(this.qtdParcelas) || 1)));
    this.qtdParcelas = n;

    if (this.entradaPorParcela) {
      total = this.parseMoeda(this.valorParcelaInput) * n;
    }

    if (total <= 0) {
      this.resultadoLiquido = null;
      return;
    }

    this.resultadoLiquido = calcularLiquido(total, n, this.cfg);
  }
}
