import { BlingOrdemServico } from '../models/bling.models';
import { ImpressaoOsTextos, getTextosImpressaoOs } from '../config/os-impressao-textos.config';
import { OsImpressaoTipoHtml } from '../config/os-impressao.config';
import { labelPagamentoAcordadoOs } from '../config/os-pagamento.config';
import { labelTipoServicoOs } from '../config/os-servico.config';
import { htmlSenhaDispositivoImpressao } from './senha-dispositivo-print.util';
import { htmlLogoCabecalhoImpressao } from './logo-impressao.util';
import { formatarDataBrasil, formatarDataHoraBrasil } from './horario-brasil.util';

const MAX_ITENS_TABELA_OS = 4;

export interface OsImpressaoContexto {
  enderecoCliente?: string;
  textos?: ImpressaoOsTextos;
}
function esc(valor?: string | number | null): string {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtData(valor?: string | null): string {
  return formatarDataHoraBrasil(valor);
}

function fmtDataCurta(valor?: string | null): string {
  return formatarDataBrasil(valor);
}

/** Instantâneo real (ex.: "emitido em") — converte UTC → Brasília. */
function fmtAgora(): string {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function fmtMoeda(valor?: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function telefoneContato(os: BlingOrdemServico): string {
  const c = os.contato;
  const numeros = [c?.celular, c?.telefone]
    .map(t => t?.trim())
    .filter((t): t is string => !!t);
  const unicos = [...new Set(numeros)];
  return unicos.length ? unicos.join(' / ') : '—';
}

/** Uma linha compacta: nome · tel · parentesco · retira · ligar. */
function contatoAlternativoCompacto(os: BlingOrdemServico): string | null {
  const a = os.contatoAviso;
  if (!a?.nome?.trim() && !a?.celular?.trim() && !a?.telefone?.trim()) return null;

  const tel = [a?.celular, a?.telefone]
    .map(t => t?.trim())
    .filter((t): t is string => !!t);
  const telUnico = [...new Set(tel)].join('/');

  const partes: string[] = [];
  if (a?.nome?.trim()) partes.push(a.nome.trim());
  if (telUnico) partes.push(telUnico);
  if (a?.parentesco?.trim()) partes.push(a.parentesco.trim());
  if (a && a.autorizadoRetirada !== false) partes.push('retira');
  partes.push(os.preferenciaContatoSelecionado ? 'só nele' : 'ligar tbm');
  return partes.join(' · ');
}

function htmlCampoContatoAlternativo(os: BlingOrdemServico): string {
  const linha = contatoAlternativoCompacto(os);
  if (!linha) return '';
  return `<div class="contato-alt-box">
    <label>Contato alternativo</label>
    <span>${esc(linha)}</span>
  </div>`;
}

function htmlLinhaClienteIdentidade(os: BlingOrdemServico): string {
  return `<div class="grid-cliente-id">
    <div class="campo"><label>Nome</label><span>${esc(os.contato?.nome || '—')}</span></div>
    <div class="campo"><label>CPF / CNPJ</label><span>${esc(os.cpfCnpj || '—')}</span></div>
    <div class="campo"><label>Telefone</label><span>${esc(telefoneContato(os))}</span></div>
  </div>`;
}

function htmlLinhaModeloImei(os: BlingOrdemServico): string {
  return `<div class="grid-modelo-imei">
    <div class="campo"><label>Modelo</label><span>${esc(modeloAparelho(os))}</span></div>
    <div class="campo"><label>IMEI</label><span>${esc(os.imei || '—')}</span></div>
  </div>`;
}

function htmlLinhaTelaAcessorios(os: BlingOrdemServico): string {
  return `<div class="grid-tela-acessorios">
    <div class="campo"><label>Estado da tela</label><span>${esc(os.estadoTela || '—')}</span></div>
    <div class="campo"><label>Acessórios</label><span>${esc(acessoriosEntregues(os))}</span></div>
  </div>`;
}

function modeloAparelho(os: BlingOrdemServico): string {
  if (os.equipamento?.trim()) return os.equipamento.trim();
  const partes = [os.marcaNome, os.modeloNome].filter(Boolean);
  return partes.length ? partes.join(' ') : '—';
}

function acessoriosEntregues(os: BlingOrdemServico): string {
  const lista = (os.acessorios ?? []).map(a => a?.trim()).filter(Boolean);
  return lista.length ? lista.join(', ') : '—';
}

function itensPreOrcamentoTabela(os: BlingOrdemServico, valorTotal?: number | null): string {
  const itens = os.itens ?? [];
  if (!itens.length) {
    return '<p class="muted compacto">Nenhum item informado.</p>';
  }

  const visiveis = itens.slice(0, MAX_ITENS_TABELA_OS);
  const extras = itens.length - visiveis.length;

  const linhas = visiveis.map(item => {
    const subtotal = (item.quantidade ?? 0) * (item.valorUnitario ?? 0);
    const desc = item.descricao || '—';
    const cor = item.cor?.trim();
    return `<tr>
      <td>${esc(desc)}</td>
      <td>${esc(cor || '—')}</td>
      <td class="num">${esc(item.quantidade)}</td>
      <td class="num">${esc(fmtMoeda(item.valorUnitario))}</td>
      <td class="num">${esc(fmtMoeda(subtotal))}</td>
    </tr>`;
  }).join('');

  const linhaExtras = extras > 0
    ? `<tr class="linha-extras"><td colspan="5">+ ${extras} item(ns) adicional(is) não exibido(s)</td></tr>`
    : '';

  const total = valorTotal ?? itens.reduce((s, i) => s + (i.quantidade ?? 0) * (i.valorUnitario ?? 0), 0);

  return `<table class="tabela tabela-compacta">
    <thead><tr><th>Serviço / peça</th><th>Cor</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>${linhas}${linhaExtras}</tbody>
    <tfoot><tr><td colspan="4">Total</td><td class="num">${esc(fmtMoeda(total))}</td></tr></tfoot>
  </table>`;
}

function blocoTermosHtml(texto: string): string {
  const paragrafos = texto.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (!paragrafos.length) return '';
  return `<div class="termos-colunas">${paragrafos.map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
}
function itensTabela(os: BlingOrdemServico): string {
  const itens = os.itens ?? [];
  if (!itens.length) {
    return '<p class="muted">Nenhum item cadastrado.</p>';
  }

  const linhas = itens.map(item => {
    const subtotal = (item.quantidade ?? 0) * (item.valorUnitario ?? 0);
    const cor = item.cor?.trim();
    return `<tr>
      <td>${esc(item.descricao || '—')}</td>
      <td>${esc(cor || '—')}</td>
      <td class="num">${esc(item.quantidade)}</td>
      <td class="num">${esc(fmtMoeda(item.valorUnitario))}</td>
      <td class="num">${esc(fmtMoeda(subtotal))}</td>
    </tr>`;
  }).join('');

  return `<table class="tabela">
    <thead><tr><th>Descrição</th><th>Cor</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

const TESTES_FUNCIONAIS_OS: string[] = [
  'Vazamento de luz',
  'Teste pressão',
  'Teste touch screen / ponto branco',
  'Teste sensor aproximação',
  'Teste autofalante superior / inferior',
  'Teste câmera frontal',
  'Vibracall',
  'Microfones',
  'Rede / Wi-Fi',
  'NFC',
  'Ligação',
  'Câmera traseira / flash',
  'Carregamento',
  'Carregamento indução (se tiver)',
  'Biometria (se tiver)',
  'Botões (funcionamento / peso)',
];

function blocoAssinaturaCliente(rotulo = 'Assinatura do cliente', textoConfirmacao?: string): string {
  const confirmacao = textoConfirmacao
    ? `<p class="assinatura-confirmacao">${esc(textoConfirmacao)}</p>`
    : '';
  return `<div class="assinatura-cliente">
      ${confirmacao}
      <div class="assinatura-espaco"></div>
      <div class="assinatura-rotulo">${esc(rotulo)}</div>
    </div>`;
}

function celulaCheck(): string {
  return '<td class="check-cell"><span class="check-box">☐</span></td>';
}

/** Checklist na mesma folha da OS: Entrada × Técnico × Cliente. */
function blocoChecklistTestesFuncionais(): string {
  const linhas = TESTES_FUNCIONAIS_OS.map(nome =>
    `<tr>
      <td class="teste-nome">${esc(nome)}</td>
      ${celulaCheck()}
      ${celulaCheck()}
      ${celulaCheck()}
    </tr>`).join('');

  return `<div class="secao secao-testes">
    <div class="secao-titulo">Testes funcionais</div>
    <p class="testes-legenda">Marque em cada fase: entrada na assistência, execução pelo técnico e conferência pelo cliente.</p>
    <table class="tabela tabela-testes">
      <thead>
        <tr>
          <th class="teste-nome">Teste</th>
          <th>Entrada</th>
          <th>Técnico</th>
          <th>Cliente</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>`;
}

function estilosImpressao(): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: Segoe UI, Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; line-height: 1.4; background: #fff; }
    h1 { font-size: 17px; margin: 0 0 2px; color: #0f172a; }
    h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; color: #1e293b; }
    .cabecalho {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0f172a;
    }
    .logo-impressao {
      display: flex;
      justify-content: center;
      align-items: center;
      line-height: 0;
      margin: 0 0 6px;
    }
    .logo-impressao img {
      height: 74.88px;
      width: auto;
      max-width: min(518px, 100%);
      object-fit: contain;
      object-position: center;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .cabecalho p { margin: 2px 0; color: #475569; font-size: 12px; }
    .cabecalho .doc-tipo { font-weight: 600; color: #334155; }
    .secao {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 12px; }
    .grid-cliente-id {
      display: grid;
      grid-template-columns: 60% 20% 20%;
      gap: 6px 8px;
      align-items: start;
    }
    .grid-cliente-id .campo { min-width: 0; }
    .grid-cliente-id .campo span { word-break: break-word; overflow-wrap: anywhere; }
    .grid-modelo-imei {
      display: grid;
      grid-template-columns: 60% 40%;
      gap: 6px 8px;
      align-items: start;
    }
    .grid-modelo-imei .campo { min-width: 0; }
    .grid-tela-acessorios {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 8px;
      align-items: start;
    }
    .contato-alt-box {
      margin-top: 8px;
      padding: 6px 8px;
      border: 1px dashed #64748b;
      border-radius: 4px;
      background: #f1f5f9;
    }
    .contato-alt-box label {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      color: #334155;
      letter-spacing: .35px;
      margin-bottom: 2px;
      font-weight: 700;
    }
    .contato-alt-box span {
      display: block;
      font-weight: 600;
      color: #0f172a;
      font-size: 11px;
      line-height: 1.35;
    }
    .campo label {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: .35px;
      margin-bottom: 1px;
    }
    .campo span { display: block; font-weight: 600; color: #0f172a; }
    .tabela { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    .tabela th, .tabela td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
    .tabela th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; color: #475569; }
    .tabela .num { text-align: right; white-space: nowrap; }
    .tabela tfoot td { font-weight: 700; background: #f8fafc; }
    .muted { color: #64748b; font-size: 10px; margin-top: 10px; }
    .destaque { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin: 10px 0; font-size: 11px; }
    .aviso-pre-orcamento {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 10px 12px;
      margin: 10px 0;
      font-size: 10px;
      line-height: 1.45;
      color: #78350f;
      page-break-inside: avoid;
    }
    .aviso-pre-orcamento strong.titulo { display: block; margin-bottom: 4px; font-size: 11px; color: #92400e; }
    .secao-titulo {
      font-size: 11px;
      font-weight: 700;
      margin: 0 0 8px;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: .4px;
    }
    .texto-longo { white-space: pre-wrap; line-height: 1.45; margin: 0; }
    .assinatura-cliente {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      margin-top: 28px;
      page-break-inside: avoid;
      flex: 1;
    }
    .assinaturas-duplas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 24px;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .assinaturas-duplas .assinatura-cliente { margin-top: 0; }
    .assinatura-confirmacao {
      font-size: 9px;
      color: #334155;
      line-height: 1.3;
      margin: 0 0 6px;
      text-align: left;
    }
    .assinatura-espaco {
      min-height: 72px;
      border-bottom: 1px solid #334155;
      margin-bottom: 6px;
    }
    .assinatura-rotulo {
      text-align: center;
      font-size: 10px;
      color: #475569;
    }
    .pagina-teste-separada {
      page-break-before: always;
      break-before: page;
    }
    .testes-legenda {
      font-size: 9px;
      color: #64748b;
      margin: 0 0 6px;
      line-height: 1.3;
    }
    .tabela-testes { font-size: 9.5px; margin-top: 0; }
    .tabela-testes th, .tabela-testes td { padding: 3px 5px; vertical-align: middle; }
    .tabela-testes th { text-align: center; }
    .tabela-testes th.teste-nome, .tabela-testes td.teste-nome { text-align: left; width: 52%; }
    .tabela-testes .check-cell { text-align: center; width: 16%; }
    .tabela-testes .check-box { font-size: 14px; line-height: 1; }
    .senha-impressao-desenho {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      margin-top: 1px;
    }
    .senha-impressao-rotulo {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: .3px;
    }
    .senha-impressao-svg {
      display: block;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #fff;
    }
    .senha-impressao-svg line {
      stroke: #1d4ed8;
      stroke-width: 3;
      stroke-linecap: round;
    }
    .senha-impressao-svg .senha-ponto-ativo {
      fill: #dbeafe;
      stroke: #2563eb;
      stroke-width: 2;
    }
    .senha-impressao-svg .senha-ponto-inativo {
      fill: #f8fafc;
      stroke: #94a3b8;
      stroke-width: 1.5;
      stroke-dasharray: 3 2;
    }
    .senha-impressao-svg .senha-ponto-num {
      font-size: 12px;
      font-weight: 700;
      fill: #1d4ed8;
      font-family: Segoe UI, Arial, sans-serif;
    }
    .checklist { list-style: none; padding: 0; margin: 0; }
    .checklist li { padding: 3px 0; }
    .termos { font-size: 10px; line-height: 1.45; color: #334155; }
    .total-box {
      margin-top: 8px;
      padding: 8px 10px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      text-align: right;
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    @media print {
      body { margin: 8mm; }
      @page { size: A4 portrait; margin: 8mm; }
      body.os-unica { margin: 0; }
    }
    body.os-unica {
      margin: 10px;
      font-size: 11px;
      line-height: 1.35;
    }
    body.os-unica h1 { font-size: 17px; }
    body.os-unica .cabecalho { margin-bottom: 4px; padding-bottom: 3px; }
    body.os-unica .logo-impressao { margin-bottom: 3px; }
    body.os-unica .logo-impressao img { height: 60.48px; max-width: min(432px, 100%); }
    body.os-unica .cabecalho p { font-size: 11px; }
    body.os-unica .secao { padding: 6px 8px; margin-bottom: 5px; border-radius: 4px; }
    body.os-unica .secao-titulo { font-size: 11px; margin-bottom: 4px; }
    body.os-unica .campo label { font-size: 9.5px; }
    body.os-unica .campo span { font-size: 11px; font-weight: 600; }
    body.os-unica .grid-compacto { gap: 4px 8px; }
    body.os-unica .grid-cliente-id { gap: 3px 6px; margin-bottom: 2px; }
    body.os-unica .grid-modelo-imei,
    body.os-unica .grid-tela-acessorios { gap: 3px 6px; margin-top: 4px; }
    body.os-unica .contato-alt-box {
      margin-top: 5px;
      padding: 4px 6px;
    }
    body.os-unica .contato-alt-box label { font-size: 8.5px; margin-bottom: 1px; }
    body.os-unica .contato-alt-box span { font-size: 10px; }
    body.os-unica .linhas-duplas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      align-items: start;
    }
    body.os-unica .tabela-compacta { font-size: 10px; margin-top: 3px; }
    body.os-unica .tabela-compacta th,
    body.os-unica .tabela-compacta td { padding: 3px 5px; }
    body.os-unica .tabela-compacta th { font-size: 9px; }
    body.os-unica .linha-extras td { font-style: italic; color: #64748b; }
    body.os-unica .aviso-pre-orcamento {
      padding: 6px 8px;
      margin: 5px 0;
      font-size: 9.5px;
      line-height: 1.3;
    }
    body.os-unica .aviso-pre-orcamento strong.titulo { font-size: 11px; margin-bottom: 2px; }
    body.os-unica .termos-colunas {
      column-count: 2;
      column-gap: 8px;
      font-size: 8.5px;
      line-height: 1.25;
      color: #334155;
      text-align: justify;
    }
    body.os-unica .termos-colunas p { margin: 0 0 3px; }
    body.os-unica .assinatura-cliente { margin-top: 8px; }
    body.os-unica .assinaturas-duplas { margin-top: 8px; gap: 10px 16px; }
    body.os-unica .assinatura-confirmacao { font-size: 8px; margin-bottom: 4px; }
    body.os-unica .assinatura-espaco { min-height: 40px; margin-bottom: 3px; }
    body.os-unica .assinatura-rotulo { font-size: 9px; }
    body.os-unica .senha-impressao-svg { width: 72px; height: auto; }
    body.os-unica .senha-impressao-rotulo { font-size: 8px; }
    body.os-unica .senha-impressao-svg .senha-ponto-num { font-size: 12px; }
    body.os-unica .rodape-os {
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      margin-top: 4px;
      margin-bottom: 2px;
      color: #0f172a;
    }
    body.os-unica .texto-longo { line-height: 1.25; max-height: 2.8em; overflow: hidden; }
    body.os-unica .secao-testes { padding: 4px 6px; margin-bottom: 4px; }
    body.os-unica .testes-legenda { font-size: 8px; margin-bottom: 3px; }
    body.os-unica .tabela-testes { font-size: 8px; }
    body.os-unica .tabela-testes th,
    body.os-unica .tabela-testes td { padding: 1.5px 3px; }
    body.os-unica .tabela-testes .check-box { font-size: 11px; }
    body.os-unica .pagina-teste-separada {
      page-break-before: always;
      break-before: page;
    }
  `;
}

function wrapDocumento(titulo: string, conteudo: string, classeBody = ''): string {
  const bodyClass = classeBody ? ` class="${classeBody}"` : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(titulo)}</title>
  <style>${estilosImpressao()}</style>
</head>
<body${bodyClass}>${conteudo}</body>
</html>`;
}
function cabecalhoLoja(subtitulo: string, docTipo?: string): string {
  const tipo = docTipo ? `<p class="doc-tipo">${esc(docTipo)}</p>` : '';
  return `<div class="cabecalho">
    ${htmlLogoCabecalhoImpressao()}
    <p>${esc(subtitulo)}</p>
    ${tipo}
  </div>`;
}

function camposOsBase(os: BlingOrdemServico): string {
  return `<div class="grid">
    <div class="campo"><label>OS</label><span>#${esc(os.numero || os.id)}</span></div>
    <div class="campo"><label>Situação</label><span>${esc(os.situacao || '—')}</span></div>
    <div style="grid-column: 1 / -1;">
      ${htmlLinhaClienteIdentidade(os)}
      ${htmlCampoContatoAlternativo(os)}
    </div>
    <div style="grid-column: 1 / -1;">${htmlLinhaModeloImei(os)}</div>
    <div class="campo"><label>Entrada</label><span>${esc(fmtData(os.dataEntrada || os.data))}</span></div>
  </div>`;
}

function templateComprovante(os: BlingOrdemServico): string {
  return `${cabecalhoLoja('Comprovante de recebimento do aparelho')}
    <div class="destaque">
      <p>Declaro que deixei o aparelho descrito abaixo para assistência técnica, ciente das condições registradas nesta ordem de serviço.</p>
    </div>
    <div class="secao">${camposOsBase(os)}</div>
    <div class="secao">
      <h2>Recebimento</h2>
      <div class="grid">
        <div class="campo"><label>Defeito informado</label><span>${esc(os.defeito || '—')}</span></div>
        ${os.temRisco ? `<div class="campo" style="grid-column: 1 / -1;"><label>Risco acordado</label><span>${esc(os.riscoAcordado || '—')}</span></div>` : ''}
        <div class="campo" style="grid-column: 1 / -1;"><label>Condições do aparelho</label><span>${esc(os.condicoesAparelho || '—')}</span></div>
        <div style="grid-column: 1 / -1;">${htmlLinhaTelaAcessorios(os)}</div>
        <div class="campo"><label>Tipo de serviço</label><span>${esc(labelTipoServicoOs(os.tipoServico) || '—')}</span></div>
        <div class="campo"><label>Previsão</label><span>${esc(fmtDataCurta(os.dataPrevistaTermino || os.dataPrevista))}</span></div>
        <div class="campo"><label>Pagamento</label><span>${esc(labelPagamentoAcordadoOs(os))}</span></div>
        <div class="campo campo-senha" style="grid-column: 1 / -1;"><label>Senha do aparelho</label>${htmlSenhaDispositivoImpressao(os)}</div>
      </div>
    </div>
    <p class="muted">Data de emissão: ${esc(fmtAgora())}</p>
    ${blocoAssinaturaCliente()}`;
}

function templateOs(os: BlingOrdemServico, ctx: OsImpressaoContexto = {}): string {
  const valor = os.valorAVista ?? os.valorTotalAcordado ?? os.valorTotal;
  const numeroOs = os.numero || os.id;
  const textos = ctx.textos ?? getTextosImpressaoOs();
  const endereco = ctx.enderecoCliente?.trim() || '—';

  return `<div class="os-pagina-unica">
    ${cabecalhoLoja(`Ordem de serviço #${numeroOs}`)}

    <div class="linhas-duplas">
      <div class="secao">
        <div class="secao-titulo">Cliente</div>
        ${htmlLinhaClienteIdentidade(os)}
        ${htmlCampoContatoAlternativo(os)}
        <div class="grid grid-compacto" style="margin-top: 6px;">
          <div class="campo" style="grid-column: 1 / -1;"><label>Endereço</label><span>${esc(endereco)}</span></div>
          <div class="campo"><label>Entrada</label><span>${esc(fmtData(os.dataEntrada || os.data))}</span></div>
        </div>
      </div>

      <div class="secao">
        <div class="secao-titulo">Aparelho</div>
        ${htmlLinhaModeloImei(os)}
        <div class="grid grid-compacto" style="margin-top: 4px;">
          <div class="campo campo-senha" style="grid-column: 1 / -1;"><label>Senha</label>${htmlSenhaDispositivoImpressao(os, true)}</div>
          <div class="campo" style="grid-column: 1 / -1;"><label>Condições</label><span class="texto-longo">${esc(os.condicoesAparelho || '—')}</span></div>
        </div>
        ${htmlLinhaTelaAcessorios(os)}
      </div>
    </div>

    <div class="secao">
      <div class="secao-titulo">Defeito relatado</div>
      <p class="texto-longo">${esc(os.defeito || '—')}</p>
      ${os.temRisco ? `<div class="secao-titulo" style="margin-top:6px;">Risco acordado (ciente o cliente)</div><p class="texto-longo">${esc(os.riscoAcordado || '—')}</p>` : ''}
    </div>

    <div class="secao">
      <div class="secao-titulo">Itens do serviço</div>
      ${itensPreOrcamentoTabela(os, valor)}
      <div class="grid grid-compacto" style="margin-top: 4px;">
        <div class="campo"><label>Tipo</label><span>${esc(labelTipoServicoOs(os.tipoServico) || '—')}</span></div>
        <div class="campo"><label>Previsão</label><span>${esc(fmtDataCurta(os.dataPrevistaTermino || os.dataPrevista))}</span></div>
        <div class="campo"><label>Pagamento</label><span>${esc(labelPagamentoAcordadoOs(os))}</span></div>
        <div class="campo"><label>Total</label><span>${esc(fmtMoeda(valor))}</span></div>
      </div>
    </div>

    <div class="aviso-pre-orcamento">
      <strong class="titulo">Pré-orçamento</strong>
      ${esc(textos.avisoPreOrcamento)}
    </div>

    ${blocoTermosHtml(textos.termosCondicoes)}

    <p class="rodape-os"><strong>Emitido em ${esc(fmtAgora())}</strong></p>
    ${blocoAssinaturaCliente('Assinatura do cliente', 'Declaro estar ciente das condições e do recebimento do aparelho nesta OS.')}
  </div>`;
}

function templateOsComTeste(os: BlingOrdemServico, ctx: OsImpressaoContexto = {}): string {
  const valor = os.valorAVista ?? os.valorTotalAcordado ?? os.valorTotal;
  const numeroOs = os.numero || os.id;
  const textos = ctx.textos ?? getTextosImpressaoOs();
  const endereco = ctx.enderecoCliente?.trim() || '—';

  return `<div class="os-pagina-unica">
    ${cabecalhoLoja(`Ordem de serviço #${numeroOs}`)}

    <div class="linhas-duplas">
      <div class="secao">
        <div class="secao-titulo">Cliente</div>
        ${htmlLinhaClienteIdentidade(os)}
        ${htmlCampoContatoAlternativo(os)}
        <div class="grid grid-compacto" style="margin-top: 6px;">
          <div class="campo" style="grid-column: 1 / -1;"><label>Endereço</label><span>${esc(endereco)}</span></div>
          <div class="campo"><label>Entrada</label><span>${esc(fmtData(os.dataEntrada || os.data))}</span></div>
        </div>
      </div>

      <div class="secao">
        <div class="secao-titulo">Aparelho</div>
        ${htmlLinhaModeloImei(os)}
        <div class="grid grid-compacto" style="margin-top: 4px;">
          <div class="campo campo-senha" style="grid-column: 1 / -1;"><label>Senha</label>${htmlSenhaDispositivoImpressao(os, true)}</div>
          <div class="campo" style="grid-column: 1 / -1;"><label>Condições</label><span class="texto-longo">${esc(os.condicoesAparelho || '—')}</span></div>
        </div>
        ${htmlLinhaTelaAcessorios(os)}
      </div>
    </div>

    <div class="secao">
      <div class="secao-titulo">Defeito relatado</div>
      <p class="texto-longo">${esc(os.defeito || '—')}</p>
      ${os.temRisco ? `<div class="secao-titulo" style="margin-top:6px;">Risco acordado (ciente o cliente)</div><p class="texto-longo">${esc(os.riscoAcordado || '—')}</p>` : ''}
    </div>

    <div class="secao">
      <div class="secao-titulo">Itens do serviço</div>
      ${itensPreOrcamentoTabela(os, valor)}
      <div class="grid grid-compacto" style="margin-top: 4px;">
        <div class="campo"><label>Tipo</label><span>${esc(labelTipoServicoOs(os.tipoServico) || '—')}</span></div>
        <div class="campo"><label>Previsão</label><span>${esc(fmtDataCurta(os.dataPrevistaTermino || os.dataPrevista))}</span></div>
        <div class="campo"><label>Pagamento</label><span>${esc(labelPagamentoAcordadoOs(os))}</span></div>
        <div class="campo"><label>Total</label><span>${esc(fmtMoeda(valor))}</span></div>
      </div>
    </div>

    <div class="aviso-pre-orcamento">
      <strong class="titulo">Pré-orçamento</strong>
      ${esc(textos.avisoPreOrcamento)}
    </div>

    ${blocoTermosHtml(textos.termosCondicoes)}

    <p class="rodape-os"><strong>Emitido em ${esc(fmtAgora())}</strong></p>
    ${blocoAssinaturaCliente('1ª assinatura — Ordem de serviço', 'Declaro estar ciente das condições e do recebimento do aparelho nesta OS.')}
  </div>

  <div class="pagina-teste-separada">
    ${cabecalhoLoja(`Folha de teste — OS #${numeroOs}`)}
    <div class="secao">
      <div class="secao-titulo">Dados básicos</div>
      ${htmlLinhaClienteIdentidade(os)}
      ${htmlCampoContatoAlternativo(os)}
      <div class="grid" style="margin-top: 6px;">
        <div class="campo" style="grid-column: 1 / -1;"><label>Aparelho</label><span>${esc(modeloAparelho(os))}</span></div>
      </div>
    </div>
    ${blocoChecklistTestesFuncionais()}
    ${blocoAssinaturaCliente('2ª assinatura — Testes funcionais', 'Declaro que os testes acima estão perfeitos e o aparelho está funcional.')}
  </div>`;
}

function templateTeste(os: BlingOrdemServico): string {
  const numeroOs = os.numero || os.id;
  return `<div class="folha-teste">
    ${cabecalhoLoja(`Folha de teste — OS #${numeroOs}`)}
    <div class="secao">
      <div class="secao-titulo">Dados básicos</div>
      ${htmlLinhaClienteIdentidade(os)}
      ${htmlCampoContatoAlternativo(os)}
      <div class="grid" style="margin-top: 6px;">
        <div class="campo" style="grid-column: 1 / -1;"><label>Aparelho</label><span>${esc(modeloAparelho(os))}</span></div>
      </div>
    </div>
    ${blocoChecklistTestesFuncionais()}
    ${blocoAssinaturaCliente('Assinatura do cliente', 'Declaro que os testes acima estão perfeitos e o aparelho está funcional.')}
  </div>`;
}

function templateGarantia(os: BlingOrdemServico): string {
  const conclusao = os.dataConclusao || os.dataSaida;
  return `${cabecalhoLoja('Termo de garantia do serviço')}
    <div class="secao">${camposOsBase(os)}</div>
    <div class="secao">
      <h2>Serviço executado</h2>
      <div class="grid">
        <div class="campo"><label>Defeito</label><span>${esc(os.defeito || '—')}</span></div>
        ${os.temRisco ? `<div class="campo" style="grid-column: 1 / -1;"><label>Risco acordado</label><span>${esc(os.riscoAcordado || '—')}</span></div>` : ''}
        <div class="campo"><label>Peça / serviço</label><span>${esc(os.tipoPecaProblemaNome || labelTipoServicoOs(os.tipoServico) || '—')}</span></div>
        <div class="campo"><label>Conclusão</label><span>${esc(fmtDataCurta(conclusao))}</span></div>
        <div class="campo"><label>Pagamento</label><span>${esc(labelPagamentoAcordadoOs(os))}</span></div>
        <div class="campo"><label>Valor</label><span>${esc(fmtMoeda(os.valorAVista ?? os.valorTotalAcordado ?? os.valorTotal))}</span></div>
      </div>
    </div>
    <div class="secao">
      <h2>Condições</h2>
      <div class="termos">
        <p>A garantia cobre o serviço executado e as peças substituídas nesta ordem de serviço, pelo prazo legal ou acordado com o cliente.</p>
        <p>Não cobre danos por mau uso, queda, contato com líquidos, oxidação, manipulação por terceiros ou defeitos não relacionados ao reparo realizado.</p>
        <p>Para acionar a garantia, apresente este documento e a ordem de serviço #${esc(os.numero || os.id)}.</p>
      </div>
    </div>
    <p class="muted">Emitido em ${esc(fmtAgora())}</p>
    ${blocoAssinaturaCliente()}`;
}

export function estilosDocumentoImpressaoOs(): string {
  return estilosImpressao();
}

export function montarCorpoImpressaoOs(
  tipo: OsImpressaoTipoHtml,
  os: BlingOrdemServico,
  ctx: OsImpressaoContexto = {},
): string {
  switch (tipo) {
    case 'comprovante': return templateComprovante(os);
    case 'os': return templateOs(os, ctx);
    case 'os-com-teste': return templateOsComTeste(os, ctx);
    case 'teste': return templateTeste(os);
    case 'garantia': return templateGarantia(os);
  }
}

export function montarHtmlImpressaoOs(
  tipo: OsImpressaoTipoHtml,
  os: BlingOrdemServico,
  ctx: OsImpressaoContexto = {},
): string {
  const titulos: Record<OsImpressaoTipoHtml, string> = {
    comprovante: `Comprovante #${os.numero || os.id}`,
    os: `Ordem de serviço #${os.numero || os.id}`,
    'os-com-teste': `Ordem de serviço com teste #${os.numero || os.id}`,
    teste: `Folha de teste #${os.numero || os.id}`,
    garantia: `Garantia #${os.numero || os.id}`,
  };
  const classeBody = tipo === 'os' || tipo === 'os-com-teste' || tipo === 'teste'
    ? 'os-unica'
    : '';
  return wrapDocumento(titulos[tipo], montarCorpoImpressaoOs(tipo, os, ctx), classeBody);
}