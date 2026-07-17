type Alinhamento = 'left' | 'center' | 'right';

export class EscPosEncoder {
  private readonly bytes: number[] = [];

  init(): this {
    this.bytes.push(0x1b, 0x40);
    return this;
  }

  alinhar(alinhamento: Alinhamento): this {
    const map: Record<Alinhamento, number> = { left: 0, center: 1, right: 2 };
    this.bytes.push(0x1b, 0x61, map[alinhamento]);
    return this;
  }

  negrito(ativo: boolean): this {
    this.bytes.push(0x1b, 0x45, ativo ? 1 : 0);
    return this;
  }

  tamanhoFonte(largura = 1, altura = 1): this {
    const n = Math.max(0, Math.min(7, largura - 1)) | (Math.max(0, Math.min(7, altura - 1)) << 4);
    this.bytes.push(0x1d, 0x21, n);
    return this;
  }

  texto(conteudo: string): this {
    const normalizado = normalizarTextoTermico(conteudo);
    for (let i = 0; i < normalizado.length; i++) {
      this.bytes.push(normalizado.charCodeAt(i) & 0xff);
    }
    return this;
  }

  linha(conteudo = ''): this {
    if (conteudo) this.texto(conteudo);
    this.bytes.push(0x0a);
    return this;
  }

  avanco(linhas = 1): this {
    for (let i = 0; i < linhas; i++) this.bytes.push(0x0a);
    return this;
  }

  cortar(): this {
    this.avanco(3);
    this.bytes.push(0x1d, 0x56, 0x00);
    return this;
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export function normalizarTextoTermico(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

export function linhaSeparadora(largura: number, char = '-'): string {
  return char.repeat(Math.max(8, largura));
}

export function centralizarTexto(texto: string, largura: number): string {
  const limpo = texto.trim();
  if (limpo.length >= largura) return limpo.slice(0, largura);
  const pad = Math.floor((largura - limpo.length) / 2);
  return ' '.repeat(pad) + limpo;
}

export function quebrarLinhas(texto: string, largura: number): string[] {
  const palavras = normalizarTextoTermico(texto).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];

  const linhas: string[] = [];
  let atual = '';

  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (candidato.length <= largura) {
      atual = candidato;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = palavra.length > largura ? palavra.slice(0, largura) : palavra;
  }

  if (atual) linhas.push(atual);
  return linhas;
}

export function linhaRotuloValor(rotulo: string, valor: string, largura: number): string {
  const r = normalizarTextoTermico(rotulo);
  const v = normalizarTextoTermico(valor);
  const espaco = largura - r.length - v.length;
  if (espaco >= 1) return `${r}${' '.repeat(espaco)}${v}`;
  return `${r} ${v}`.slice(0, largura);
}

export function linhaRotuloQuebra(rotulo: string, valor: string, largura: number): string[] {
  const prefixo = `${normalizarTextoTermico(rotulo)} `;
  const restante = largura - prefixo.length;
  const partes = quebrarLinhas(valor, Math.max(10, restante));
  if (!partes.length) return [`${prefixo}-`.slice(0, largura)];
  return partes.map((parte, indice) => (indice === 0 ? `${prefixo}${parte}` : ` ${' '.repeat(Math.max(0, prefixo.length - 1))}${parte}`.slice(0, largura)));
}
