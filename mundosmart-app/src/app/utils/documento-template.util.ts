import { DocumentoModelo, DocumentoVariavel } from '../services/documentos.service';
import { formatarCnpj, formatarCpfCnpj, formatarTelefone } from './contato-validacao';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function listarChavesNoCorpo(corpo: string): string[] {
  const chaves: string[] = [];
  const visto = new Set<string>();
  const texto = corpo ?? '';
  texto.replace(PLACEHOLDER_RE, (_m, chave: string) => {
    const k = chave.toLowerCase();
    if (!visto.has(k)) {
      visto.add(k);
      chaves.push(k);
    }
    return _m;
  });
  return chaves;
}

export function inserirPlaceholder(corpo: string, chave: string, cursor: number): { corpo: string; cursor: number } {
  const token = `{{${chave}}}`;
  const inicio = Math.max(0, cursor);
  const next = (corpo ?? '').slice(0, inicio) + token + (corpo ?? '').slice(inicio);
  return { corpo: next, cursor: inicio + token.length };
}

export function formatarValorDocumento(tipo: string, valor: string): string {
  const v = (valor ?? '').trim();
  if (!v) return '';
  switch (tipo) {
    case 'moeda': {
      const n = Number(v.replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(n)) return v;
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    case 'cpf':
      return formatarCpfCnpj(v);
    case 'cnpj':
      return formatarCnpj(v);
    case 'telefone':
      return formatarTelefone(v);
    case 'endereco':
      return v;
    case 'data':
    case 'data_hora':
      return formatarDataHoraDocumento(v);
    default:
      return v;
  }
}

export function preencherModelo(
  modelo: DocumentoModelo,
  valores: Record<string, string>,
): string {
  const defs = new Map((modelo.variaveis ?? []).map(v => [v.chave.toLowerCase(), v]));
  const html = pareceHtmlDocumento(modelo.corpo);
  return (modelo.corpo ?? '').replace(PLACEHOLDER_RE, (_m, chave: string) => {
    const k = chave.toLowerCase();
    const def = defs.get(k);
    const tipo = def?.tipo ?? 'texto';
    const preenchido = formatarValorDocumento(tipo, valores[k] ?? '');
    if (preenchido) return html ? escapeHtml(preenchido) : preenchido;
    if (def && !def.obrigatoria) return '';
    return '____________';
  });
}

export function pareceHtmlDocumento(texto: string | undefined | null): boolean {
  return /<(h1|h2|h3|p|div|br|ul|ol|li|strong|b|em|i|u|span|table)\b/i.test(texto ?? '');
}

export function corpoDocumentoParaHtml(texto: string | undefined | null): string {
  const t = texto ?? '';
  if (!t.trim()) return '';
  return pareceHtmlDocumento(t) ? t : documentoParaHtml(t);
}

export function corpoDocumentoVazio(corpo: string | undefined | null): boolean {
  return !(corpo ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function camposPendentes(
  modelo: DocumentoModelo,
  valores: Record<string, string>,
): DocumentoVariavel[] {
  return (modelo.variaveis ?? []).filter(v => {
    if (!v.obrigatoria || v.oculta || campoDocumentoOculto(v.chave)) return false;
    return !(valores[v.chave]?.trim());
  });
}

const CHAVES_OCULTAS = new Set([
  'compradora_razao_social',
  'compradora_cnpj',
  'compradora_endereco',
  'compradora_representante',
  'compradora_representante_cargo',
  'compradora_representante_cpf',
  'vendedor_nome',
  'vendedor_cnpj',
  'vendedor_ie',
  'vendedor_endereco',
  'vendedor_telefone',
  'vendedor_email',
  'cidade',
  'foro',
  'data',
]);

const CHAVES_ENDERECO_LOJA = new Set([
  'compradora_endereco',
  'vendedor_endereco',
]);

export function campoDocumentoOculto(chave: string): boolean {
  return CHAVES_OCULTAS.has((chave ?? '').toLowerCase());
}

/** Endereço da loja: texto fixo, sem componente de CEP. */
export function ehEnderecoLoja(chave: string): boolean {
  return CHAVES_ENDERECO_LOJA.has((chave ?? '').toLowerCase());
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function agoraLocalIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatarDataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  const nomeMes = MESES_PT[Number(mes) - 1];
  if (!ano || !nomeMes || !dia) return iso;
  return `${dia} de ${nomeMes} de ${ano}`;
}

export function formatarDataHoraDocumento(valor: string): string {
  const v = (valor ?? '').trim();
  if (!v) return '';
  const m = v.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return v;
  const data = formatarDataPorExtenso(m[1]);
  if (!m[2]) return data;
  return `${data}, ${m[2]}:${m[3]}`;
}

export function escapeHtml(texto: string): string {
  return (texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function documentoParaHtml(texto: string): string {
  const linhas = (texto ?? '').replace(/\r\n/g, '\n').trim().split('\n').map(l => l.trim());
  if (!linhas.length) return '';

  const titulo = linhas[0];
  const resto = linhas.slice(1).filter(Boolean);
  const iFecha = resto.findIndex(l => /por estarem de acordo|por estar ciente|ao assinar abaixo/i.test(l));
  const corpo = iFecha >= 0 ? resto.slice(0, iFecha) : resto;
  const fecha = iFecha >= 0 ? resto.slice(iFecha) : [];

  const html: string[] = [
    `<h1>${escapeHtml(titulo)}</h1>`,
    '<div class="titulo-linha"></div>',
  ];

  let partesAberta = false;
  const fecharPartes = () => {
    if (partesAberta) {
      html.push('</div>');
      partesAberta = false;
    }
  };

  for (const linha of corpo) {
    const ehParte = /^(EMPRESA|CLIENTE(?:\s*\/\s*COMPRADOR\(A\))?|COMPRADORA|COMPRADOR\(A\)|VENDEDORA|VENDEDOR(?:\(A\))?)\s*:/i.test(linha);
    if (ehParte) {
      if (!partesAberta) {
        html.push('<div class="partes">');
        partesAberta = true;
      }
      html.push(`<p class="parte">${escapeHtml(linha)}</p>`);
      continue;
    }
    fecharPartes();
    if (/^\d+\.\s+\S/.test(linha) && !/^\d+\.\d+/.test(linha)) {
      html.push(`<h2>${escapeHtml(linha)}</h2>`);
    } else if (/^\d+\.\d+/.test(linha)) {
      html.push(`<p class="sub">${escapeHtml(linha)}</p>`);
    } else if (/^[a-d]\)\s/i.test(linha)) {
      html.push(`<p class="alinea">${escapeHtml(linha)}</p>`);
    } else if (/^[-–•]\s/.test(linha)) {
      html.push(`<p class="item">${escapeHtml(linha.replace(/^[-–•]\s/, ''))}</p>`);
    } else {
      html.push(`<p>${escapeHtml(linha)}</p>`);
    }
  }
  fecharPartes();

  if (fecha.length) {
    html.push('<div class="rodape-doc">');
    html.push(`<p class="fecho">${escapeHtml(fecha[0])}</p>`);
    const data = fecha.find(l => l !== fecha[0] && !/^(VENDEDOR|COMPRADOR|Assinatura|CPF|CNPJ)/i.test(l));
    if (data) html.push(`<p class="data">${escapeHtml(data)}</p>`);

    const blocoParte = (rotuloRe: RegExp, rotuloPadrao: string) => {
      const i = fecha.findIndex(x => rotuloRe.test(x));
      if (i < 0) return '';
      const nome = fecha[i].replace(rotuloRe, '').trim();
      const doc = fecha.slice(i + 1, i + 4).find(l => /^(CPF\/CNPJ|CPF|CNPJ)\s*:/i.test(l)) ?? '';
      return `<div>
        <p class="ass-rotulo">${escapeHtml(rotuloPadrao)}</p>
        <p class="ass-nome">${escapeHtml(nome)}</p>
        <div class="ass-espaco"></div>
        <p class="ass-doc">${escapeHtml(doc)}</p>
      </div>`;
    };
    const vendedor = blocoParte(/^VENDEDOR(?:A|\(A\))?\s*:/i, 'Vendedor(a)');
    const comprador = blocoParte(/^COMPRADOR(?:A|\(A\))?\s*:/i, 'Comprador(a)');
    if (vendedor || comprador) {
      html.push(`<div class="assinaturas">${vendedor}${comprador}</div>`);
    }
    html.push('</div>');
  }

  return html.join('');
}

const CSS_DOCUMENTO = `
  @page { size: A4; margin: 0; }
  @page boleto {
    size: A4;
    margin: 11mm 12mm 18mm;
  }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 9.15pt;
    line-height: 1.14;
    color: #111;
  }
  .via {
    box-sizing: border-box;
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    padding: 12mm 14mm 12mm;
    page-break-after: always;
    break-after: page;
    background: #fff;
    overflow: hidden;
  }
  .via:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .doc { min-height: 0; }
  .rodape-doc {
    margin-top: 8px;
    padding-top: 4px;
  }
  @media screen {
    html, body { background: #d4d8de; }
    body { padding: 5mm; }
    .via {
      box-shadow: 0 1px 3px rgba(0,0,0,.2), 0 10px 28px rgba(15,23,42,.18);
      margin: 0 auto 5mm;
    }
    .via:last-child { margin-bottom: 0; }
  }
  @media print {
    html, body {
      background: #fff;
      width: 210mm;
      height: auto;
      padding: 0;
      margin: 0;
    }
    .via {
      box-shadow: none;
      margin: 0;
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      overflow: hidden;
    }
  }
  h1 {
    font-size: 12.8pt;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.03em;
    line-height: 1.14;
    margin: 0 0 3px;
    text-transform: uppercase;
  }
  .titulo-linha {
    border-bottom: 1.4pt solid #111;
    margin: 0 0 5px;
  }
  .partes {
    border: 0.7pt solid #111;
    padding: 5px 7px 4px;
    margin: 0 0 5px;
  }
  h2 {
    font-size: 9.2pt;
    font-weight: 700;
    letter-spacing: 0.03em;
    margin: 4px 0 1px;
    padding-bottom: 1px;
    border-bottom: 0.4pt solid #444;
    text-transform: uppercase;
  }
  p { margin: 0 0 1.6px; text-align: justify; }
  .parte { margin: 0 0 3px; text-align: justify; }
  .parte:last-child { margin-bottom: 0; }
  .sub { margin: 0 0 1.2px; }
  .alinea { margin: 0 0 1px 12px; text-align: justify; }
  .item {
    margin: 0 0 1px 14px;
    text-align: left;
    position: relative;
  }
  .item::before {
    content: "•";
    position: absolute;
    left: -12px;
  }
  .fecho { margin: 0 0 3px; }
  .data { text-align: center; margin: 3px 0 6px; font-weight: 700; }
  .assinaturas {
    display: table;
    width: 100%;
    table-layout: fixed;
    margin-top: 2px;
  }
  .assinaturas > div {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    padding: 0 10px;
    text-align: center;
  }
  .assinaturas > div:only-child { width: 100%; }
  .ass-rotulo {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 9pt;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }
  .ass-nome { min-height: 1.15em; font-size: 9.5pt; margin: 0; }
  .ass-espaco {
    height: 14mm;
    border-bottom: 0.75pt solid #111;
    margin: 4px 8px 3px;
  }
  .via-anexo .rodape-doc { margin-top: 10px; }
  .via-anexo .ass-espaco {
    height: 22mm;
    margin: 8px 8px 4px;
  }
  .ass-doc { margin: 0; font-size: 9pt; }
  ul, ol { margin: 2px 0 4px 18px; padding: 0; }
  li { margin: 0 0 1px; }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }

  /* Contrato boleto: texto do advogado intacto; só recuo, entrelinha e assinatura. */
  .via:has(.doc-denso) {
    height: auto;
    min-height: 297mm;
    max-height: 891mm;
    overflow: hidden;
    padding: 10mm 13mm 16mm;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  body:has(.doc-denso) {
    font-size: 8.15pt;
    line-height: 1.16;
    letter-spacing: 0.02em;
  }
  .doc-denso h1 {
    font-size: 10.6pt;
    letter-spacing: 0.04em;
    line-height: 1.18;
    margin: 0 0 4px;
  }
  .doc-denso .titulo-linha { margin: 0 0 6px; }
  .doc-denso h2 {
    font-size: 8.4pt;
    letter-spacing: 0.035em;
    margin: 6px 0 2.5px;
    padding-bottom: 1px;
    border-bottom: 0.4pt solid #444;
  }
  .doc-denso p {
    margin: 0 0 2.4px;
    letter-spacing: 0.02em;
  }
  .doc-denso .sub {
    margin: 0 0 3px;
    padding-left: 7mm;
    text-indent: -7mm;
    letter-spacing: 0.02em;
  }
  .doc-denso .quadro-resumo {
    border: 0.7pt solid #111;
    padding: 5px 7px 4px;
    margin: 0 0 6px;
  }
  .doc-denso .quadro-resumo p {
    margin: 0 0 2px;
    text-align: left;
    padding-left: 0;
    text-indent: 0;
    letter-spacing: 0.015em;
  }
  .doc-denso .quadro-resumo p:last-child { margin-bottom: 0; }
  .doc-denso .colunas {
    column-count: 1;
    column-gap: 0;
    column-rule: none;
  }
  .doc-denso .colunas h2 { break-after: avoid; break-inside: avoid; }
  .doc-denso .destaque {
    border: 0.7pt solid #111;
    padding: 4px 6px 3px;
    margin: 5px 0 4px;
  }
  .doc-denso .rodape-boleto {
    break-inside: avoid;
    break-before: auto;
    margin-top: 8mm;
    padding-top: 6px;
    padding-bottom: 4mm;
  }
  .doc-denso .fecho { margin: 0 0 6px; letter-spacing: 0.02em; }
  .doc-denso .data { margin: 6px 0 10px; font-size: 9pt; letter-spacing: 0.03em; }
  .assinaturas-4 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8mm 10mm;
    margin-top: 4px;
  }
  .assinaturas-4 > div {
    display: block;
    width: auto;
    padding: 0;
    text-align: center;
  }
  .via:has(.doc-denso) .ass-espaco {
    height: 20mm;
    border-bottom: 1pt solid #111;
    margin: 6px 6px 5px;
  }
  .via:has(.doc-denso) .ass-rotulo {
    font-size: 8.4pt;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }
  .via:has(.doc-denso) .ass-nome,
  .via:has(.doc-denso) .ass-doc { font-size: 8.3pt; letter-spacing: 0.015em; }
  .via:has(.doc-recibo) {
    font-size: 11pt;
    line-height: 1.32;
    letter-spacing: 0;
    padding: 16mm 18mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    overflow: hidden;
  }
  .doc-recibo h1 {
    font-size: 13.5pt;
    letter-spacing: 0.03em;
    margin: 0 0 6px;
  }
  .doc-recibo .titulo-linha { margin: 0 0 10px; }
  .doc-recibo p { margin: 0 0 8px; }
  .doc-recibo .quadro-resumo {
    border: 0.7pt solid #111;
    padding: 8px 10px 6px;
    margin: 0 0 12px;
  }
  .doc-recibo .quadro-resumo p { margin: 0 0 4px; text-align: left; }
  .doc-recibo .quadro-resumo p:last-child { margin-bottom: 0; }
  .via:has(.doc-recibo) .ass-espaco {
    height: 22mm;
    margin: 8px 8px 4px;
  }
  .via:has(.doc-recibo) .ass-rotulo { font-size: 10pt; }
  .via:has(.doc-recibo) .ass-doc { font-size: 10pt; }
  @media print {
    .via:has(.doc-denso) {
      page: boleto;
      height: auto;
      min-height: 273mm;
      max-height: 819mm;
      overflow: hidden;
      padding: 0 0 8mm;
    }
    .via:has(.doc-recibo) {
      height: 297mm;
      min-height: 297mm;
      max-height: 297mm;
      overflow: hidden;
    }
  }
`;

export function montarHtmlDocumento(
  titulo: string,
  textoPreenchido: string,
  duasVias = false,
  extras: string[] = [],
): string {
  const via = (html: string, classe = '') =>
    `<section class="via${classe ? ` ${classe}` : ''}"><div class="doc">${html}</div></section>`;
  const corpo = corpoDocumentoParaHtml(textoPreenchido);
  const paginas = [
    via(corpo),
    ...(duasVias ? [via(corpo)] : []),
    ...extras.map(texto => via(corpoDocumentoParaHtml(texto), 'via-anexo')),
  ].join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>${CSS_DOCUMENTO}</style>
</head>
<body>
  ${paginas}
</body>
</html>`;
}
