import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService } from '../../../services/clientes';
import { CepService } from '../../../services/cep';
import { BlingContato } from '../../../models/bling.models';
import { ParentescoChips } from '../../../components/parentesco-chips/parentesco-chips';
import {
  ErrosContatoForm,
  aplicarMascarasContato,
  apenasDigitos,
  formatarCep,
  formatarCpfCnpj,
  formatarTelefone,
  formularioClienteValido,
  validarCpfCnpj,
  validarFormularioCliente,
} from '../../../utils/contato-validacao';
import {
  ClienteDuplicadoVerificacao,
  ContatoAltSugestao,
  DUPLICADO_OK,
  SUGESTAO_ALT_VAZIA,
  agendarVerificacao,
  cancelarVerificacao,
  mensagemDuplicata,
  temDuplicata,
} from '../../../utils/cliente-duplicata';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-clientes-form',
  imports: [CommonModule, FormsModule, ParentescoChips],
  templateUrl: './form.html',
  styles: [`
    .cliente-end-titulo {
      margin-top: 28px;
    }
    .cliente-end-cep-row {
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 4px;
    }
    .cliente-end-cep {
      flex: 0 0 160px;
      max-width: 160px;
      min-width: 140px;
    }
    .cliente-end-logradouro {
      flex: 1 1 auto;
      min-width: 0;
    }
    .cliente-end-cep .campo-verificando,
    .cliente-end-cep .campo-erro {
      display: block;
      margin-top: 6px;
      line-height: 1.3;
    }
  `],
})
export class ClientesForm implements OnInit, OnDestroy {
  contato: BlingContato = { nome: '', contatos: [], endereco: {} };
  editando = false;
  salvando = false;
  erro = '';
  erros: ErrosContatoForm = {};

  dupCpf: ClienteDuplicadoVerificacao = DUPLICADO_OK;
  dupCelular: ClienteDuplicadoVerificacao = DUPLICADO_OK;
  dupTelefone: ClienteDuplicadoVerificacao = DUPLICADO_OK;
  dupTelefone2: ClienteDuplicadoVerificacao = DUPLICADO_OK;

  verificandoCpf = false;
  verificandoCelular = false;
  verificandoTelefone = false;
  /** Hint por índice do contato alternativo (nome sugerido da base). */
  hintAlt: (string | null)[] = [];
  buscandoAlt: boolean[] = [];
  buscandoCep = false;
  erroCep = '';

  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Nome autofilled por índice — só sobrescreve se o usuário não editou. */
  private nomeAltAutofill: (string | null)[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ClientesService,
    private cepService: CepService,
  ) {}

