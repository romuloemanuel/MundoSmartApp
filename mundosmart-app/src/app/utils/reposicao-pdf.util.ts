import { ReposicaoSemanalItem, ReposicaoSemanalResponse } from '../models/estoque.models';
import { avisarErroUsuario } from '../services/user-feedback.service';
import {
  calcularNivelEstoque,
  getEstoqueConfig,
  labelNivelEstoque,
  normalizarNivelApi,
} from '../config/estoque.config';

function esc(valor?: string | number | null): string {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtData(valor?: string | null): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export interface ReposicaoPdfOpcoes {
  periodoLabel: string;
  labelModelo?: (modeloNome?: string, modeloId?: string) => string;
  /** Se false, só abre a janela (consulta histórico) sem disparar impressão. */
  autoPrint?: boolean;
  rodapeExtra?: string;
}

/** Só peças utilizadas no período (com saída > 0). */
function pecasUtilizadas(relatorio: ReposicaoSemanalResponse): ReposicaoSemanalItem[] {
  return [...(relatorio.itens ?? [])]
    .filter(i => (i.quantidadeSaida ?? 0) > 0)
    .sort((a, b) =>
      (a.pecaNome || '').localeCompare(b.pecaNome || '', 'pt-BR')
      || (a.modeloNome || '').localeCompare(b.modeloNome || '', 'pt-BR')
      || (a.cor || '').localeCompare(b.cor || '', 'pt-BR'));
}

function nivelReposicao(item: ReposicaoSemanalItem) {
  return normalizarNivelApi(item.nivelEstoque) ?? calcularNivelEstoque(item.estoqueAtual ?? 0);
}

function estiloNivelPdf(nivel: string): string {
  switch (nivel) {
    case 'verde':
      return 'background:#dcfce7;color:#15803d;border:1px solid #86efac;';
    case 'amarelo':
      return 'background:#fef9c3;color:#a16207;border:1px solid #fde047;';
    case 'laranja':
      return 'background:#ffedd5;color:#c2410c;border:1px solid #fdba74;';
    default:
      return 'background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;';
  }
}

/** PDF: peças utilizadas no período com saldo e sugestão de pedido. */
export function montarHtmlReposicaoPdf(
  relatorio: ReposicaoSemanalResponse,
  opts: ReposicaoPdfOpcoes,
): string {
  const labelModelo = opts.labelModelo
    ?? ((nome?: string, id?: string) => nome || id || '—');

  const itens = pecasUtilizadas(relatorio);
  const totalUnidades = itens.reduce((s, i) => s + i.quantidadeSaida, 0);
  const limiteAmarelo = getEstoqueConfig().limiteAmarelo;

  const geradoEm = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const corpo = itens.length
    ? `
    <table>
      <thead>
        <tr>
          <th>Peça</th>
          <th>Marca</th>
          <th>Modelo</th>
          <th>Cor</th>
          <th class="num">Qtd utilizada</th>
          <th class="num">Disponível</th>
          <th class="num">Sugerido pedir</th>
        </tr>
      </thead>
      <tbody>
        ${itens.map(r => {
          const nivel = nivelReposicao(r);
          return `
          <tr>
            <td>${esc(r.pecaNome)}</td>
            <td>${esc(r.marcaPeca || '—')}</td>
            <td>${esc(labelModelo(r.modeloNome, r.modeloId))}</td>
            <td>${esc(r.cor?.trim() ? r.cor : '—')}</td>
            <td class="num">${esc(r.quantidadeSaida)}</td>
            <td class="num">
              <span class="nivel" style="${estiloNivelPdf(nivel)}" title="${esc(labelNivelEstoque(nivel))}">
                ${esc(r.estoqueAtual ?? 0)}
              </span>
            </td>
            <td class="num">${esc(r.sugestaoReposicao ?? 0)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`
    : '<p class="vazio">Nenhuma peça utilizada no período.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Peças utilizadas — MundoSmart</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      margin: 24px;
      font-size: 12px;
      line-height: 1.35;
    }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #475569; margin: 0 0 16px; }
    .meta strong { color: #0f172a; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f1f5f9; font-weight: 600; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .nivel {
      display: inline-block;
      min-width: 1.75rem;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      text-align: center;
    }
    .vazio { color: #64748b; }
    .rodape {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 10px;
    }
    @media print {
      body { margin: 12mm; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Peças utilizadas no período</h1>
  <p class="meta">
    <strong>${esc(opts.periodoLabel)}</strong> —
    ${esc(fmtData(relatorio.inicio))} a ${esc(fmtData(relatorio.fim))} —
    ${esc(totalUnidades)} unidade(s)
    ${relatorio.modeloNomeFiltro
      ? ` — filtro: <strong>${esc(relatorio.modeloNomeFiltro)}</strong>`
      : ''}
    <br/>Sugerido pedir: maior entre (utilizada − disponível) e falta para ${esc(limiteAmarelo)} un. (estoque normal).
  </p>
  ${corpo}
  <p class="rodape">
    MundoSmart · gerado em ${esc(geradoEm)}
    ${opts.rodapeExtra ? `<br/>${esc(opts.rodapeExtra)}` : ''}
  </p>
  ${opts.autoPrint === false ? '' : `
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    };
  </script>`}
</body>
</html>`;
}

export function abrirJanelaReposicaoPdf(html: string, titulo = 'Peças utilizadas — MundoSmart'): void {
  const janela = window.open('about:blank', '_blank', 'width=900,height=720');
  if (!janela) {
    avisarErroUsuario('Permita pop-ups do navegador para exportar o PDF.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.document.title = titulo;
}
