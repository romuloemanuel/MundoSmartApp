import { ModeloAparelho } from '../models/bling.models';
import { AutocompleteItem } from '../components/autocomplete-criavel/autocomplete-criavel';

export function formatarDataCadastroModelo(valor?: string | null): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function modeloParaAutocomplete(m: ModeloAparelho): AutocompleteItem {
  return {
    id: m.id,
    nome: m.nome,
    marcaId: m.marcaId,
    marcaNome: m.marcaNome,
    criadoEm: m.criadoEm,
    extra: m.tipoDispositivo ?? undefined,
  };
}
