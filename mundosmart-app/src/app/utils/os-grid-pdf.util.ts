import { avisarErroUsuario } from '../services/user-feedback.service';

function esc(valor?: string | number | null): string {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface OsGridPdfLinha {
  urgencia: string;
  numero: string;
  cliente: string;
  retirar: string;
  modelo: string;
  servico: string;
  imei: string;
  situacao: string;
  tecnico: string;
  retorno: string;
  loja: string;
  entrada: string;
  valor: string;
}

export interface OsGridPdfOpcoes {
  resumo: string;
  totalValor: string;
}

/** Lista filtrada de OS, em paisagem, para imprimir ou salvar como PDF. */
export function montarHtmlOsGridPdf(linhas: OsGridPdfLinha[], opts: OsGridPdfOpcoes): string {
  const geradoEm = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const corpo = linhas.length
    ? `
    <table>
      <thead>
        <tr>
          <th>Urgência</th>
          <th>Nº</th>
          <th>Cliente</th>
          <th>Retirar</th>
          <th>Modelo</th>
          <th>Serviço</th>
          <th>IMEI</th>
          <th>Situação</th>
          <th>Técnico</th>
          <th>Ret.</th>
          <th>Loja</th>
          <th>Entrada</th>
          <th class="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${linhas.map(r => `
          <tr>
            <td>${esc(r.urgencia)}</td>
            <td>${esc(r.numero)}</td>
            <td>${esc(r.cliente)}</td>
            <td>${esc(r.retirar)}</td>
            <td>${esc(r.modelo)}</td>
            <td>${esc(r.servico)}</td>
            <td>${esc(r.imei)}</td>
            <td>${esc(r.situacao)}</td>
            <td>${esc(r.tecnico)}</td>
            <td>${esc(r.retorno)}</td>
            <td>${esc(r.loja)}</td>
            <td>${esc(r.entrada)}</td>
            <td class="num">${esc(r.valor)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="12">Total à vista (${esc(linhas.length)})</td>
          <td class="num">${esc(opts.totalValor)}</td>
        </tr>
      </tfoot>
    </table>`
    : '<p class="vazio">Nenhuma ordem de serviço para exportar.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ordens de serviço — MundoSmart</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      margin: 16px;
      font-size: 10px;
      line-height: 1.3;
    }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #475569; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px 5px;
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
  <h1>Ordens de serviço</h1>
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

export function abrirJanelaOsGridPdf(html: string): void {
  const janela = window.open('about:blank', '_blank', 'width=1100,height=760');
  if (!janela) {
    avisarErroUsuario('Permita pop-ups do navegador para exportar o PDF.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.document.title = 'Ordens de serviço — MundoSmart';
}
