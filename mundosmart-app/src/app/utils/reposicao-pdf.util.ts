import { ReposicaoSemanalItem, ReposicaoSemanalResponse } from '../models/estoque.models';

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

/** PDF: somente peças utilizadas no período (peça, marca, modelo, cor, qtd). */
export function montarHtmlReposicaoPdf(
  relatorio: ReposicaoSemanalResponse,
  opts: ReposicaoPdfOpcoes,
): string {
  const labelModelo = opts.labelModelo
    ?? ((nome?: string, id?: string) => nome || id || '—');

  const itens = pecasUtilizadas(relatorio);
  const totalUnidades = itens.reduce((s, i) => s + i.quantidadeSaida, 0);

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
        </tr>
      </thead>
      <tbody>
        ${itens.map(r => `
          <tr>
            <td>${esc(r.pecaNome)}</td>
            <td>${esc(r.marcaPeca || '—')}</td>
            <td>${esc(labelModelo(r.modeloNome, r.modeloId))}</td>
            <td>${esc(r.cor?.trim() ? r.cor : '—')}</td>
            <td class="num">${esc(r.quantidadeSaida)}</td>
          </tr>`).join('')}
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
    window.alert('Permita pop-ups do navegador para exportar o PDF.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.document.title = titulo;
}
