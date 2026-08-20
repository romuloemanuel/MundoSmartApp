import {
  DevolucaoGarantiaDocumento,
  LoteDevolucaoGarantiaDocumento,
} from '../models/estoque.models';
import { avisarErroUsuario } from '../services/user-feedback.service';

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

function fmtMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** PDF/documento de retorno de garantia ao fornecedor. */
export function montarHtmlDevolucaoGarantia(doc: DevolucaoGarantiaDocumento): string {
  const geradoEm = new Date(doc.geradoEm).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Retorno garantia — ${esc(doc.fornecedor)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #475569; margin: 0 0 18px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #f1f5f9; width: 34%; font-weight: 600; }
    .rodape { margin-top: 20px; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>Retorno de garantia ao fornecedor</h1>
  <p class="meta">Documento gerado em ${esc(geradoEm)}</p>
  <table>
    <tr><th>Fornecedor</th><td>${esc(doc.fornecedor)}</td></tr>
    <tr><th>Pedido de compra</th><td>${esc(doc.numeroPedido)}</td></tr>
    <tr><th>Peça</th><td>${esc(doc.pecaNome)}</td></tr>
    <tr><th>Marca</th><td>${esc(doc.marcaPeca || '—')}</td></tr>
    <tr><th>Modelo</th><td>${esc(doc.modeloNome || '—')}</td></tr>
    <tr><th>Cor</th><td>${esc(doc.cor || '—')}</td></tr>
    <tr><th>Quantidade</th><td>${esc(doc.quantidade)}</td></tr>
    <tr><th>Custo unitário</th><td>${esc(fmtMoeda(doc.custoUnitario))}</td></tr>
    <tr><th>Entrada no estoque</th><td>${esc(fmtData(doc.dataEntrada))}</td></tr>
    <tr><th>Garantia até</th><td>${esc(fmtData(doc.dataVencimentoGarantia))}</td></tr>
    <tr><th>Motivo</th><td>${esc(doc.motivo || '—')}</td></tr>
    <tr><th>Observação</th><td>${esc(doc.observacao || '—')}</td></tr>
  </table>
  <p class="rodape">MundoSmart · retorno de garantia · ref. ${esc(doc.movimentacaoId || doc.id)}</p>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    };
  </script>
</body>
</html>`;
}

export function abrirJanelaDevolucaoGarantia(html: string): void {
  const janela = window.open('about:blank', '_blank', 'width=800,height=700');
  if (!janela) {
    avisarErroUsuario('Permita pop-ups do navegador para gerar o documento.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.document.title = 'Retorno garantia — MundoSmart';
}

/** PDF consolidado do lote periódico por fornecedor. */
export function montarHtmlLoteDevolucaoGarantia(doc: LoteDevolucaoGarantiaDocumento): string {
  const geradoEm = new Date(doc.geradoEm).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const linhas = (doc.itens ?? []).map(i => `
    <tr>
      <td>${esc(i.osNumero ? '#' + i.osNumero : '—')}</td>
      <td>${esc(i.numeroPedido)}</td>
      <td>${esc(i.pecaNome)}</td>
      <td>${esc(i.modeloNome || '—')}</td>
      <td>${esc(i.cor || '—')}</td>
      <td>${esc(i.quantidade)}</td>
      <td>${esc(fmtData(i.dataVencimentoGarantia))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Lote retorno garantia — ${esc(doc.fornecedor)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #475569; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .resumo { margin: 0 0 12px; }
    .rodape { margin-top: 20px; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>Lote de retorno de garantia ao fornecedor</h1>
  <p class="meta">Gerado em ${esc(geradoEm)}</p>
  <p class="resumo"><strong>Fornecedor:</strong> ${esc(doc.fornecedor)} &nbsp;|&nbsp;
    <strong>Total de unidades:</strong> ${esc(doc.totalUnidades)} &nbsp;|&nbsp;
    <strong>Garantia mais próxima:</strong> ${esc(fmtData(doc.dataVencimentoMaisProxima))} &nbsp;|&nbsp;
    <strong>Prazo máx. envio:</strong> ${esc(fmtData(doc.dataPrazoMaximoEnvio))} &nbsp;|&nbsp;
    <strong>Motivo:</strong> ${esc(doc.motivo || '—')}</p>
  <table>
    <thead>
      <tr>
        <th>OS</th>
        <th>Pedido</th>
        <th>Peça</th>
        <th>Modelo</th>
        <th>Cor</th>
        <th>Qtd</th>
        <th>Garantia até</th>
      </tr>
    </thead>
    <tbody>${linhas || '<tr><td colspan="7">Sem itens</td></tr>'}</tbody>
  </table>
  <p class="rodape">MundoSmart · lote retorno garantia · ref. ${esc(doc.id)}</p>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    };
  </script>
</body>
</html>`;
}

export function abrirJanelaLoteDevolucaoGarantia(html: string): void {
  abrirJanelaDevolucaoGarantia(html);
}
