import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService } from '../../services/clientes';
import { CepService } from '../../services/cep';
import { BlingContato } from '../../models/bling.models';
import { ParentescoChips } from '../parentesco-chips/parentesco-chips';
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
} from '../../utils/contato-validacao';
import {
  ClienteDuplicadoVerificacao,
  ContatoAltSugestao,
  DUPLICADO_OK,
  SUGESTAO_ALT_VAZIA,
  agendarVerificacao,
  cancelarVerificacao,
  mensagemDuplicata,
  temDuplicata,
} from '../../utils/cliente-duplicata';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-novo-cliente-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ParentescoChips],
  template: `
    <div class="modal-backdrop" (click)="fechar()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ editando ? 'Editar Cliente' : 'Novo Cliente' }}</h3>
          <button type="button" class="modal-close" (click)="fechar()">✕</button>
        </div>

        <div class="modal-body">
          <p *ngIf="erro" class="erro">{{ erro }}</p>

          <div class="form-group">
            <label>Nome <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
            <input [(ngModel)]="contato.nome" name="nome" placeholder="Nome completo" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>CPF / CNPJ</label>
              <input
                [ngModel]="contato.cpfCnpj"
                (ngModelChange)="onCpfCnpjChange($event)"
                name="cpfCnpj"
                placeholder="000.000.000-00"
                inputmode="numeric"
              />
              <span class="campo-erro" *ngIf="erros.cpfCnpj">{{ erros.cpfCnpj }}</span>
              <span class="campo-erro" *ngIf="msgDupCpf">{{ msgDupCpf }}</span>
              <span class="campo-verificando" *ngIf="verificandoCpf">Verificando CPF/CNPJ...</span>
            </div>
            <div class="form-group">
              <label>E-mail</label>
              <input [(ngModel)]="contato.email" name="email" type="email" placeholder="email@exemplo.com" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Celular <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
              <input
                [ngModel]="contato.celular"
                (ngModelChange)="onCelularChange($event)"
                name="celular"
                placeholder="(00) 90000-0000"
                inputmode="tel"
              />
              <span class="campo-erro" *ngIf="msgDupCelular">{{ msgDupCelular }}</span>
              <span class="campo-verificando" *ngIf="verificandoCelular">Verificando celular...</span>
            </div>
            <div class="form-group">
              <label>Telefone <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
              <input
                [ngModel]="contato.telefone"
                (ngModelChange)="onTelefoneChange($event)"
                name="telefone"
                placeholder="(00) 0000-0000"
                inputmode="tel"
              />
              <span class="campo-erro" *ngIf="msgDupTelefone">{{ msgDupTelefone }}</span>
              <span class="campo-verificando" *ngIf="verificandoTelefone">Verificando telefone...</span>
            </div>
          </div>
          <span class="campo-erro" *ngIf="erros.contato">{{ erros.contato }}</span>
          <p class="campo-hint">Informe ao menos um: celular (9 após o DDD) ou telefone fixo.</p>

          <div class="form-group">
            <label>Telefone 2</label>
            <input
              [ngModel]="contato.telefone2"
              (ngModelChange)="onTelefone2Change($event)"
              name="telefone2"
              placeholder="Segundo número (opcional)"
              inputmode="tel"
            />
            <span class="campo-erro" *ngIf="erros.telefone2">{{ erros.telefone2 }}</span>
            <span class="campo-erro" *ngIf="msgDupTelefone2">{{ msgDupTelefone2 }}</span>
          </div>

          <div class="secao-contatos">
            <div class="secao-header">
              <span class="secao-titulo">Contatos Alternativos</span>
              <button
                type="button"
                class="btn-add-contato"
                *ngIf="(contato.contatos?.length ?? 0) < 2"
                (click)="adicionarContato()"
              >+ Adicionar</button>
            </div>

            <p class="campo-hint">Digite o telefone: se já estiver na base, o nome é preenchido sozinho.</p>
            <div *ngFor="let c of contato.contatos; let i = index" class="contato-card">
              <div class="contato-card-header">
                <span>Contato {{ i + 1 }}</span>
                <button type="button" class="btn-remove-contato" (click)="removerContato(i)">✕</button>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Celular</label>
                  <input
                    [ngModel]="c.celular"
                    (ngModelChange)="onCelularAltChange(i, $event)"
                    [name]="'cCel' + i"
                    placeholder="(00) 90000-0000"
                    inputmode="tel"
                  />
                </div>
                <div class="form-group">
                  <label>Telefone</label>
                  <input
                    [ngModel]="c.telefone"
                    (ngModelChange)="onTelefoneAltChange(i, $event)"
                    [name]="'cTel' + i"
                    placeholder="(00) 0000-0000"
                    inputmode="tel"
                  />
                </div>
              </div>
              <span class="campo-verificando" *ngIf="buscandoAlt[i]">Buscando na base...</span>
              <p class="campo-hint hint-ok" *ngIf="hintAlt[i]">{{ hintAlt[i] }}</p>
              <div class="form-group">
                <label>Nome <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
                <input
                  [ngModel]="c.nome"
                  (ngModelChange)="onNomeAltChange(i, $event)"
                  [name]="'cNome' + i"
                  placeholder="Nome do contato"
                />
                <span class="campo-erro" *ngIf="erros.contatosAlt?.[i]?.nome">{{ erros.contatosAlt![i].nome }}</span>
              </div>
              <div class="form-group">
                <label>Parentesco <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
                <app-parentesco-chips
                  [valor]="c.parentesco || ''"
                  (valorChange)="c.parentesco = $event"
                ></app-parentesco-chips>
                <span class="campo-erro" *ngIf="erros.contatosAlt?.[i]?.parentesco">{{ erros.contatosAlt![i].parentesco }}</span>
              </div>
              <span class="campo-erro" *ngIf="erros.contatosAlt?.[i]?.contato">{{ erros.contatosAlt![i].contato }}</span>
            </div>
          </div>

          <div class="secao-contatos secao-endereco">
            <span class="secao-titulo">Endereço</span>
            <div class="form-row end-cep-row">
              <div class="form-group end-cep">
                <label>CEP</label>
                <input
                  [ngModel]="contato.endereco!.cep"
                  (ngModelChange)="onCepChange($event)"
                  name="cep"
                  placeholder="00000-000"
                  inputmode="numeric"
                  maxlength="9"
                />
                <span class="campo-verificando" *ngIf="buscandoCep">Consultando CEP...</span>
                <span class="campo-erro" *ngIf="erroCep">{{ erroCep }}</span>
              </div>
              <div class="form-group end-logradouro">
                <label>Logradouro</label>
                <input [(ngModel)]="contato.endereco!.logradouro" name="logradouro" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Número</label>
                <input [(ngModel)]="contato.endereco!.numero" name="numero" />
              </div>
              <div class="form-group">
                <label>Complemento</label>
                <input [(ngModel)]="contato.endereco!.complemento" name="complemento" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Bairro</label>
                <input [(ngModel)]="contato.endereco!.bairro" name="bairro" />
              </div>
              <div class="form-group">
                <label>Município</label>
                <input [(ngModel)]="contato.endereco!.municipio" name="municipio" />
              </div>
              <div class="form-group" style="max-width:72px">
                <label>UF</label>
                <input [(ngModel)]="contato.endereco!.uf" name="uf" maxlength="2" />
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" (click)="fechar()">Cancelar</button>
          <button
            type="button"
            class="btn-salvar"
            (click)="salvar()"
            [disabled]="salvando || temDuplicidade"
          >{{ salvando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Salvar Cliente') }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .modal-box {
      background: #fff;
      border-radius: 12px;
      width: 100%; max-width: 600px;
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid #f1f5f9;
      background: #0d0d0d;
      border-radius: 12px 12px 0 0;
    }
    .modal-header h3 {
      margin: 0; font-size: 16px; font-weight: 700;
      color: #fff; letter-spacing: 0.5px;
    }
    .modal-close {
      background: transparent; border: none;
      color: rgba(255,255,255,0.7); font-size: 18px;
      cursor: pointer; padding: 0 4px;
      &:hover { color: #fff; }
    }
    .modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .modal-footer {
      padding: 14px 24px;
      border-top: 1px solid #f1f5f9;
      display: flex; gap: 10px; justify-content: flex-end;
    }
    .modal-footer button { padding: 9px 20px; font-size: 13px; }
    .btn-salvar { background: #2563EB; color: #fff; }
    .modal-footer button:first-child {
      background: #f1f5f9; color: #374151;
      border: 1px solid #e2e8f0;
      &:hover { background: #e2e8f0; }
    }
    .form-group { display: flex; flex-direction: column; margin-bottom: 14px; }
    .form-group label {
      font-size: 10px; font-weight: 700;
      color: #6b7280; margin-bottom: 5px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .form-group input {
      padding: 8px 12px; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 14px;
      font-family: inherit; outline: none;
      &:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    }
    .form-row { display: flex; gap: 12px; }
    .form-row .form-group { flex: 1; }
    .campo-erro { font-size: 11px; color: #dc2626; margin-top: 4px; font-weight: 600; }
    .campo-verificando { font-size: 10px; color: #6b7280; margin-top: 4px; font-style: italic; }
    .campo-hint { font-size: 10px; color: #9ca3af; margin: -8px 0 12px; line-height: 1.35; }
    .hint-ok { color: #166534; font-weight: 600; margin: 4px 0 8px; }
    .secao-endereco { margin-top: 20px; }
    .end-cep-row {
      align-items: flex-start;
      gap: 20px;
      margin-top: 12px;
    }
    .end-cep {
      flex: 0 0 150px !important;
      max-width: 150px;
      min-width: 130px;
    }
    .end-logradouro {
      flex: 1 1 auto !important;
      min-width: 0;
    }
    .end-cep .campo-verificando,
    .end-cep .campo-erro {
      display: block;
      margin-top: 6px;
      line-height: 1.3;
      white-space: normal;
    }
    .secao-contatos { margin-top: 8px; }
    .secao-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px;
    }
    .secao-titulo {
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
      color: #374151; border-bottom: 2px solid #2563EB;
      padding-bottom: 3px;
    }
    .btn-add-contato {
      font-size: 12px; padding: 4px 12px;
      background: #2563EB; color: #fff; border-radius: 5px;
    }
    .contato-card {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;
    }
    .contato-card-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px; font-size: 12px; font-weight: 700; color: #374151;
    }
    .btn-remove-contato {
      background: transparent; color: #dc2626; border: none;
      font-size: 14px; cursor: pointer; padding: 0;
    }
    .erro {
      color: #dc2626; font-size: 13px;
      background: #fef2f2; border: 1px solid #fca5a5;
      padding: 8px 12px; border-radius: 6px; margin-bottom: 14px;
    }
  `],
})
export class NovoClienteModal implements OnChanges, OnDestroy {
  @Input() clienteEdicao?: BlingContato;
  @Output() clienteCriado = new EventEmitter<BlingContato>();
  @Output() clienteAtualizado = new EventEmitter<BlingContato>();
  @Output() fecharModal = new EventEmitter<void>();

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
  hintAlt: (string | null)[] = [];
  buscandoAlt: boolean[] = [];
  buscandoCep = false;
  erroCep = '';

  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private nomeAltAutofill: (string | null)[] = [];

