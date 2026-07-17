const MARCAS_ABREV: Record<string, string> = {
  iphone: 'IP',
  apple: 'IP',
  samsung: 'SM',
  motorola: 'MT',
  xiaomi: 'MI',
  realme: 'RM',
};

export function abreviarMarca(marca?: string | null): string {
  if (!marca?.trim()) return '';
  const chave = marca.trim().toLowerCase();
  return MARCAS_ABREV[chave] ?? marca.trim();
}

export function abreviarMarcasNoTexto(texto: string): string {
  let resultado = texto;
  for (const [marca, sigla] of Object.entries(MARCAS_ABREV)) {
    const regex = new RegExp(`\\b${marca}\\b`, 'gi');
    resultado = resultado.replace(regex, sigla);
  }
  return resultado;
}

export function equipamentoGridLabel(os: {
  equipamento?: string | null;
  marcaNome?: string | null;
  modeloNome?: string | null;
}): string {
  if (os.equipamento?.trim()) {
    return abreviarMarcasNoTexto(os.equipamento.trim());
  }

  const marcaOriginal = (os.marcaNome ?? '').trim();
  const modelo = (os.modeloNome ?? '').trim();
  const marca = abreviarMarca(marcaOriginal);

  if (marca && modelo) {
    const modeloSemMarca = modelo.replace(new RegExp(`^${escapeRegex(marcaOriginal)}\\s*`, 'i'), '').trim();
    return `${marca} ${modeloSemMarca || modelo}`.trim();
  }

  return marca || modelo || '—';
}

function escapeRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
