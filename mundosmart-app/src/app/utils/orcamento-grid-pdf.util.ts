import { avisarErroUsuario } from '../services/user-feedback.service';

function esc(valor?: string | number | null): string {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface OrcamentoGridPdfLinha {
  numero: string;
  loja: string;
  cliente: string;
  responsavel: string;
  aparelho: string;
  situacao: string;
  revisitar: string;
  contatos: string;
  aVista: string;
  parcelado: string;
}

export interface OrcamentoGridPdfOpcoes {
  resumo: string;
  totalAVista: string;
}

/** Lista filtrada de orçamentos, em paisagem, para imprimir ou salvar como PDF. */
export function montarHtmlOrcamentoGridPdf(
  linhas: OrcamentoGridPdfLinha[],
  opts: OrcamentoGridPdfOpcoes,
): string {
  const geradoEm = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const corpo = linhas.length
    ? `
    <table>
      <thead>
        <tr>
          <th>Nº</th>
          <th>Loja</th>
          <th>Cliente</th>
          <th>Responsável</th>
          <th>Aparelho</th>
          <th>Situação</th>
          <th>Revisitar</th>
          <th class="num">Contatos</th>
          <th class="num">À vista</th>
          <th class="num">Parcelado</th>
        </tr>
      </thead>
      <tbody>
        ${linhas.map(r => `
          <tr>
            <td>${esc(r.numero)}</td>
            <td>${esc(r.loja)}</td>
            <td>${esc(r.cliente)}</td>
            <td>${esc(r.responsavel)}</td>
            <td>${esc(r.aparelho)}</td>
            <td>${esc(r.situacao)}</td>
            <td>${esc(r.revisitar)}</td>
            <td class="num">${esc(r.contatos)}</td>
            <td class="num">${esc(r.aVista)}</td>
            <td class="num">${esc(r.parcelado)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="8">Total à vista (${esc(linhas.length)})</td>
          <td class="num">${esc(opts.totalAVista)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`
    : '<p class="vazio">Nenhum orçamento para exportar.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Orçamentos — MundoSmart</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      margin: 16px;
      font-size: 11px;
      line-height: 1.3;
    }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #475569; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f1f5f9; font-weight: 600; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: 700; background: #f8fafc; }
    .vazio { color: #64748b; }
    .rodape {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 10px;
    }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      body { margin: 0; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Orçamentos</h1>
  <p class="meta">${esc(opts.resumo)}</p>
  ${corpo}
  <p class="rodape">MundoSmart · gerado em ${esc(geradoEm)}</p>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    };
  </script>
</body>
</html>`;
}

export function abrirJanelaOrcamentoGridPdf(html: string): void {
  const janela = window.open('about:blank', '_blank', 'width=1100,height=760');
  if (!janela) {
    avisarErroUsuario('Permita pop-ups do navegador para exportar o PDF.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.document.title = 'Orçamentos — MundoSmart';
}
