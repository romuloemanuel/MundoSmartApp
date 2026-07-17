import { BlingOrdemServico } from '../models/bling.models';
import { ImpressaoEmpresaConfig } from '../config/os-impressao-textos.config';
import { OsImpressaoTipoTermico } from '../config/os-impressao.config';
import { labelTipoServicoOs } from '../config/os-servico.config';
import { equipamentoGridLabel } from './os-grid-display.util';
import {
  EscPosEncoder,
  centralizarTexto,
  linhaRotuloQuebra,
  linhaRotuloValor,
  linhaSeparadora,
  quebrarLinhas,
} from './escpos.encoder';

export interface OsImpressaoTermicaContexto {
  empresa: ImpressaoEmpresaConfig;
  larguraLinha?: number;
}

function fmtData(valor?: string | null): string {
  if (!valor) return '-';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function fmtDataHora(valor?: string | null): string {
  if (!valor) return '-';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function numeroOs(os: BlingOrdemServico): string {
  return String(os.numero || os.id || '-');
}

function telefoneContato(os: BlingOrdemServico): string {
  const c = os.contato;
  return c?.celular?.trim() || c?.telefone?.trim() || '-';
}

function contatoAvisoLinha(os: BlingOrdemServico): string {
  const a = os.contatoAviso;
  if (!a?.nome?.trim()) return '-';
  const tel = a.celular?.trim() || a.telefone?.trim();
  const partes = [a.nome.trim(), tel, a.parentesco?.trim()].filter(Boolean);
  if (a.autorizadoRetirada !== false) partes.push('autorizado a retirar');
  return partes.join(' / ') || '-';
}

function servicoRealizado(os: BlingOrdemServico): string {
  const itens = (os.itens ?? [])
    .map(i => {
      const desc = i.descricao?.trim();
      if (!desc) return '';
      const cor = i.cor?.trim();
      if (cor && !desc.toLowerCase().includes(`(${cor.toLowerCase()})`)) {
        return `${desc} (${cor})`;
      }
      return desc;
    })
    .filter(Boolean);
  if (itens.length) return itens.join(', ');
  if (os.tipoPecaProblemaNome?.trim()) return os.tipoPecaProblemaNome.trim();
  const tipo = labelTipoServicoOs(os.tipoServico);
  if (tipo && tipo !== '—') return tipo;
  return os.defeito?.trim() || '-';
}

function diasGarantiaOs(os: BlingOrdemServico, empresa: ImpressaoEmpresaConfig): number {
  return os.garantiaDias && os.garantiaDias > 0 ? os.garantiaDias : empresa.diasGarantiaPadrao;
}

function dataValidadeGarantia(os: BlingOrdemServico, empresa: ImpressaoEmpresaConfig): string {
  const base = os.dataSaida || os.dataConclusao;
  if (!base) return '-';
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return '-';
  d.setDate(d.getDate() + diasGarantiaOs(os, empresa));
  return d.toLocaleDateString('pt-BR');
}

function escHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function estilosCupomTermicoHtml(): string {
  return `
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 3mm 2mm;
      font-family: Arial, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.4;
      color: #000;
      width: 76mm;
    }
    .cupom { width: 100%; }
    .empresa-nome { font-size: 18px; font-weight: 700; text-align: center; margin: 0 0 2px; }
    .empresa-info { font-size: 14px; text-align: center; margin: 0 0 1px; }
    .separador { border: none; border-top: 1px dashed #333; margin: 6px 0; }
    .titulo-doc {
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      margin: 4px 0 6px;
    }
    .os-numero {
      font-size: 34px;
      font-weight: 800;
      text-align: center;
      letter-spacing: 0.5px;
      margin: 2px 0 8px;
      line-height: 1.1;
    }
    .destaque { font-size: 17px; font-weight: 700; margin: 2px 0; }
    .linha { font-size: 16px; margin: 2px 0; word-break: break-word; }
    .linha-rotulo { font-weight: 700; }
    .texto-garantia { font-size: 14px; line-height: 1.35; margin-top: 4px; }
    .rodape { font-size: 14px; text-align: center; margin-top: 8px; color: #333; }
  `;
}

function blocoEmpresaHtml(empresa: ImpressaoEmpresaConfig): string {
  const partes = [
    `<p class="empresa-nome">${escHtml(empresa.nomeEmpresa || 'Assistência Técnica')}</p>`,
  ];
  for (const linha of quebrarLinhas(empresa.enderecoEmpresa, 40)) {
    partes.push(`<p class="empresa-info">${escHtml(linha)}</p>`);
  }
  if (empresa.telefoneEmpresa?.trim()) {
    partes.push(`<p class="empresa-info">Tel: ${escHtml(empresa.telefoneEmpresa.trim())}</p>`);
  }
  if (empresa.cnpjEmpresa?.trim()) {
    partes.push(`<p class="empresa-info">CNPJ: ${escHtml(empresa.cnpjEmpresa.trim())}</p>`);
  }
  return partes.join('');
}

function linhaCampoHtml(rotulo: string, valor: string): string {
  return `<p class="linha"><span class="linha-rotulo">${escHtml(rotulo)}</span> ${escHtml(valor)}</p>`;
}

function larguraFonteDupla(largura: number): number {
  return Math.max(16, Math.floor(largura / 2));
}

function cabecalhoEmpresaEscPos(encoder: EscPosEncoder, empresa: ImpressaoEmpresaConfig, largura: number): void {
  encoder
    .alinhar('center')
    .negrito(true)
    .tamanhoFonte(2, 2)
    .linha(empresa.nomeEmpresa || 'Assistencia Tecnica')
    .negrito(false)
    .tamanhoFonte(1, 2);

  for (const linha of quebrarLinhas(empresa.enderecoEmpresa, largura)) {
    encoder.linha(linha);
  }
  if (empresa.telefoneEmpresa?.trim()) {
    encoder.linha(`Tel: ${empresa.telefoneEmpresa.trim()}`);
  }
  if (empresa.cnpjEmpresa?.trim()) {
    encoder.linha(`CNPJ: ${empresa.cnpjEmpresa.trim()}`);
  }
  encoder.tamanhoFonte(1, 1).linha(linhaSeparadora(largura));
}

function blocoOsDestaqueEscPos(encoder: EscPosEncoder, os: BlingOrdemServico): void {
  encoder
    .alinhar('center')
    .negrito(true)
    .tamanhoFonte(3, 3)
    .linha(`OS ${numeroOs(os)}`)
    .tamanhoFonte(1, 1)
    .negrito(false)
    .alinhar('left');
}

function blocoClienteEscPos(encoder: EscPosEncoder, os: BlingOrdemServico, largura: number): void {
  encoder.alinhar('left').tamanhoFonte(1, 2);
  for (const linha of linhaRotuloQuebra('Cliente:', os.contato?.nome || '-', largura)) {
    encoder.linha(linha);
  }
  encoder.linha(linhaRotuloValor('Tel:', telefoneContato(os), largura));
  for (const linha of linhaRotuloQuebra('Autorizado retirar:', contatoAvisoLinha(os), largura)) {
    encoder.linha(linha);
  }
  encoder.tamanhoFonte(1, 1).linha(linhaSeparadora(largura));
}

function blocoAparelhoServicoEscPos(encoder: EscPosEncoder, os: BlingOrdemServico, largura: number): void {
  encoder.alinhar('left').tamanhoFonte(1, 2);
  for (const linha of linhaRotuloQuebra('Aparelho:', equipamentoGridLabel(os), largura)) {
    encoder.linha(linha);
  }
  if (os.imei?.trim()) {
    encoder.linha(linhaRotuloValor('IMEI:', os.imei.trim(), largura));
  }
  for (const linha of linhaRotuloQuebra('Servico:', servicoRealizado(os), largura)) {
    encoder.linha(linha);
  }
  encoder.tamanhoFonte(1, 1).linha(linhaSeparadora(largura));
}

function montarComprovanteDeixadoNaLoja(os: BlingOrdemServico, ctx: OsImpressaoTermicaContexto): Uint8Array {
  const largura = ctx.larguraLinha ?? 48;
  const dataDeixado = fmtData(os.dataEntrada || os.data);
  const encoder = new EscPosEncoder().init();

  cabecalhoEmpresaEscPos(encoder, ctx.empresa, largura);
  encoder
    .alinhar('center')
    .negrito(true)
    .tamanhoFonte(2, 2)
    .linha(centralizarTexto('DEIXADO NA LOJA', larguraFonteDupla(largura)))
    .negrito(false)
    .tamanhoFonte(1, 1);
  blocoOsDestaqueEscPos(encoder, os);
  encoder
    .negrito(true)
    .tamanhoFonte(2, 2)
    .linha(linhaRotuloValor('Deixado em:', dataDeixado, larguraFonteDupla(largura)))
    .negrito(false)
    .tamanhoFonte(1, 1)
    .linha(linhaSeparadora(largura));

  blocoClienteEscPos(encoder, os, largura);
  blocoAparelhoServicoEscPos(encoder, os, largura);

  encoder
    .alinhar('center')
    .tamanhoFonte(1, 2)
    .linha(fmtDataHora(new Date().toISOString()))
    .tamanhoFonte(1, 1)
    .avanco(2)
    .cortar();

  return encoder.build();
}

function montarGarantiaTermica(os: BlingOrdemServico, ctx: OsImpressaoTermicaContexto): Uint8Array {
  const largura = ctx.larguraLinha ?? 48;
  const dataRetirada = fmtData(os.dataSaida || os.dataConclusao);
  const dias = diasGarantiaOs(os, ctx.empresa);
  const validade = dataValidadeGarantia(os, ctx.empresa);
  const encoder = new EscPosEncoder().init();

  cabecalhoEmpresaEscPos(encoder, ctx.empresa, largura);
  encoder
    .alinhar('center')
    .negrito(true)
    .tamanhoFonte(2, 2)
    .linha(centralizarTexto('TERMO DE GARANTIA', larguraFonteDupla(largura)))
    .negrito(false)
    .tamanhoFonte(1, 1);
  blocoOsDestaqueEscPos(encoder, os);
  encoder
    .negrito(true)
    .tamanhoFonte(2, 2)
    .linha(linhaRotuloValor('Retirada:', dataRetirada, larguraFonteDupla(largura)))
    .negrito(false)
    .tamanhoFonte(1, 1)
    .linha(linhaSeparadora(largura));

  blocoClienteEscPos(encoder, os, largura);
  blocoAparelhoServicoEscPos(encoder, os, largura);

  encoder
    .alinhar('left')
    .tamanhoFonte(1, 2)
    .linha(linhaRotuloValor('Garantia:', `${dias} dias`, largura))
    .linha(linhaRotuloValor('Valida ate:', validade, largura))
    .tamanhoFonte(1, 1)
    .linha(linhaSeparadora(largura));

  encoder.tamanhoFonte(1, 2);
  for (const linha of quebrarLinhas(ctx.empresa.textoGarantiaTermica, largura)) {
    encoder.linha(linha);
  }
  encoder.tamanhoFonte(1, 1);

  encoder
    .avanco(1)
    .alinhar('center')
    .tamanhoFonte(1, 2)
    .linha(fmtDataHora(new Date().toISOString()))
    .tamanhoFonte(1, 1)
    .avanco(2)
    .cortar();

  return encoder.build();
}

export function montarEscPosImpressaoOs(
  tipo: OsImpressaoTipoTermico,
  os: BlingOrdemServico,
  ctx: OsImpressaoTermicaContexto,
): Uint8Array {
  switch (tipo) {
    case 'comprovante-loja-termico':
      return montarComprovanteDeixadoNaLoja(os, ctx);
    case 'garantia-termico':
      return montarGarantiaTermica(os, ctx);
  }
}

/** Texto de teste para validar conexao USB direta com a impressora. */
export function montarTesteImpressoraTermica(empresa: ImpressaoEmpresaConfig, largura = 48): Uint8Array {
  const encoder = new EscPosEncoder().init();
  cabecalhoEmpresaEscPos(encoder, empresa, largura);
  encoder
    .alinhar('center')
    .negrito(true)
    .tamanhoFonte(2, 2)
    .linha('TESTE DE IMPRESSAO')
    .negrito(false)
    .tamanhoFonte(1, 2)
    .linha('Epson termica OK')
    .linha(fmtDataHora(new Date().toISOString()))
    .tamanhoFonte(1, 1)
    .avanco(2)
    .cortar();
  return encoder.build();
}

/** Cupom HTML para impressão na Epson instalada no Windows (diálogo do Chrome). */
export function montarHtmlCupomTermico(
  tipo: OsImpressaoTipoTermico,
  os: BlingOrdemServico,
  ctx: OsImpressaoTermicaContexto,
): string {
  const n = numeroOs(os);
  const tituloPagina = tipo === 'comprovante-loja-termico' ? 'Deixado na loja' : 'Garantia';
  const tituloDoc = tipo === 'comprovante-loja-termico' ? 'Deixado na loja' : 'Termo de garantia';

  let corpo = blocoEmpresaHtml(ctx.empresa);
  corpo += '<hr class="separador" />';
  corpo += `<p class="titulo-doc">${escHtml(tituloDoc)}</p>`;
  corpo += `<p class="os-numero">OS #${escHtml(n)}</p>`;

  if (tipo === 'comprovante-loja-termico') {
    corpo += `<p class="destaque">Deixado em: ${escHtml(fmtData(os.dataEntrada || os.data))}</p>`;
  } else {
    corpo += `<p class="destaque">Retirada: ${escHtml(fmtData(os.dataSaida || os.dataConclusao))}</p>`;
  }

  corpo += '<hr class="separador" />';
  corpo += linhaCampoHtml('Cliente:', os.contato?.nome || '-');
  corpo += linhaCampoHtml('Tel:', telefoneContato(os));
  corpo += linhaCampoHtml('Autorizado a retirar:', contatoAvisoLinha(os));
  corpo += '<hr class="separador" />';
  corpo += linhaCampoHtml('Aparelho:', equipamentoGridLabel(os));
  if (os.imei?.trim()) corpo += linhaCampoHtml('IMEI:', os.imei.trim());
  corpo += linhaCampoHtml('Serviço:', servicoRealizado(os));

  if (tipo === 'garantia-termico') {
    corpo += '<hr class="separador" />';
    corpo += linhaCampoHtml('Garantia:', `${diasGarantiaOs(os, ctx.empresa)} dias`);
    corpo += linhaCampoHtml('Válida até:', dataValidadeGarantia(os, ctx.empresa));
    corpo += `<p class="texto-garantia">${escHtml(ctx.empresa.textoGarantiaTermica)}</p>`;
  }

  corpo += `<p class="rodape">${escHtml(fmtDataHora(new Date().toISOString()))}</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(tituloPagina)} OS ${escHtml(n)}</title>
  <style>${estilosCupomTermicoHtml()}</style>
</head>
<body>
  <div class="cupom">${corpo}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 200);
    };
  </script>
</body>
</html>`;
}

export function montarHtmlTesteImpressoraTermica(empresa: ImpressaoEmpresaConfig): string {
  const corpo = [
    blocoEmpresaHtml(empresa),
    '<hr class="separador" />',
    '<p class="titulo-doc">Teste de impressão</p>',
    '<p class="linha">Selecione a Epson no diálogo do Windows.</p>',
    `<p class="rodape">${escHtml(fmtDataHora(new Date().toISOString()))}</p>`,
  ].join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Teste impressora</title>
  <style>${estilosCupomTermicoHtml()}</style>
</head>
<body>
  <div class="cupom">${corpo}</div>
  <script>window.onload=function(){setTimeout(function(){window.focus();window.print();},200);};</script>
</body>
</html>`;
}