  get msgDupCpf(): string { return mensagemDuplicata('CPF/CNPJ', this.dupCpf); }
  get msgDupCelular(): string { return mensagemDuplicata('Celular', this.dupCelular); }
  get msgDupTelefone(): string { return mensagemDuplicata('Telefone', this.dupTelefone); }
  get msgDupTelefone2(): string { return mensagemDuplicata('Telefone', this.dupTelefone2); }
  get temDuplicidade(): boolean {
    return temDuplicata(this.dupCpf, this.dupCelular, this.dupTelefone, this.dupTelefone2);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'novo') {
      this.editando = true;
      this.service.obter(+id).subscribe({
        next: (c) => {
          this.contato = aplicarMascarasContato({
            ...c,
            contatos: c.contatos ?? [],
            endereco: c.endereco ?? {},
          });
          const n = this.contato.contatos?.length ?? 0;
          this.hintAlt = Array(n).fill(null);
          this.buscandoAlt = Array(n).fill(false);
          this.nomeAltAutofill = Array(n).fill(null);
        },
        error: () => (this.erro = 'Erro ao carregar cliente.'),
      });
    }
  }

  ngOnDestroy(): void {
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
  }

  onCpfCnpjChange(valor: string): void {
    this.contato.cpfCnpj = formatarCpfCnpj(valor);
    this.erros.cpfCnpj = undefined;
    this.dupCpf = DUPLICADO_OK;
    const d = apenasDigitos(valor);
    if (d.length === 11 || d.length === 14) {
      if (!validarCpfCnpj(valor)) {
        this.erros.cpfCnpj = 'CPF ou CNPJ inválido.';
        return;
      }
      agendarVerificacao(this.debounceTimers, 'cpf', () => this.verificarCpf());
    }
  }

  onCelularChange(valor: string): void {
    this.contato.celular = formatarTelefone(valor);
    this.erros.contato = undefined;
    this.dupCelular = DUPLICADO_OK;
    this.agendarVerificacaoTelefone('celular', valor, v => this.dupCelular = v);
  }

  onTelefoneChange(valor: string): void {
    this.contato.telefone = formatarTelefone(valor);
    this.erros.contato = undefined;
    this.dupTelefone = DUPLICADO_OK;
    this.agendarVerificacaoTelefone('telefone', valor, v => this.dupTelefone = v);
  }

  onTelefone2Change(valor: string): void {
    this.contato.telefone2 = formatarTelefone(valor);
    this.erros.telefone2 = undefined;
    this.dupTelefone2 = DUPLICADO_OK;
    this.agendarVerificacaoTelefone('telefone2', valor, v => this.dupTelefone2 = v);
  }

  onCelularAltChange(i: number, valor: string): void {
    if (!this.contato.contatos?.[i]) return;
    this.contato.contatos[i].celular = formatarTelefone(valor);
    this.agendarSugestaoAlt(i, valor);
  }

  onTelefoneAltChange(i: number, valor: string): void {
    if (!this.contato.contatos?.[i]) return;
    this.contato.contatos[i].telefone = formatarTelefone(valor);
    this.agendarSugestaoAlt(i, valor);
  }

  onNomeAltChange(i: number, valor: string): void {
    if (!this.contato.contatos?.[i]) return;
    this.contato.contatos[i].nome = valor;
    // Se o usuário alterou o nome manualmente, deixa de tratar como autofill.
    if ((this.nomeAltAutofill[i] ?? '') !== (valor ?? '').trim()) {
      this.nomeAltAutofill[i] = null;
    }
  }

  private agendarSugestaoAlt(i: number, telefoneDigitado: string): void {
    const d = apenasDigitos(telefoneDigitado);
    const chave = `alt-${i}`;
    if (d.length < 10) {
      cancelarVerificacao(this.debounceTimers, chave);
      this.hintAlt[i] = null;
      this.buscandoAlt[i] = false;
      return;
    }
    agendarVerificacao(this.debounceTimers, chave, () => this.buscarSugestaoAlt(i, d));
  }

  private buscarSugestaoAlt(i: number, telefone: string): void {
    const alt = this.contato.contatos?.[i];
    if (!alt) return;
    this.buscandoAlt[i] = true;
    this.service.sugerirContatoAlt(telefone).pipe(
      switchMap((s: ContatoAltSugestao) => {
        if (s.encontrado && s.nome?.trim()) return of(s);
        // Fallback: busca geral por telefone na lista de clientes.
        return this.service.listar(telefone).pipe(
          map(lista => {
            const c = lista.find(x => !!x.nome?.trim());
            if (!c?.nome) return SUGESTAO_ALT_VAZIA;
            return {
              encontrado: true,
              nome: c.nome.trim(),
              clienteId: c.id,
              eClientePrincipal: true,
            } satisfies ContatoAltSugestao;
          }),
          catchError(() => of(SUGESTAO_ALT_VAZIA)),
        );
      }),
      catchError(() => of(SUGESTAO_ALT_VAZIA)),
    ).subscribe(s => {
      this.buscandoAlt[i] = false;
      if (!s.encontrado || !s.nome?.trim()) {
        this.hintAlt[i] = null;
        return;
      }
      const nomeAtual = (alt.nome ?? '').trim();
      const autofillAnterior = this.nomeAltAutofill[i];
      const podePreencher =
        !nomeAtual || (autofillAnterior != null && nomeAtual === autofillAnterior);
      if (podePreencher) {
        alt.nome = s.nome.trim();
        this.nomeAltAutofill[i] = alt.nome;
      }
      this.hintAlt[i] = s.eClientePrincipal
        ? `Nome da base: ${s.nome} (já é cliente). Cadastro não é bloqueado.`
        : `Nome da base: ${s.nome}. Pode repetir em outros clientes.`;
    });
  }

  onCepChange(valor: string): void {
    this.contato.endereco = this.contato.endereco ?? {};
    this.contato.endereco.cep = formatarCep(valor);
    this.erroCep = '';
    const d = apenasDigitos(valor);
    if (d.length < 8) {
      cancelarVerificacao(this.debounceTimers, 'cep');
      this.buscandoCep = false;
      return;
    }
    agendarVerificacao(this.debounceTimers, 'cep', () => this.buscarCep(d), 350);
  }

  private buscarCep(cep: string): void {
    this.buscandoCep = true;
    this.erroCep = '';
    this.cepService.consultar(cep).subscribe(end => {
      this.buscandoCep = false;
      if (!end) {
        this.erroCep = 'CEP não encontrado.';
        return;
      }
      this.contato.endereco = this.contato.endereco ?? {};
      this.contato.endereco.cep = end.cep;
      this.contato.endereco.logradouro = end.logradouro || this.contato.endereco.logradouro;
      this.contato.endereco.bairro = end.bairro || this.contato.endereco.bairro;
      this.contato.endereco.municipio = end.municipio || this.contato.endereco.municipio;
      this.contato.endereco.uf = end.uf || this.contato.endereco.uf;
    });
  }

  private agendarVerificacaoTelefone(
    campo: 'celular' | 'telefone' | 'telefone2',
    valor: string,
    setter: (v: ClienteDuplicadoVerificacao) => void,
  ): void {
    const d = apenasDigitos(valor);
    if (d.length < 10) {
      cancelarVerificacao(this.debounceTimers, campo);
      setter(DUPLICADO_OK);
      return;
    }
    agendarVerificacao(this.debounceTimers, campo, () => this.verificarTelefone(campo, valor, setter));
  }

  private verificarCpf(): void {
    const doc = this.contato.cpfCnpj?.trim();
    if (!doc || !validarCpfCnpj(doc)) return;
    this.verificandoCpf = true;
    this.service.verificarCpf(doc, this.contato.id).subscribe({
      next: r => { this.dupCpf = r; this.verificandoCpf = false; },
      error: () => { this.dupCpf = DUPLICADO_OK; this.verificandoCpf = false; },
    });
  }

  private verificarTelefone(
    campo: 'celular' | 'telefone' | 'telefone2',
    valor: string,
    setter: (v: ClienteDuplicadoVerificacao) => void,
  ): void {
    if (apenasDigitos(valor).length < 10) return;
    if (campo === 'celular') this.verificandoCelular = true;
    if (campo === 'telefone') this.verificandoTelefone = true;
    this.service.verificarTelefone(valor, this.contato.id).subscribe({
      next: r => {
        setter(r);
        if (campo === 'celular') this.verificandoCelular = false;
        if (campo === 'telefone') this.verificandoTelefone = false;
      },
      error: () => {
        setter(DUPLICADO_OK);
        if (campo === 'celular') this.verificandoCelular = false;
        if (campo === 'telefone') this.verificandoTelefone = false;
      },
    });
  }

  adicionarContato(): void {
    this.contato.contatos = this.contato.contatos ?? [];
    if (this.contato.contatos.length < 2) {
      this.contato.contatos.push({});
      this.hintAlt.push(null);
      this.buscandoAlt.push(false);
      this.nomeAltAutofill.push(null);
    }
  }

  removerContato(i: number): void {
    this.contato.contatos?.splice(i, 1);
    this.hintAlt.splice(i, 1);
    this.buscandoAlt.splice(i, 1);
    this.nomeAltAutofill.splice(i, 1);
  }

  salvar(): void {
    this.erros = validarFormularioCliente(this.contato);
    if (!formularioClienteValido(this.erros) || this.temDuplicidade) {
      this.erro = this.erros.geral ?? (this.temDuplicidade ? 'Corrija os dados duplicados antes de salvar.' : 'Verifique os campos destacados.');
      return;
    }

    this.salvando = true;
    this.erro = '';
    const op = this.editando
      ? this.service.atualizar(this.contato.id!, this.contato)
      : this.service.criar(this.contato);

    op.subscribe({
      next: () => this.router.navigate(['/clientes']),
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao salvar cliente.';
        this.salvando = false;
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/clientes']);
  }
}