  constructor(
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clienteEdicao']) this.inicializarFormulario();
  }

  ngOnDestroy(): void {
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
  }

  private inicializarFormulario(): void {
    if (this.clienteEdicao?.id) {
      this.editando = true;
      this.contato = aplicarMascarasContato({
        ...this.clienteEdicao,
        contatos: (this.clienteEdicao.contatos ?? []).map(c => ({ ...c })),
        endereco: this.clienteEdicao.endereco ?? {},
      });
    } else {
      this.editando = false;
      this.contato = { nome: '', contatos: [], endereco: {} };
    }
    const n = this.contato.contatos?.length ?? 0;
    this.hintAlt = Array(n).fill(null);
    this.buscandoAlt = Array(n).fill(false);
    this.nomeAltAutofill = Array(n).fill(null);
    this.buscandoCep = false;
    this.erroCep = '';
    this.erro = '';
    this.erros = {};
    this.limparDuplicatas();
  }

  private limparDuplicatas(): void {
    this.dupCpf = DUPLICADO_OK;
    this.dupCelular = DUPLICADO_OK;
    this.dupTelefone = DUPLICADO_OK;
    this.dupTelefone2 = DUPLICADO_OK;
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
    this.limparErroAlt(i);
    this.agendarSugestaoAlt(i, valor);
  }

