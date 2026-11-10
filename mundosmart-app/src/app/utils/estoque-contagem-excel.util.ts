import writeXlsxFile, { type Cell, type Row } from 'write-excel-file/browser';
import { RelatorioContagemMontado } from './estoque-contagem-relatorio.util';

const COLUNAS = 8;
const AZUL = '#1e3a8a';
const AZUL_CLARO = '#dbeafe';
const CINZA = '#f1f5f9';
const BORDA = '#cbd5e1';

export interface ExcelContagemParams {
  relatorio: RelatorioContagemMontado;
  geradoEm: Date;
  saldoLabel: string;
  marcaLabel: string;
  tipoLabel: string;
}

export async function baixarExcelContagem(params: ExcelContagemParams): Promise<void> {
  const gerado = params.geradoEm.toLocaleString('pt-BR');
  const linhas: Row[] = [
    [faixa('Contagem de estoque', {
      fontWeight: 'bold',
      fontSize: 16,
      height: 24,
    })],
    [faixa(
      `Gerado em ${gerado} · Estoque: ${params.saldoLabel} · Marca: ${params.marcaLabel} · Tipo: ${params.tipoLabel}`,
      { fontSize: 11, textColor: '#334155', wrap: true, height: 32 },
    )],
    [faixa(
      'VLR Uni é o custo do lote mais recente. VLR Médio é a média ponderada pela quantidade restante. Lotes: Lote 26-79 QTD 3 / Lote 26-80 QTD 1.',
      { fontSize: 10, fontStyle: 'italic', textColor: '#475569', wrap: true, height: 32 },
    )],
    cabecalho(),
  ];

  for (const grupo of params.relatorio.grupos) {
    if (params.relatorio.agruparMarca) {
      linhas.push([faixa(`${grupo.marca} · ${grupo.totalQtd} un.`, {
        fontWeight: 'bold',
        fontSize: 13,
        textColor: '#ffffff',
        backgroundColor: AZUL,
        height: 22,
      })]);
    }
    for (const tipo of grupo.tipos) {
      if (params.relatorio.agruparTipo) {
        linhas.push([faixa(`${tipo.tipo} · ${tipo.totalQtd} un.`, {
          fontWeight: 'bold',
          textColor: AZUL,
          backgroundColor: AZUL_CLARO,
          height: 20,
        })]);
      }
      for (const linha of tipo.linhas) {
        linhas.push(linhaDados(linha));
      }
    }
  }

  linhas.push([
    faixaCelula('Total', {
      fontWeight: 'bold',
      backgroundColor: CINZA,
      columnSpan: 6,
    }),
    null,
    null,
    null,
    null,
    null,
    {
      value: params.relatorio.totalUnidades,
      type: Number,
      format: '#,##0',
      fontWeight: 'bold',
      align: 'right',
      backgroundColor: CINZA,
      borderColor: BORDA,
      borderStyle: 'thin',
    },
    {
      value: '',
      type: String,
      backgroundColor: CINZA,
      borderColor: BORDA,
      borderStyle: 'thin',
    },
  ]);

  const dia = dataArquivo(params.geradoEm);
  await writeXlsxFile(linhas, {
    sheet: 'Contagem',
    stickyRowsCount: 4,
    columns: [
      { width: 18 },
      { width: 28 },
      { width: 22 },
      { width: 34 },
      { width: 14 },
      { width: 14 },
      { width: 10 },
      { width: 62 },
    ],
  }, {
    fontFamily: 'Calibri',
    fontSize: 11,
  }).toFile(`contagem-estoque-${dia}.xlsx`);
}

function cabecalho(): Row {
  const titulos = ['Marca', 'Modelo', 'Tipo de peça', 'Peça', 'VLR Uni', 'VLR Médio', 'Qtd', 'Lotes'];
  return titulos.map(titulo => ({
    value: titulo,
    type: String,
    fontWeight: 'bold' as const,
    textColor: '#ffffff',
    backgroundColor: AZUL,
    align: titulo === 'VLR Uni' || titulo === 'VLR Médio' || titulo === 'Qtd' ? 'right' as const : 'left' as const,
    borderColor: AZUL,
    borderStyle: 'thin' as const,
    height: 20,
  }));
}

function linhaDados(linha: {
  marca: string;
  modelo: string;
  tipo: string;
  peca: string;
  vlrUni: number | null;
  vlrMedio: number | null;
  qtd: number;
  lotes: string;
  semLote: boolean;
}): Row {
  const altura = Math.min(72, 16 * Math.max(1, Math.ceil((linha.lotes || '').length / 55)));
  return [
    texto(linha.marca, altura),
    texto(linha.modelo, altura),
    texto(linha.tipo, altura),
    texto(linha.peca, altura),
    moeda(linha.vlrUni),
    moeda(linha.vlrMedio),
    {
      value: linha.qtd,
      type: Number,
      format: '#,##0',
      align: 'right',
      alignVertical: 'top',
      borderColor: BORDA,
      borderStyle: 'thin',
    },
    {
      value: linha.lotes || '—',
      type: String,
      wrap: true,
      alignVertical: 'top',
      textColor: linha.semLote ? '#b45309' : '#0f172a',
      borderColor: BORDA,
      borderStyle: 'thin',
      height: altura,
    },
  ];
}

function texto(valor: string, altura: number): Cell {
  return {
    value: valor,
    type: String,
    alignVertical: 'top',
    wrap: true,
    borderColor: BORDA,
    borderStyle: 'thin',
    height: altura,
  };
}

function moeda(valor: number | null): Cell {
  if (valor === null || Number.isNaN(valor)) {
    return {
      value: '—',
      type: String,
      align: 'right',
      alignVertical: 'top',
      borderColor: BORDA,
      borderStyle: 'thin',
    };
  }
  return {
    value: valor,
    type: Number,
    format: '"R$" #,##0.00',
    align: 'right',
    alignVertical: 'top',
    borderColor: BORDA,
    borderStyle: 'thin',
  };
}

function faixa(valor: string, estilo: Omit<Cell, 'value' | 'type' | 'columnSpan'>): Cell {
  return faixaCelula(valor, estilo);
}

function faixaCelula(valor: string, estilo: Omit<Cell, 'value' | 'type'>): Cell {
  return {
    value: valor,
    type: String,
    columnSpan: COLUNAS,
    alignVertical: 'center',
    ...estilo,
  };
}

function dataArquivo(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
