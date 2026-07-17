/**
 * Prepara arquivo para upload no celular.
 * Clone leve (slice) — não lê a foto inteira na RAM (arrayBuffer deixava o envio lento).
 * O PC envia o File direto; no celular só “fixamos” a referência para o Android não invalidar.
 */
export function prepararArquivoParaUpload(file: File): File {
  const nome = normalizarNomeArquivo(file.name);
  const tipo = file.type || tipoPorNome(nome) || 'image/jpeg';

  if (!file.size) {
    throw new Error('Arquivo de imagem vazio. Tente tirar/escolher a foto de novo.');
  }

  // slice() é barato; arrayBuffer() em foto de 8–12 MB era a demora.
  return new File([file.slice(0, file.size, tipo)], nome, {
    type: tipo,
    lastModified: Date.now(),
  });
}

function normalizarNomeArquivo(nome: string): string {
  const limpo = (nome || '').trim().replace(/[\\/:*?"<>|]+/g, '_');
  if (limpo && /\.[a-z0-9]+$/i.test(limpo)) return limpo;
  return limpo ? `${limpo}.jpg` : `foto-${Date.now()}.jpg`;
}

function tipoPorNome(nome: string): string {
  const ext = nome.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic':
    case 'heif': return 'image/heic';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    default: return 'image/jpeg';
  }
}