  onTelefoneAltChange(i: number, valor: string): void {
    if (!this.contato.contatos?.[i]) return;
    this.contato.contatos[i].telefone = formatarTelefone(valor);
    this.limparErroAlt(i);
    this.agendarSugestaoAlt(i, valor);
  }

  onNomeAltChange(i: number, valor: string): void {
    if (!this.contato.contatos?.[i]) return;
    this.contato.contatos[i].nome = valor;
    if ((this.nomeAltAutofill[i] ?? '') !== (valor ?? '').trim()) {
      this.nomeAltAutofill[i] = null;
    }
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

  private limparErroAlt(i: number): void {
    if (this.erros.contatosAlt?.[i]) delete this.erros.contatosAlt[i].contato;
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
      this.hintAlt[i] = `Nome da base: ${s.nome}`;
    });
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
      next: r => {
        this.dupCpf = r;
        this.verificandoCpf = false;
      },
      error: () => {
        this.dupCpf = DUPLICADO_OK;
        this.verificandoCpf = false;
      },
    });
  }

  private verificarTelefone(
    campo: 'celular' | 'telefone' | 'telefone2',
    valor: string,
    setter: (v: ClienteDuplicadoVerificacao) => void,
  ): void {
    const d = apenasDigitos(valor);
    if (d.length < 10) return;

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
      this.erro = this.erros.geral ?? (this.temDuplicidade ? 'Corrija os dados duplicados antes de salvar.' : '');
      return;
    }

    this.salvando = true;
    this.erro = '';
    const req = this.editando && this.contato.id
      ? this.service.atualizar(this.contato.id, this.contato)
      : this.service.criar(this.contato);

    req.subscribe({
      next: salvo => {
        this.salvando = false;
        const cliente = aplicarMascarasContato(salvo);
        if (this.editando) this.clienteAtualizado.emit(cliente);
        else this.clienteCriado.emit(cliente);
      },
      error: err => {
        this.salvando = false;
        this.erro = err?.error?.erro ?? 'Erro ao salvar cliente.';
      },
    });
  }

  fechar(): void {
    this.fecharModal.emit();
  }
}
