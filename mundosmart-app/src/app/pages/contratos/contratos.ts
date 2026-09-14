import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AppAuthService } from '../../services/app-auth';
import { DocumentoA4Preview } from '../../components/documento-a4-preview/documento-a4-preview';
import { DocumentoCorpoEditor } from '../../components/documento-corpo-editor/documento-corpo-editor';
import {
  DOCUMENTO_TIPOS,
  DocumentoModelo,
  DocumentoVariavel,
  DocumentoVariavelCatalogo,
  DocumentoVariavelTipo,
  DocumentosService,
} from '../../services/documentos.service';
import { OsImpressaoConfigService } from '../../services/os-impressao-config.service';
import { OsImpressaoService } from '../../services/os-impressao.service';
import { avisarAvisoUsuario, avisarErroUsuario, avisarSucessoUsuario } from '../../services/user-feedback.service';
import { EnderecoCampo } from '../../components/endereco-campo/endereco-campo';
import { BlingContatoEndereco } from '../../models/bling.models';
import {
  apenasDigitos,
  ehTelefoneValido,
  formatarCnpj,
  formatarCpf,
  formatarCpfCnpj,
  formatarTelefone,
  validarCnpj,
  validarCpf,
} from '../../utils/contato-validacao';
import { enderecoMinimoPreenchido } from '../../utils/endereco-format.util';
import { mensagemAlertaImei } from '../../utils/imei.util';
import {
  agoraLocalIso,
  campoDocumentoOculto,
  camposPendentes,
  corpoDocumentoParaHtml,
  corpoDocumentoVazio,
  ehEnderecoLoja,
  montarHtmlDocumento,
  preencherModelo,
} from '../../utils/documento-template.util';

export type ContratosAba = 'emitir' | 'modelos' | 'variaveis';

function normalizarCodigoDoc(codigo: string | undefined): string {
  return (codigo ?? '').trim().toLowerCase().replace(/[-_]/g, '');
}

function ehContratoVenda(modelo: DocumentoModelo | null | undefined): boolean {
  if (!modelo || modelo.tipo !== 'contrato') return false;
  const codigo = normalizarCodigoDoc(modelo.codigo);
  if (codigo === 'contratovenda') return true;
  if (codigo.includes('compra')) return false;
  return /venda/i.test(modelo.titulo ?? '');
}

function ehTermoConscientizacao(modelo: DocumentoModelo | null | undefined): boolean {
  return !!modelo && normalizarCodigoDoc(modelo.codigo) === 'termoconscientizacao';
}

const FORMAS_PAGAMENTO_CONTRATO = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'avista', label: 'À vista' },
  { id: 'parcelado', label: 'Parcelado' },
  { id: 'acombinar', label: 'A combinar' },
] as const;

type FormaPagamentoContratoId = (typeof FORMAS_PAGAMENTO_CONTRATO)[number]['id'] | '';

@Component({
  selector: 'app-contratos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, EnderecoCampo, DocumentoCorpoEditor, DocumentoA4Preview],
  templateUrl: './contratos.html',
  styleUrl: './contratos.scss',
})
export class ContratosPage implements OnInit {
  @ViewChild(DocumentoCorpoEditor) corpoEditor?: DocumentoCorpoEditor;

  readonly tiposDoc = DOCUMENTO_TIPOS;
  aba: ContratosAba = 'emitir';
  carregando = false;
  salvando = false;
  erro = '';

  tiposVariavel: DocumentoVariavelTipo[] = [];
  catalogo: DocumentoVariavelCatalogo[] = [];
  modelos: DocumentoModelo[] = [];

  modeloEmitir: DocumentoModelo | null = null;
  valores: Record<string, string> = {};
  errosCampos: Record<string, string> = {};
  avisosCampos: Record<string, string> = {};
  enderecos: Record<string, BlingContatoEndereco> = {};
  readonly formasPagamentoContrato = FORMAS_PAGAMENTO_CONTRATO;
  readonly parcelasOpcoes = Array.from({ length: 23 }, (_, i) => i + 2);
  formaPagamentoOpcao: FormaPagamentoContratoId = '';
  parcelasPagamento = 2;
  garantiaItem6Meses = false;
  garantiaItemNome = '';

