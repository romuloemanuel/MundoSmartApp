import { BlingOrcamento } from '../models/bling.models';
import { estilosDocumentoImpressaoOs } from './os-impressao.templates';
import { labelOpcoesPagamentoOrcamento } from '../config/os-pagamento.config';
import { htmlLogoCabecalhoImpressao } from './logo-impressao.util';

/** Texto fixo da impressão do pré-orçamento (especulativo). */
export const AVISO_PRE_ORCAMENTO_IMPRESSAO =
  'Este documento é um PRÉ-ORÇAMENTO com valor especulativo, baseado no que foi descrito pelo cliente. ' +
  'O aparelho NÃO foi aberto para diagnóstico interno. Após a análise técnica, pode ser necessário ' +
  'alterar serviços, peças ou valores. O orçamento final só será confirmado após a averiguação do equipamento.';

function esc(valor?: string | number | null): string {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDataCurta(valor?: string | null): string {
  if (!valor) return '—';
  const d = new Date(valor.includes('T') ? valor : `${valor}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function fmtMoeda(valor?: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function telefone(o: BlingOrcamento): string {
  const c = o.contato;
  return c?.celular?.trim() || c?.telefone?.trim() || '—';
}

function aparelho(o: BlingOrcamento): string {
  if (o.equipamento?.trim()) return o.equipamento.trim();
  const partes = [o.marcaNome, o.modeloNome].filter(Boolean);
  return partes.length ? partes.join(' ') : '—';
}

function total(o: BlingOrcamento): number {
  if (o.valorTotalAcordado != null) return o.valorTotalAcordado;
  if (o.valorTotal != null) return o.valorTotal;
  return (o.itens ?? []).reduce((acc, i) => {
    const unit = i.valorAcontado ?? i.valorUnitario ?? 0;
    const qtd = i.quantidade || 1;
    return acc + unit * qtd;
  }, 0);
}

function tabelaItens(o: BlingOrcamento): string {
  const itens = o.itens ?? [];
  if (!itens.length) {
    return '<p class="muted">Nenhum serviço informado.</p>';
  }

  const linhas = itens.map(item => {
    const unit = item.valorAcontado ?? item.valorUnitario ?? 0;
    const qtd = item.quantidade || 1;
    const sub = unit * qtd;
    return `<tr>
      <td>${esc(item.descricao || 'Serviço')}</td>
      <td class="num">${esc(qtd)}</td>
      <td class="num">${esc(fmtMoeda(unit))}</td>
      <td class="num">${esc(fmtMoeda(sub))}</td>
    </tr>`;
  }).join('');

  return `<table class="itens">
    <thead>
      <tr>
        <th>Serviço / descrição</th>
        <th class="num">Qtd</th>
        <th class="num">Valor</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

export function montarHtmlImpressaoOrcamento(o: BlingOrcamento): string {
  const valor = total(o);
  const pagamento = labelOpcoesPagamentoOrcamento(o);
  const observacoes = o.observacoes?.trim() || '—';

  const corpo = `
    <div class="cabecalho">
      ${htmlLogoCabecalhoImpressao()}
      <p>Pré-orçamento de serviço</p>
      <p class="doc-tipo">Documento especulativo — aparelho não aberto</p>
    </div>

    <div class="aviso-pre-orcamento">
      <strong class="titulo">Atenção — Pré-orçamento</strong>
      ${esc(AVISO_PRE_ORCAMENTO_IMPRESSAO)}
    </div>

    <div class="grid">
      <div class="campo"><label>Nº orçamento</label><span>#${esc(o.numero || o.id)}</span></div>
      <div class="campo"><label>Situação</label><span>${esc(o.situacao || '—')}</span></div>
      <div class="campo"><label>Cliente</label><span>${esc(o.contato?.nome || '—')}</span></div>
      <div class="campo"><label>Telefone</label><span>${esc(telefone(o))}</span></div>
      <div class="campo"><label>Aparelho</label><span>${esc(aparelho(o))}</span></div>
      <div class="campo"><label>Data</label><span>${esc(fmtDataCurta(o.data))}</span></div>
      <div class="campo"><label>Validade</label><span>${esc(fmtDataCurta(o.validade))}</span></div>
      <div class="campo"><label>Opções de pagamento</label><span>${esc(pagamento)}</span></div>
    </div>

    <h2 class="secao">Serviços e valores (estimativa)</h2>
    ${tabelaItens(o)}

    <div class="totais">
      <div><span>Valor combinado</span><strong>${esc(fmtMoeda(valor))}</strong></div>
      <div><span>À vista</span><strong>${esc(fmtMoeda(o.valorAVista ?? valor))}</strong></div>
      <div><span>A prazo${o.parcelasPagamento && o.parcelasPagamento >= 2 ? ` (${o.parcelasPagamento}x)` : ''}</span><strong>${esc(fmtMoeda(o.valorAPrazo ?? valor))}</strong></div>
    </div>

    <div class="bloco">
      <label>Relato do cliente / observações</label>
      <p>${esc(observacoes)}</p>
    </div>

    <div class="assinaturas">
      <div class="assina">
        <div class="linha"></div>
        <span>Cliente</span>
      </div>
    </div>
  `;

  const estiloExtra = `
    .itens { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 11px; }
    .itens th, .itens td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    .itens th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
    .itens .num { text-align: right; white-space: nowrap; }
    .secao { font-size: 12px; margin: 14px 0 6px; }
    .totais {
      display: flex; flex-direction: column; align-items: flex-end; margin: 8px 0 16px;
      font-size: 13px; gap: 6px;
    }
    .totais > div { display: flex; gap: 16px; align-items: baseline; }
    .totais span { color: #64748b; min-width: 140px; text-align: right; }
    .totais strong { font-size: 16px; }
    .bloco { margin: 12px 0; font-size: 11px; }
    .bloco label {
      display: block; font-size: 10px; font-weight: 700;
      text-transform: uppercase; color: #64748b; margin-bottom: 4px;
    }
    .bloco p { margin: 0; white-space: pre-wrap; }
    .assinaturas {
      display: flex; gap: 40px; margin-top: 36px;
    }
    .assina { flex: 1; text-align: center; font-size: 11px; }
    .assina .linha {
      border-top: 1px solid #0f172a; margin-bottom: 6px; height: 28px;
    }
    .doc-tipo { font-weight: 700; color: #b45309; }
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pré-orçamento #${esc(o.numero || o.id)}</title>
  <style>${estilosDocumentoImpressaoOs()}${estiloExtra}</style>
</head>
<body>${corpo}</body>
</html>`;
}