  modeloEditando: DocumentoModelo | null = null;
  novaVarChave = '';
  novaVarRotulo = '';
  novaVarTipo = 'texto';
  novaVarObrigatoria = true;
  catalogoPick = '';

  novaCatChave = '';
  novaCatRotulo = '';
  novaCatTipo = 'texto';
  editCat: DocumentoVariavelCatalogo | null = null;

  constructor(
    readonly appAuth: AppAuthService,
    private documentos: DocumentosService,
    private impressaoConfig: OsImpressaoConfigService,
    private osImpressao: OsImpressaoService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const aba = (params.get('aba') ?? 'emitir') as ContratosAba;
      this.definirAba(aba, false);
    });
    this.carregar();
  }

  get modelosAtivos(): DocumentoModelo[] {
    const grupos = new Map<string, DocumentoModelo[]>();
    for (const m of this.modelos) {
      if (!m.ativo || ehTermoConscientizacao(m)) continue;
      const chave = normalizarCodigoDoc(m.codigo) || m.id || m.titulo;
      const lista = grupos.get(chave) ?? [];
      lista.push(m);
      grupos.set(chave, lista);
    }
    return [...grupos.values()].map(lista =>
      lista.find(m => (m.codigo ?? '').includes('-')) ?? lista[0],
    );
  }

  get modeloTermoConscientizacao(): DocumentoModelo | undefined {
    return this.modelos.find(m => ehTermoConscientizacao(m) && m.ativo);
  }

  get anexaTermoConscientizacao(): boolean {
    return ehContratoVenda(this.modeloEmitir) && !!this.modeloTermoConscientizacao;
  }

  get camposEmitir(): DocumentoVariavel[] {
    return (this.modeloEmitir?.variaveis ?? []).filter(v => this.campoVisivel(v));
  }

  get textoPreview(): string {
    if (!this.modeloEmitir) return '';
    return preencherModelo(this.modeloEmitir, this.valoresParaDocumentos());
  }

  get corposExtrasPreview(): string[] {
    return this.corposAnexos(this.valoresParaDocumentos());
  }

  get rotuloImprimir(): string {
    if (this.anexaTermoConscientizacao) return 'Imprimir 3 folhas';
    if (this.modeloEmitir?.imprimirDuasVias) return 'Imprimir 2 vias';
    return 'Imprimir';
  }

  get rotuloPreview(): string {
    if (this.anexaTermoConscientizacao) return 'Pré-visualização A4 — 2 vias + termo da loja';
    if (this.modeloEmitir?.imprimirDuasVias) return 'Pré-visualização A4 — 2 vias';
    return 'Pré-visualização A4';
  }

  get catEdicao(): DocumentoVariavelCatalogo {
    return this.editCat!;
  }

  rotuloTipoDoc(tipo: string): string {
    return this.tiposDoc.find(t => t.id === tipo)?.rotulo ?? tipo;
  }

  ehModeloTermoConscientizacao(modelo: DocumentoModelo | null | undefined): boolean {
    return ehTermoConscientizacao(modelo);
  }

  tituloEmitir(modelo: DocumentoModelo): string {
    const titulo = (modelo.titulo ?? '').trim();
    if (/venda/i.test(titulo) || modelo.codigo === 'contrato-venda') {
      return 'Venda de celular seminovo';
    }
    if (/compra/i.test(titulo) || modelo.codigo === 'contrato-compra-venda') {
      return 'Compra de celular seminovo';
    }
    const tipo = this.rotuloTipoDoc(modelo.tipo);
    if (titulo.toLowerCase().startsWith(tipo.toLowerCase())) {
      return titulo.slice(tipo.length).replace(/^\s+(de\s+)?/i, '').trim() || titulo;
    }
    return titulo;
  }

  rotuloTipoVar(tipo: string): string {
    return this.tiposVariavel.find(t => t.id === tipo)?.rotulo ?? tipo;
  }

  placeholder(chave: string): string {
    return `{{${chave}}}`;
  }

  entradaVar(tipo: string): 'text' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'endereco' {
    if (tipo === 'paragrafo') return 'textarea';
    if (tipo === 'endereco') return 'endereco';
    if (tipo === 'numero') return 'number';
    if (tipo === 'data_hora') return 'datetime-local';
    if (tipo === 'data') return 'date';
    return 'text';
  }

  ehTipoEndereco(v: DocumentoVariavel): boolean {
    return v.tipo === 'endereco' && !ehEnderecoLoja(v.chave);
  }

  ehCampoImei(v: DocumentoVariavel): boolean {
    return v.tipo === 'imei' || /imei/i.test(v.chave ?? '');
  }

  ehCampoFormaPagamento(v: DocumentoVariavel): boolean {
    return v.chave === 'forma_pagamento';
  }

  ehCampoGarantiaItem(v: DocumentoVariavel): boolean {
    return v.chave === 'garantia_clausula_6_meses';
  }

  onGarantiaItemToggle(ativo: boolean): void {
    this.garantiaItem6Meses = ativo;
    if (!ativo) this.garantiaItemNome = '';
    this.sincronizarGarantiaItem();
  }

  onGarantiaItemNome(nome: string): void {
    this.garantiaItemNome = nome;
    this.sincronizarGarantiaItem();
  }

  onFormaPagamentoChange(id: string): void {
    this.formaPagamentoOpcao = (id as FormaPagamentoContratoId) || '';
    if (this.formaPagamentoOpcao !== 'parcelado') this.parcelasPagamento = 2;
    this.sincronizarFormaPagamento();
  }

  onParcelasChange(n: number | string): void {
    const qtd = Math.max(2, Math.min(24, Number(n) || 2));
    this.parcelasPagamento = qtd;
    this.sincronizarFormaPagamento();
  }

  campoVisivel(v: DocumentoVariavel): boolean {
    return !v.oculta && !campoDocumentoOculto(v.chave);
  }

  placeholderCampo(v: DocumentoVariavel): string {
    if (v.tipo === 'moeda') return '0,00';
    if (v.tipo === 'cpf') return 'CPF ou CNPJ';
    if (v.tipo === 'cnpj') return '00.000.000/0000-00';
    if (v.tipo === 'telefone') return '(00) 00000-0000';
    if (this.ehCampoImei(v)) return '000000000000000';
    return '';
  }

  enderecoDe(chave: string): BlingContatoEndereco {
    this.enderecos[chave] ??= {};
    return this.enderecos[chave];
  }

  onValorCampo(v: DocumentoVariavel, valor: string): void {
    if (v.tipo === 'cpf') this.valores[v.chave] = formatarCpfCnpj(valor);
    else if (v.tipo === 'cnpj') this.valores[v.chave] = formatarCnpj(valor);
    else if (v.tipo === 'telefone') this.valores[v.chave] = formatarTelefone(valor);
    else this.valores[v.chave] = valor;
    this.errosCampos[v.chave] = this.mensagemErroCampo(v, this.valores[v.chave], true);
    this.avisosCampos[v.chave] = this.mensagemAvisoCampo(v, this.valores[v.chave]);
  }

  onEndereco(chave: string, end: BlingContatoEndereco): void {
    this.enderecos[chave] = end;
  }

  onEnderecoLinha(v: DocumentoVariavel, linha: string): void {
    this.valores[v.chave] = linha;
    this.errosCampos[v.chave] = this.mensagemErroCampo(v, linha, true);
  }

  definirAba(aba: ContratosAba, atualizarRota = true): void {
    if ((aba === 'modelos' || aba === 'variaveis') && !this.appAuth.isAdmin()) {
      aba = 'emitir';
    }
    this.aba = aba;
    if (atualizarRota) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { aba },
        queryParamsHandling: 'merge',
      });
    }
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    forkJoin({
      tipos: this.documentos.tiposVariavel(),
      catalogo: this.documentos.listarCatalogo(),
      modelos: this.documentos.listarModelos(!this.appAuth.isAdmin()),
      impressao: this.impressaoConfig.carregar(),
    }).subscribe({
      next: ({ tipos, catalogo, modelos }) => {
        this.tiposVariavel = tipos;
        this.catalogo = catalogo;
        this.modelos = modelos;
        this.carregando = false;
        if (this.modeloEmitir?.id) {
          const atual = modelos.find(m => m.id === this.modeloEmitir?.id);
          if (atual) this.selecionarParaEmitir(atual);
        } else if (this.modelosAtivos.length === 1) {
          this.selecionarParaEmitir(this.modelosAtivos[0]);
        }
      },
      error: err => {
        this.carregando = false;
        this.erro = msgApi(err, 'Não foi possível carregar os documentos.');
      },
    });
  }

  selecionarParaEmitir(modelo: DocumentoModelo): void {
    this.modeloEmitir = modelo;
    this.errosCampos = {};
    this.avisosCampos = {};
    this.enderecos = {};
    this.formaPagamentoOpcao = '';
    this.parcelasPagamento = 2;
    this.garantiaItem6Meses = false;
    this.garantiaItemNome = '';
    const next: Record<string, string> = {};
    for (const v of modelo.variaveis ?? []) {
      let valor = this.valorPadrao(v);
      if (v.tipo === 'cpf') valor = formatarCpfCnpj(valor);
      else if (v.tipo === 'cnpj') valor = formatarCnpj(valor);
      else if (v.tipo === 'telefone') valor = formatarTelefone(valor);
      next[v.chave] = valor;
      if (this.ehTipoEndereco(v)) this.enderecos[v.chave] = {};
    }
    this.valores = next;
  }

  imprimir(): void {
    if (!this.modeloEmitir) return;
    const valores = this.valoresParaDocumentos();
    const erros = this.validarCampos(valores);
    this.errosCampos = erros;
    const primeiroErro = Object.values(erros).find(Boolean);
    if (primeiroErro) {
      avisarErroUsuario(primeiroErro);
      return;
    }
    const faltando = camposPendentes(this.modeloEmitir, valores);
    if (faltando.length) {
      avisarErroUsuario(
        `Preencha: ${faltando.map(v => v.rotulo).join(', ')}.`,
      );
      return;
    }
    const alertaImei = this.avisosImei(valores);
    if (alertaImei) avisarAvisoUsuario(alertaImei, 'IMEI');
    const html = montarHtmlDocumento(
      this.modeloEmitir.titulo,
      preencherModelo(this.modeloEmitir, valores),
      !!this.modeloEmitir.imprimirDuasVias,
      this.corposAnexos(valores),
    );
    this.osImpressao.abrirJanelaImpressao(html, this.modeloEmitir.titulo);
  }

  novoModelo(): void {
    this.modeloEditando = {
      tipo: 'contrato',
      titulo: '',
      corpo: '',
      ativo: true,
      imprimirDuasVias: false,
      ordem: 0,
      variaveis: [],
    };
  }

  editarModelo(modelo: DocumentoModelo): void {
    this.modeloEditando = {
      ...modelo,
      corpo: corpoDocumentoParaHtml(modelo.corpo),
      variaveis: (modelo.variaveis ?? []).map(v => ({ ...v })),
    };
  }

  cancelarEdicao(): void {
    this.modeloEditando = null;
  }

  salvarModelo(): void {
    if (!this.modeloEditando) return;
    const titulo = this.modeloEditando.titulo.trim();
    if (!titulo) {
      avisarErroUsuario('Informe o título do documento.');
      return;
    }
    if (corpoDocumentoVazio(this.modeloEditando.corpo)) {
      avisarErroUsuario('Informe o texto do documento.');
      return;
    }
    this.sincronizarVarsDoCorpo();
    this.salvando = true;
    const body = this.modeloEditando;
    const req = body.id
      ? this.documentos.atualizarModelo(body.id, body)
      : this.documentos.criarModelo(body);
    req.subscribe({
      next: salvo => {
        this.salvando = false;
        avisarSucessoUsuario('Documento salvo.');
        this.modeloEditando = null;
        this.carregar();
        if (this.modeloEmitir?.id === salvo.id) this.selecionarParaEmitir(salvo);
      },
      error: () => {
        this.salvando = false;
      },
    });
  }

  excluirModelo(modelo: DocumentoModelo): void {
    if (!modelo.id) return;
    if (!confirm(`Excluir o documento "${modelo.titulo}"?`)) return;
    this.documentos.excluirModelo(modelo.id).subscribe({
      next: () => {
        avisarSucessoUsuario('Documento excluído.');
        if (this.modeloEditando?.id === modelo.id) this.modeloEditando = null;
        if (this.modeloEmitir?.id === modelo.id) this.modeloEmitir = null;
        this.carregar();
      },
      error: () => undefined,
    });
  }

  adicionarVarDoCatalogo(): void {
    if (!this.modeloEditando || !this.catalogoPick) return;
    const cat = this.catalogo.find(c => c.chave === this.catalogoPick);
    if (!cat) return;
    this.incluirVar({
      chave: cat.chave,
      rotulo: cat.rotulo,
      tipo: cat.tipo,
      obrigatoria: true,
      ordem: this.modeloEditando.variaveis.length + 1,
    });
    this.catalogoPick = '';
  }

  adicionarVarManual(): void {
    if (!this.modeloEditando) return;
    const chave = this.novaVarChave.trim().toLowerCase().replace(/\s+/g, '_');
    if (!chave) {
      avisarErroUsuario('Informe a chave da variável (ex.: comprador_nome).');
      return;
    }
    this.incluirVar({
      chave,
      rotulo: this.novaVarRotulo.trim() || chave,
      tipo: this.novaVarTipo,
      obrigatoria: this.novaVarObrigatoria,
      ordem: this.modeloEditando.variaveis.length + 1,
    });
    this.novaVarChave = '';
    this.novaVarRotulo = '';
    this.novaVarTipo = 'texto';
    this.novaVarObrigatoria = true;
  }

  removerVar(chave: string): void {
    if (!this.modeloEditando) return;
    this.modeloEditando.variaveis = this.modeloEditando.variaveis.filter(v => v.chave !== chave);
  }

  inserirNoCorpo(chave: string): void {
    if (!this.modeloEditando) return;
    this.corpoEditor?.inserirTexto(`{{${chave}}}`);
  }

  previsualizarModelo(): void {
    if (!this.modeloEditando || corpoDocumentoVazio(this.modeloEditando.corpo)) {
      avisarErroUsuario('Escreva o documento para visualizar a impressão.');
      return;
    }
    const html = montarHtmlDocumento(
      this.modeloEditando.titulo || 'Documento',
      this.modeloEditando.corpo,
      !!this.modeloEditando.imprimirDuasVias,
    );
    this.osImpressao.abrirJanelaImpressao(html, this.modeloEditando.titulo || 'Documento');
  }

  criarCatalogo(): void {
    const chave = this.novaCatChave.trim().toLowerCase().replace(/\s+/g, '_');
    const rotulo = this.novaCatRotulo.trim();
    if (!chave || !rotulo) {
      avisarErroUsuario('Informe chave e rótulo da variável.');
      return;
    }
    this.salvando = true;
    this.documentos.criarCatalogo({
      chave,
      rotulo,
      tipo: this.novaCatTipo,
      ordem: 0,
    }).subscribe({
      next: () => {
        this.salvando = false;
        this.novaCatChave = '';
        this.novaCatRotulo = '';
        this.novaCatTipo = 'texto';
        avisarSucessoUsuario('Variável incluída no catálogo.');
        this.carregar();
      },
      error: () => {
        this.salvando = false;
      },
    });
  }

  comecarEditarCatalogo(item: DocumentoVariavelCatalogo): void {
    this.editCat = { ...item };
  }

  salvarCatalogo(): void {
    if (!this.editCat?.id) return;
    this.salvando = true;
    this.documentos.atualizarCatalogo(this.editCat.id, {
      chave: this.editCat.chave,
      rotulo: this.editCat.rotulo,
      tipo: this.editCat.tipo,
      ordem: this.editCat.ordem,
    }).subscribe({
      next: () => {
        this.salvando = false;
        this.editCat = null;
        avisarSucessoUsuario('Variável atualizada.');
        this.carregar();
      },
      error: () => {
        this.salvando = false;
      },
    });
  }

  excluirCatalogo(item: DocumentoVariavelCatalogo): void {
    if (!item.id) return;
    if (!confirm(`Excluir a variável {{${item.chave}}} do catálogo? Os documentos já salvos não mudam.`)) return;
    this.documentos.excluirCatalogo(item.id).subscribe({
      next: () => {
        avisarSucessoUsuario('Variável excluída do catálogo.');
        this.carregar();
      },
      error: () => undefined,
    });
  }

  private incluirVar(variavel: DocumentoVariavel): void {
    if (!this.modeloEditando) return;
    if (this.modeloEditando.variaveis.some(v => v.chave === variavel.chave)) {
      avisarErroUsuario('Essa variável já está neste documento.');
      return;
    }
    this.modeloEditando.variaveis = [...this.modeloEditando.variaveis, variavel];
  }

  private sincronizarVarsDoCorpo(): void {
    if (!this.modeloEditando) return;
    const re = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
    const corpo = this.modeloEditando.corpo;
    let m: RegExpExecArray | null;
    while ((m = re.exec(corpo))) {
      const chave = m[1].toLowerCase();
      if (this.modeloEditando.variaveis.some(v => v.chave === chave)) continue;
      const cat = this.catalogo.find(c => c.chave === chave);
      this.modeloEditando.variaveis.push({
        chave,
        rotulo: cat?.rotulo ?? chave,
        tipo: cat?.tipo ?? 'texto',
        obrigatoria: true,
        ordem: this.modeloEditando.variaveis.length + 1,
      });
    }
  }

  private valorPadrao(v: DocumentoVariavel): string {
    if (v.chave === 'compradora_razao_social') {
      return 'MUNDO SMART ASSISTÊNCIA E ELETRÔNICOS LTDA';
    }
    if (v.chave === 'compradora_cnpj') return formatarCnpj('66.813.903/0001-08');
    const empresa = this.impressaoConfig.empresaAtual();
    if (v.chave === 'compradora_endereco' || v.chave === 'vendedor_endereco') {
      return (empresa.enderecoEmpresa || '').trim()
        || 'Rua Quinze de Novembro, 398 - Centro, Mococa - SP, 13730-020';
    }
    if (v.chave === 'compradora_representante') return 'Rômulo Emanuel Longo Perlotti';
    if (v.chave === 'compradora_representante_cargo') return 'Sócio-Administrador';
    if (v.chave === 'compradora_representante_cpf') return formatarCpf('332.162.448-65');
    if (v.chave === 'vendedor_nome') {
      return (empresa.nomeEmpresa || '').trim()
        || 'MUNDO SMART ASSISTÊNCIA E ELETRÔNICOS LTDA';
    }
    if (v.chave === 'vendedor_cnpj') {
      return formatarCnpj(empresa.cnpjEmpresa || '66.813.903/0001-08');
    }
    if (v.chave === 'vendedor_telefone') {
      return formatarTelefone(empresa.telefoneEmpresa || '19989387457');
    }
    if (v.chave === 'cidade' || v.chave === 'foro') return 'Mococa/SP';
    if (v.chave === 'estado_aparelho') return 'SEMINOVO';
    if (v.tipo === 'data' || v.tipo === 'data_hora' || v.chave === 'data') return agoraLocalIso();
    return '';
  }

  private valoresComAutomaticos(): Record<string, string> {
    const next = { ...this.valores };
    for (const v of this.modeloEmitir?.variaveis ?? []) {
      if (!this.campoVisivel(v)) next[v.chave] = this.valorPadrao(v);
    }
    if (this.camposEmitir.some(v => this.ehCampoGarantiaItem(v))) {
      next['garantia_clausula_6_meses'] = this.textoGarantiaItem();
    }
    return next;
  }

  private valoresParaDocumentos(): Record<string, string> {
    const next = this.valoresComAutomaticos();
    const termo = this.modeloTermoConscientizacao;
    if (!this.anexaTermoConscientizacao || !termo) return next;
    for (const v of termo.variaveis ?? []) {
      if (!(next[v.chave] ?? '').trim()) next[v.chave] = this.valorPadrao(v);
    }
    return next;
  }

  private corposAnexos(valores: Record<string, string>): string[] {
    if (!this.anexaTermoConscientizacao || !this.modeloTermoConscientizacao) return [];
    return [preencherModelo(this.modeloTermoConscientizacao, valores)];
  }

  private validarCampos(valores: Record<string, string>): Record<string, string> {
    const erros: Record<string, string> = {};
    for (const v of this.camposEmitir) {
      const msg = this.mensagemErroCampo(v, valores[v.chave]);
      if (msg) erros[v.chave] = msg;
    }
    return erros;
  }

  private mensagemErroCampo(v: DocumentoVariavel, valor: string | undefined, rascunho = false): string {
    const atual = (valor ?? '').trim();
    const digitos = apenasDigitos(atual);
    if (v.tipo === 'cpf') {
      if (!atual) return !rascunho && v.obrigatoria ? 'Informe o CPF ou CNPJ.' : '';
      if (digitos.length < 11) return rascunho ? '' : 'CPF ou CNPJ incompleto.';
      if (digitos.length === 11) return validarCpf(atual) ? '' : 'CPF inválido.';
      if (digitos.length < 14) return rascunho ? '' : 'CNPJ incompleto.';
      return validarCnpj(atual) ? '' : 'CNPJ inválido.';
    }
    if (v.tipo === 'cnpj') {
      if (!atual) return !rascunho && v.obrigatoria ? 'Informe o CNPJ.' : '';
      if (digitos.length < 14) return rascunho ? '' : 'CNPJ incompleto.';
      return validarCnpj(atual) ? '' : 'CNPJ inválido.';
    }
    if (v.tipo === 'telefone') {
      if (!atual) return !rascunho && v.obrigatoria ? 'Informe o telefone.' : '';
      if (digitos.length < 10) return rascunho ? '' : 'Telefone incompleto.';
      return ehTelefoneValido(atual)
        ? ''
        : 'Telefone inválido. Use celular (11 dígitos) ou fixo (10 dígitos) com DDD.';
    }
    if (v.tipo === 'endereco' || this.ehTipoEndereco(v)) {
      if (!v.obrigatoria) return '';
      if (rascunho && !atual) return '';
      return enderecoMinimoPreenchido(this.enderecos[v.chave])
        ? ''
        : 'Informe o endereço (CEP ou logradouro e município).';
    }
    if (this.ehCampoFormaPagamento(v)) {
      if (!this.formaPagamentoOpcao) {
        return !rascunho && v.obrigatoria ? 'Informe a forma de pagamento.' : '';
      }
      if (this.formaPagamentoOpcao === 'parcelado' && this.parcelasPagamento < 2) {
        return rascunho ? '' : 'Informe em quantas vezes será parcelado.';
      }
      return '';
    }
    if (this.ehCampoGarantiaItem(v)) {
      if (this.garantiaItem6Meses && !this.garantiaItemNome.trim()) {
        return rascunho ? '' : 'Informe o item com garantia de 6 meses.';
      }
      return '';
    }
    return '';
  }

  private sincronizarGarantiaItem(): void {
    this.valores['garantia_clausula_6_meses'] = this.textoGarantiaItem();
    const campo = this.camposEmitir.find(v => this.ehCampoGarantiaItem(v));
    if (campo) {
      this.errosCampos[campo.chave] = this.mensagemErroCampo(campo, this.valores[campo.chave], true);
    }
  }

  private textoGarantiaItem(): string {
    const item = this.garantiaItemNome.trim();
    if (!this.garantiaItem6Meses || !item) return '';
    return (
      '6.3. CONDIÇÃO ESPECÍFICA DE GARANTIA ESTENDIDA: Fica concedida garantia estendida de 6 (seis) meses ' +
      `exclusivamente para o componente ${item} em virtude de substituição/troca recente realizada pela VENDEDORA.`
    );
  }

  private mensagemAvisoCampo(v: DocumentoVariavel, valor: string | undefined): string {
    if (!this.ehCampoImei(v)) return '';
    return mensagemAlertaImei(valor);
  }

  private avisosImei(valores: Record<string, string>): string {
    return this.camposEmitir
      .filter(v => this.ehCampoImei(v))
      .map(v => this.mensagemAvisoCampo(v, valores[v.chave]))
      .find(Boolean) ?? '';
  }

  private sincronizarFormaPagamento(): void {
    this.valores['forma_pagamento'] = this.textoFormaPagamento();
    const campo = this.camposEmitir.find(v => this.ehCampoFormaPagamento(v));
    if (campo) {
      this.errosCampos[campo.chave] = this.mensagemErroCampo(campo, this.valores[campo.chave], true);
    }
  }

  private textoFormaPagamento(): string {
    if (this.formaPagamentoOpcao === 'dinheiro') return 'Dinheiro';
    if (this.formaPagamentoOpcao === 'avista') return 'À vista';
    if (this.formaPagamentoOpcao === 'acombinar') return 'A combinar';
    if (this.formaPagamentoOpcao === 'parcelado') {
      return `Parcelado em ${this.parcelasPagamento}x`;
    }
    return '';
  }
}

function msgApi(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error?.erro ?? err.error?.message ?? '').toString().trim();
    if (msg) return msg;
  }
  return fallback;
}
