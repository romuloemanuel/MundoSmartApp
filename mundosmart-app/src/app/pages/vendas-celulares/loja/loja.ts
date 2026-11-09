import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as QRCode from 'qrcode';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClienteAutocomplete } from '../../../components/cliente-autocomplete/cliente-autocomplete';
import { NovoClienteModal } from '../../../components/novo-cliente-modal/novo-cliente-modal';
import { AutocompleteCriavel, AutocompleteItem } from '../../../components/autocomplete-criavel/autocomplete-criavel';
import { EditarAparelhoLojaModal } from './editar-aparelho-loja-modal';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import { AparelhosService } from '../../../services/aparelhos';
import { AppAuthService } from '../../../services/app-auth';
import {
  AparelhoCadeiaItem,
  AparelhoCadeiaPasso,
  AparelhoCadeiaUnidade,
  AparelhoLojaItem,
  AparelhoMovimentoLinha,
  AparelhoLojaPainel,
  AparelhoLojaService,
  AparelhoOperacao,
  AparelhoVendedorCadastro,
  AparelhoVendedorResumo,
  OsAbertaConsulta,
} from '../../../services/aparelho-loja.service';
import { avisarAvisoUsuario, avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import { OsImpressaoService } from '../../../services/os-impressao.service';
import { OS_IMPRESSAO_PADRAO_POS_CADASTRO } from '../../../config/os-impressao.config';
import { BlingContato, BlingContatoRef, BlingOrdemServico, MarcaAparelho, ModeloAparelho } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA } from '../../../config/aparelhos.config';
import { modeloParaAutocomplete } from '../../../utils/modelo-autocomplete.util';
import { apenasDigitos, formatarCpfCnpj, formatarTelefone } from '../../../utils/contato-validacao';
import { mensagemAlertaImei } from '../../../utils/imei.util';
import {
  guardarRascunhoContrato,
  limparRascunhoContrato,
  moedaContrato,
  RascunhoContrato,
} from '../../../utils/rascunho-contrato.util';
import {
  carregarCalculoJurosConfig,
  formatarTaxaPct,
  gerarOpcoesParcelas,
  OpcaoParcela,
} from '../../../config/calculo-juros.config';

type Modo = 'compra' | 'venda' | 'troca';
type TelaLoja = Modo | 'estoque' | 'transacoes' | 'financeiro';
type VisaoTransacoes = 'lista' | 'cadeia';
type PeriodoDias = 7 | 14 | 30 | 90;
interface LucroVendas {
  quantidade: number;
  valor: number;
  custo: number;
  lucro: number;
  percentual: number | null;
  valorMedio: number | null;
}
type FormaNegociacao = 'avista' | 'cartao' | 'avista_cartao' | 'payjoy' | 'paymobi' | 'crefaz' | 'outra';

interface NegociacaoForm {
  forma: FormaNegociacao;
  financiadoraNome: string;
  entrada: number | null;
  repasse: number | null;
}

function negociacaoVazia(): NegociacaoForm {
  return { forma: 'avista', financiadoraNome: '', entrada: null, repasse: null };
}

interface FichaEntrada {
  id: number;
  marcaId: string;
  modelos: ModeloAparelho[];
  carregando: boolean;
  modelo: AutocompleteItem | null;
  corLista: string;
  dados: {
    imei: string;
    cor: string;
    configuracao: string;
    condicao: string;
    observacoes: string;
    alertaPermanente: string;
    saudeBateria: number | null;
    bateriaPerfeita: '' | 'sim' | 'nao';
    pecas: { nome: string; apareceMensagem: boolean }[];
    passaPorAssistencia: boolean;
    osNumero: string;
    valorVenda: number | null;
    valorMinimoVenda: number | null;
  };
  valorAvaliado: number | null;
  testes: { nome: string; ok: boolean }[];
  fotos: File[];
  videos: File[];
  qrAberto: boolean;
  qrDataUrl: string;
  sessaoToken: string;
  fotosSessao: { id: string; url: string; tipo?: string }[];
  osConsulta: OsAbertaConsulta | null;
  osBuscando: boolean;
  buscaOs?: ReturnType<typeof setTimeout>;
  buscarModelo: (termo: string) => Observable<AutocompleteItem[]>;
}

@Component({
  selector: 'app-aparelhos-loja',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ClienteAutocomplete,
    NovoClienteModal,
    AutocompleteCriavel,
    EditarAparelhoLojaModal,
    GridAcao,
    GridPaginator,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>{{ tituloTela }}</h2>
        <a *ngIf="tela !== 'estoque'" routerLink="/vendas-celulares/estoque">Voltar para o estoque</a>
      </div>
      <p class="hint">{{ dicaTela }}</p>
      <div class="modos" *ngIf="tela === 'estoque'">
        <a routerLink="/vendas-celulares/compra">
          <strong>Compra</strong>
          <span>A loja recebe um aparelho</span>
        </a>
        <a routerLink="/vendas-celulares/venda">
          <strong>Venda</strong>
          <span>O cliente leva um aparelho do estoque</span>
        </a>
        <a routerLink="/vendas-celulares/troca">
          <strong>Troca</strong>
          <span>Entra um ou dois aparelhos e sai outro</span>
        </a>
      </div>
      <div class="codigo-banner" *ngIf="codigosRecem.length">
        <p>Escreva este código nas costas do aparelho</p>
        <div *ngFor="let c of codigosRecem">
          <strong>{{ c.codigo }}</strong>
          <span>{{ c.nome }}</span>
        </div>
      </div>
      <p class="hint" *ngIf="financeiro">
        Valor de estoque e o dinheiro que entrou e saiu. Esta parte fica só para administrador.
        A transação de uma troca segue até o último aparelho ser vendido.
      </p>

      <div class="cards" *ngIf="painel && financeiro">
        <div class="card">
          <span>Valor de estoque</span>
          <strong>{{ dinheiro(painel.resumo.custoEstoque) }}</strong>
          <small>{{ textoDisponiveis(painel.resumo.emEstoque) }}<ng-container *ngIf="painel.resumo.emAssistencia"> · {{ painel.resumo.emAssistencia }} na assistência</ng-container></small>
        </div>
        <div class="card">
          <span>Dinheiro que entrou</span>
          <strong>{{ dinheiro(painel.resumo.dinheiroRecebido) }}</strong>
          <small>Vendas e diferenças de troca</small>
        </div>
        <div class="card">
          <span>Dinheiro que saiu</span>
          <strong>{{ dinheiro(painel.resumo.dinheiroPago) }}</strong>
          <small>Compras e trocas em que a loja paga</small>
        </div>
        <div class="card">
          <span>Saldo de caixa</span>
          <strong>{{ dinheiro(painel.resumo.saldoCaixa) }}</strong>
          <small>{{ painel.resumo.compras }} compras · {{ painel.resumo.vendas }} vendas · {{ painel.resumo.trocas }} trocas</small>
        </div>
        <div class="card">
          <span>Peças no custo dos aparelhos</span>
          <strong>{{ dinheiro(painel.resumo.custoPecas) }}</strong>
          <small>Soma da assistência técnica ao custo de cada celular</small>
        </div>
        <div class="card" *ngIf="lucroVendasAdmin as lucro">
          <span>Lucro bruto dos vendidos</span>
          <strong [class.valor-positivo]="lucro.lucro >= 0" [class.valor-negativo]="lucro.lucro < 0">{{ dinheiro(lucro.lucro) }}</strong>
          <small>{{ lucro.quantidade }} {{ lucro.quantidade === 1 ? 'aparelho vendido' : 'aparelhos vendidos' }} · custo {{ dinheiro(lucro.custo) }}</small>
        </div>
        <div class="card" *ngIf="lucroVendasAdmin as lucro">
          <span>Percentual de lucro bruto</span>
          <strong [class.valor-positivo]="(lucro.percentual ?? 0) >= 0" [class.valor-negativo]="(lucro.percentual ?? 0) < 0">{{ percentual(lucro.percentual) }}</strong>
          <small>Custo do celular mais o custo das peças, menos o valor vendido</small>
        </div>
      </div>

      <h3 class="secao" *ngIf="financeiro">Por mês</h3>
      <p class="hint" *ngIf="financeiro">
        Cada linha é um aparelho. O mês junta o dinheiro daquelas compras, trocas e vendas, sem repetir o valor quando vários aparelhos saem da mesma troca.
      </p>
      <p class="hint" *ngIf="financeiro && !meses.length">Nenhuma unidade para o mês.</p>
      <ng-container *ngIf="financeiro">
      <section class="mes" *ngFor="let m of meses">
        <h3>{{ m.rotulo }}</h3>
        <p class="sub">
          Entrou {{ dinheiro(m.dinheiroEntrou) }}
          · saiu {{ dinheiro(m.dinheiroSaiu) }}
          · resultado {{ dinheiro(m.resultado) }}
          · {{ m.unidades.length }} {{ m.unidades.length === 1 ? 'unidade' : 'unidades' }}
        </p>
        <table class="data-grid">
          <thead>
            <tr>
              <th>Data</th>
              <th>Aparelho</th>
              <th>IMEI</th>
              <th>Movimento</th>
              <th>Valor</th>
              <th>Transação</th>
              <th>Resultado da transação</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let u of m.unidades">
              <tr>
                <td>{{ dataCurta(u.data) }}</td>
                <td>{{ u.nome }}</td>
                <td>{{ u.imei }}</td>
                <td>{{ rotuloMovimento(u.movimento) }}</td>
                <td>{{ dinheiro(u.valor) }}</td>
                <td>
                  <button type="button" class="link" (click)="alternarUnidade(u)">{{ u.cadeiaTitulo }}</button>
                </td>
                <td>
                  {{ dinheiro(u.resultadoCadeia) }}
                  <span class="sub">{{ u.cadeiaAberta ? 'até agora' : 'lucro final' }}</span>
                </td>
              </tr>
              <tr *ngIf="unidadeAberta === chaveUnidade(u)">
                <td colspan="7">
                  <ng-container *ngIf="passoDaUnidade(u) as p">
                    <ng-container *ngTemplateOutlet="fichaPasso; context: { passo: p }"></ng-container>
                  </ng-container>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </section>
      </ng-container>

      <h3 class="secao" *ngIf="financeiro">Transações</h3>
      <p class="hint" *ngIf="financeiro">
        Cada linha junta a compra, as trocas e as vendas dos aparelhos que saíram uns dos outros.
        Enquanto ainda houver aparelho na loja, o valor é o resultado até agora: o dinheiro das trocas e das vendas, sem contar a compra.
        O lucro final aparece quando não resta nenhum aparelho, e desconta a compra e o custo das peças.
      </p>
      <p class="hint" *ngIf="financeiro && !cadeias.length">Nenhuma venda ou troca para acompanhar.</p>
      <ng-container *ngIf="financeiro">
      <article class="cadeia" *ngFor="let c of cadeias" [class.aberta]="c.aberta" [class.fechada]="!c.aberta">
        <button type="button" class="cadeia-topo" (click)="alternarCadeia(c.id)">
          <strong>{{ c.titulo }}</strong>
          <span>{{ c.aberta ? 'Em andamento' : 'Concluída' }}</span>
          <span *ngIf="c.aberta">Até agora {{ dinheiro(c.resultadoAteAgora) }}</span>
          <span *ngIf="!c.aberta">Lucro {{ dinheiro(c.lucroFinal) }}</span>
        </button>
        <p class="sub" *ngIf="c.aberta && c.pendentes.length">Falta vender: {{ c.pendentes.join(', ') }}</p>
        <p class="sub">
          Comercializado na entrada {{ dinheiro(c.valorEntrada) }}
          · na saída {{ dinheiro(c.valorSaida) }}
        </p>
        <p class="sub">
          Dinheiro que entrou {{ dinheiro(c.dinheiroEntrou) }}
          · dinheiro que saiu {{ dinheiro(c.dinheiroSaiu) }}
          <span *ngIf="c.custoPecas"> · peças {{ dinheiro(c.custoPecas) }}</span>
        </p>
        <div class="passos" *ngIf="cadeiaAberta === c.id">
          <div class="passo" *ngFor="let p of c.passos">
            <ng-container *ngTemplateOutlet="fichaPasso; context: { passo: p }"></ng-container>
          </div>
        </div>
      </article>
      </ng-container>

      <ng-template #fichaPasso let-p="passo">
        <div class="ficha-passo">
          <p>
            <strong>{{ p.data | date:'dd/MM/yyyy HH:mm':'UTC' }}</strong>
            · {{ rotuloTipo(p.tipo) }}
            <span *ngIf="p.vendedorNome"> · {{ p.vendedorNome }}</span>
          </p>
          <div class="lado">
            <h4>Cliente</h4>
            <p>{{ p.clienteNome || p.pessoa || '—' }}</p>
            <p class="sub" *ngIf="p.clienteCpf">{{ formatarDoc(p.clienteCpf) }}</p>
            <p class="sub" *ngIf="p.clienteTelefone">{{ formatarFone(p.clienteTelefone) }}</p>
            <p class="sub" *ngIf="p.clienteEmail">{{ p.clienteEmail }}</p>
            <p class="sub" *ngIf="p.clienteEndereco">{{ p.clienteEndereco }}</p>
            <p class="sub" *ngIf="p.forma && p.forma !== 'avista'">
              {{ rotuloForma(p.forma) }}<span *ngIf="p.financiadora"> · {{ p.financiadora }}</span>
            </p>
          </div>
          <div class="lado" *ngIf="p.saiu.length">
            <h4>Foi embora</h4>
            <div *ngFor="let a of p.saiu">
              <strong>{{ a.nome }}</strong>
              <p class="sub" *ngIf="fichaAparelho(a)">{{ fichaAparelho(a) }}</p>
              <p class="sub" *ngIf="a.imei">IMEI {{ a.imei }}</p>
              <p class="sub">Valor {{ dinheiro(a.valor) }}<span *ngIf="a.custo"> · custo {{ dinheiro(a.custo) }}</span></p>
            </div>
          </div>
          <div class="lado" *ngIf="p.entrou.length">
            <h4>Entrou</h4>
            <div *ngFor="let a of p.entrou">
              <strong>{{ a.nome }}</strong>
              <p class="sub" *ngIf="fichaAparelho(a)">{{ fichaAparelho(a) }}</p>
              <p class="sub" *ngIf="a.imei">IMEI {{ a.imei }}</p>
              <p class="sub">Valor {{ dinheiro(a.valor) }}<span *ngIf="a.custo"> · custo {{ dinheiro(a.custo) }}</span></p>
            </div>
          </div>
          <p>{{ rotuloEtapa(p) }} {{ dinheiro(valorEtapa(p)) }}</p>
        </div>
      </ng-template>

      <h3 *ngIf="vendedores.length && financeiro">Por vendedor</h3>
      <table class="data-grid" *ngIf="vendedores.length && financeiro">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Entradas</th>
            <th>Vendas</th>
            <th>Trocas</th>
            <th>Entrou R$</th>
            <th>Saiu R$</th>
            <th>Peças</th>
            <th>Mão de obra</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let v of vendedores">
            <td>{{ v.nome }}</td>
            <td>{{ v.entradas }}</td>
            <td>{{ v.vendas }}</td>
            <td>{{ v.trocas }}</td>
            <td>{{ dinheiro(v.dinheiroRecebido) }}</td>
            <td>{{ dinheiro(v.dinheiroPago) }}</td>
            <td>{{ dinheiro(v.custoPecas) }}</td>
            <td>{{ dinheiro(v.custoMaoDeObra) }}</td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="erro" class="erro">{{ erro }}</p>

      <ng-container *ngIf="tela === 'transacoes'">
        <div class="filtros-periodo">
          <button type="button" *ngFor="let p of periodos" [class.ativo]="periodoDias === p.dias" (click)="escolherPeriodo(p.dias)">{{ p.nome }}</button>
        </div>
        <p class="hint">Clique no vendedor para ver só o resultado dele neste período.</p>
        <table class="data-grid" *ngIf="resultadosPorVendedor.length">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Compras</th>
              <th>Vendas</th>
              <th>Trocas</th>
              <th *ngIf="isAdmin">Entrou</th>
              <th *ngIf="isAdmin">Saiu</th>
              <th *ngIf="isAdmin">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let v of resultadosPorVendedor"
              class="clicavel"
              [class.selecionada]="buscaVendedor === v.nome"
              (click)="escolherVendedor(v.nome)"
            >
              <td>{{ v.nome }}</td>
              <td>{{ v.compras }}</td>
              <td>{{ v.vendas }}</td>
              <td>{{ v.trocas }}</td>
              <td *ngIf="isAdmin">{{ dinheiro(v.entrou) }}</td>
              <td *ngIf="isAdmin">{{ dinheiro(v.saiu) }}</td>
              <td *ngIf="isAdmin" [class.valor-positivo]="v.resultado >= 0" [class.valor-negativo]="v.resultado < 0">{{ dinheiro(v.resultado) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="cards" *ngIf="resumoVendedor as r">
          <div class="card">
            <span>{{ r.nome }}</span>
            <strong>{{ r.vendas }} {{ r.vendas === 1 ? 'venda' : 'vendas' }}</strong>
            <small>{{ r.trocas }} {{ r.trocas === 1 ? 'troca' : 'trocas' }} · {{ r.compras }} {{ r.compras === 1 ? 'compra' : 'compras' }}</small>
          </div>
          <div class="card" *ngIf="isAdmin">
            <span>Dinheiro que entrou</span>
            <strong class="valor-positivo">{{ dinheiro(r.entrou) }}</strong>
            <small>Vendas e diferenças a favor da loja</small>
          </div>
          <div class="card" *ngIf="isAdmin">
            <span>Dinheiro que saiu</span>
            <strong class="valor-negativo">{{ dinheiro(r.saiu) }}</strong>
            <small>Compras e diferenças pagas ao cliente</small>
          </div>
          <div class="card" *ngIf="isAdmin">
            <span>Resultado</span>
            <strong [class.valor-positivo]="r.resultado >= 0" [class.valor-negativo]="r.resultado < 0">{{ dinheiro(r.resultado) }}</strong>
            <small>Neste período</small>
          </div>
        </div>
        <div class="cards" *ngIf="isAdmin && lucroVendasPeriodo as lucro">
          <div class="card">
            <span>Valor médio por aparelho vendido</span>
            <strong>{{ lucro.valorMedio == null ? '—' : dinheiro(lucro.valorMedio) }}</strong>
            <small>{{ lucro.quantidade }} {{ lucro.quantidade === 1 ? 'venda neste recorte' : 'vendas neste recorte' }} · total {{ dinheiro(lucro.valor) }}</small>
          </div>
          <div class="card">
            <span>Percentual médio de lucro bruto</span>
            <strong [class.valor-positivo]="(lucro.percentual ?? 0) >= 0" [class.valor-negativo]="(lucro.percentual ?? 0) < 0">{{ percentual(lucro.percentual) }}</strong>
            <small>Custo do celular mais as peças, menos o valor vendido, dividido pelo valor vendido. Resultado {{ dinheiro(lucro.lucro) }}.</small>
          </div>
        </div>
        <div class="modos visoes">
          <button type="button" [class.ativo]="visaoTransacoes === 'lista'" (click)="visaoTransacoes = 'lista'">
            <strong>Transações</strong>
            <span>Uma linha por negócio. Troca com um ou dois aparelhos fica agrupada.</span>
          </button>
          <button type="button" [class.ativo]="visaoTransacoes === 'cadeia'" (click)="abrirVisaoCadeia()">
            <strong>Cadeia da troca</strong>
            <span>Do aparelho inicial até o último sair da loja.</span>
          </button>
        </div>

        <ng-container *ngIf="visaoTransacoes === 'lista'">
          <div class="busca-estoque busca-transacoes">
            <div class="form-group">
              <label>Código</label>
              <input [(ngModel)]="filtroCodigoTx" (ngModelChange)="resetPaginaTransacoes()" name="filtroCodigoTx" placeholder="U1 ou 1" />
            </div>
            <div class="form-group">
              <label>Data</label>
              <input type="date" [(ngModel)]="filtroDataTx" (ngModelChange)="resetPaginaTransacoes()" name="filtroDataTx" />
            </div>
            <div class="form-group">
              <label>Tipo</label>
              <select [(ngModel)]="filtroTipoTx" (ngModelChange)="resetPaginaTransacoes()" name="filtroTipoTx">
                <option value="">Todos</option>
                <option value="compra">Compra</option>
                <option value="troca">Troca</option>
                <option value="venda">Venda</option>
              </select>
            </div>
            <div class="form-group">
              <label>Vendedor</label>
              <select [(ngModel)]="buscaVendedor" (ngModelChange)="resetPaginaTransacoes()" name="filtroVendedorTx">
                <option value="">Todos</option>
                <option *ngFor="let v of vendedoresCadastrados; trackBy: trackVendedor" [value]="v.nome">{{ v.nome }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Modelo</label>
              <input [(ngModel)]="filtroModeloTx" (ngModelChange)="resetPaginaTransacoes()" name="filtroModeloTx" placeholder="ip 11, sm a54…" />
            </div>
            <div class="form-group">
              <label>Valor de</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="filtroValorDeTx" (ngModelChange)="resetPaginaTransacoes()" name="filtroValorDeTx" />
            </div>
            <div class="form-group">
              <label>Valor até</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="filtroValorAteTx" (ngModelChange)="resetPaginaTransacoes()" name="filtroValorAteTx" />
            </div>
          </div>
          <p class="hint" *ngIf="!carregando && !transacoesFiltradas.length">Nenhuma transação com esse filtro.</p>
          <app-grid-paginator
            *ngIf="transacoesFiltradas.length"
            [total]="transacoesFiltradas.length"
            [page]="gridTransacoes.page"
            [pageSize]="gridTransacoes.pageSize"
            (pageChange)="gridTransacoes.onPageChange($event)"
            (pageSizeChange)="gridTransacoes.onPageSizeChange($event)"
          />
          <table class="data-grid" *ngIf="transacoesPaginadas.length">
            <thead>
              <tr>
                <th>Código</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Vendedor</th>
                <th>Pessoa</th>
                <th>Aparelhos</th>
                <th>Valor</th>
                <th *ngIf="isAdmin">Caixa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let op of transacoesPaginadas" [class.estornada]="op.status === 'estornada'">
                <td class="codigo-celula">{{ codigosTransacao(op) }}</td>
                <td>{{ op.data | date:'dd/MM/yyyy HH:mm':'UTC' }}</td>
                <td>
                  {{ rotuloTipo(op.tipo) }}
                  <div class="sub" *ngIf="op.status === 'estornada'">Desfeita</div>
                </td>
                <td>{{ op.vendedorNome || '—' }}</td>
                <td>
                  {{ op.clienteNome || op.fornecedorNome || '—' }}
                </td>
                <td>
                  <div class="grupo-aparelhos" *ngFor="let a of aparelhosSaiu(op)">
                    <span class="valor-negativo">− {{ dinheiro(a.valor) }}</span>
                    <span>saiu {{ textoAparelhoGrupo(a) }}</span>
                  </div>
                  <div class="grupo-aparelhos" *ngFor="let a of aparelhosEntrou(op)">
                    <span class="valor-positivo">+ {{ dinheiro(a.valor) }}</span>
                    <span>entrou {{ textoAparelhoGrupo(a) }}</span>
                  </div>
                  <div class="sub" *ngIf="!aparelhosSaiu(op).length && !aparelhosEntrou(op).length">
                    {{ op.saidaResumo || op.entradaResumo || '—' }}
                  </div>
                </td>
                <td>{{ valorTransacao(op) ? dinheiro(valorTransacao(op)) : '—' }}</td>
                <td *ngIf="isAdmin">
                  <div class="valor-positivo" *ngIf="op.dinheiroRecebido">+ {{ dinheiro(op.dinheiroRecebido) }}</div>
                  <div class="valor-negativo" *ngIf="op.dinheiroPago">− {{ dinheiro(op.dinheiroPago) }}</div>
                  <div class="sub" *ngIf="!op.dinheiroRecebido && !op.dinheiroPago">Sem dinheiro</div>
                </td>
                <td>
                  <button type="button" class="link" (click)="abrirCadeiaDaOperacao(op)">Ver cadeia</button>
                  <button type="button" class="secundario" *ngIf="op.podeEstornar" [disabled]="salvando" (click)="estornar(op)">Desfazer</button>
                  <button type="button" class="perigo" *ngIf="isAdmin && (op.podeEstornar || op.status === 'estornada')" [disabled]="salvando" (click)="excluirOperacao(op)">Excluir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </ng-container>

        <ng-container *ngIf="visaoTransacoes === 'cadeia'">
          <div class="form-group" style="max-width: 420px">
            <label>Abrir um aparelho</label>
            <input [ngModel]="buscaCadeia" (ngModelChange)="onBuscaCadeia($event)" name="buscaCadeia" placeholder="Código, IMEI ou modelo" />
          </div>
          <p class="hint">Cada bloco junta a compra, as trocas e a venda daquele aparelho. O que saiu fica negativo; o que entrou, positivo.</p>
          <p class="hint" *ngIf="avisoCadeia">{{ avisoCadeia }}</p>
          <p class="hint" *ngIf="!carregando && !avisoCadeia && !cadeiasDoPeriodo.length">Nenhuma cadeia neste período{{ buscaVendedor ? ' para este vendedor' : '' }}. Cadeia só existe depois de uma troca ou venda.</p>
          <p class="hint" *ngIf="buscaCadeia.trim() && !avisoCadeia && !cadeiasDoPeriodo.length">Esse aparelho ainda não gerou troca nem venda.</p>
          <article class="cadeia" *ngFor="let c of cadeiasDoPeriodo" [attr.id]="'cadeia-' + c.id" [class.aberta]="c.aberta" [class.fechada]="!c.aberta" [class.focada]="cadeiaAberta === c.id">
            <div class="cadeia-topo">
              <strong>{{ c.titulo }}</strong>
              <span>{{ c.aberta ? 'Ainda tem aparelho na loja' : 'Último aparelho já saiu' }}</span>
            </div>
            <p class="sub" *ngIf="c.aberta && c.pendentes.length">Ainda na loja: {{ c.pendentes.join(', ') }}</p>
            <div class="passos">
              <div class="passo" *ngFor="let p of c.passos">
                <p><strong>{{ p.data | date:'dd/MM/yyyy HH:mm':'UTC' }}</strong> · {{ rotuloTipo(p.tipo) }}<span *ngIf="p.vendedorNome"> · {{ p.vendedorNome }}</span><span *ngIf="p.pessoa"> · {{ p.pessoa }}</span></p>
                <p *ngFor="let a of p.saiu">
                  <span class="valor-negativo">− {{ dinheiro(a.valor) }}</span>
                  saiu {{ textoAparelhoGrupo(a) }}
                </p>
                <p *ngFor="let a of p.entrou">
                  <span class="valor-positivo">+ {{ dinheiro(a.valor) }}</span>
                  entrou {{ textoAparelhoGrupo(a) }}
                </p>
                <p class="sub" *ngIf="isAdmin && (p.dinheiroEntrou || p.dinheiroSaiu)">
                  Caixa
                  <span *ngIf="p.dinheiroEntrou" class="valor-positivo"> + {{ dinheiro(p.dinheiroEntrou) }}</span>
                  <span *ngIf="p.dinheiroSaiu" class="valor-negativo"> − {{ dinheiro(p.dinheiroSaiu) }}</span>
                </p>
              </div>
            </div>
          </article>
        </ng-container>
      </ng-container>

      <form class="painel" *ngIf="tela === 'compra'" (ngSubmit)="salvarCompra()" (keydown.enter)="bloquearEnterDaBusca($event)">
        <h3>Compra</h3>
        <p class="hint">A loja paga e o aparelho entra no estoque. Quem vendeu para a loja não ganha desconto na assistência.</p>
        <p class="hint">O código das costas (N para novo, U para usado) o sistema gera na hora da entrada. Não precisa informar.</p>
        <p class="etapa">1. Aparelho</p>
        <div class="form-row">
          <div class="form-group">
            <label>Marca</label>
            <select [ngModel]="marcaEntradaId" (ngModelChange)="onMarcaEntrada($event)" name="marcaCompra">
              <option value="">Selecione…</option>
              <option *ngFor="let m of marcas" [value]="m.id">{{ m.nome }}</option>
            </select>
          </div>
          <div class="form-group grow">
            <label>Modelo</label>
            <ng-container *ngIf="marcaEntradaId as marcaId">
              <p class="hint campo-hint" *ngIf="modelosEntradaCarregando">Carregando modelos…</p>
              <ng-container *ngIf="!modelosEntradaCarregando">
                <app-autocomplete-criavel
                  *ngFor="let chave of [marcaId]"
                  placeholder="Digite o modelo"
                  [buscarFn]="buscarModeloEntradaFn"
                  [permitirCriar]="false"
                  [limiteConsulta]="500"
                  (itemSelecionadoChange)="onModeloEntradaItem($event)"
                />
                <p class="hint campo-hint">Digite e a lista deixa só o que combina.</p>
              </ng-container>
            </ng-container>
            <p class="hint campo-hint" *ngIf="!marcaEntradaId">Escolha a marca para buscar o modelo.</p>
          </div>
          <div class="form-group">
            <label>Condição</label>
            <select [(ngModel)]="entrada.condicao" name="condicaoCompra">
              <option value="novo">Novo</option>
              <option value="usado">Usado</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>IMEI</label>
            <input [ngModel]="entrada.imei" (ngModelChange)="onImei($event)" name="imeiCompra" inputmode="numeric" placeholder="Opcional, 15 dígitos" />
            <span class="campo-aviso" *ngIf="alertaImei">{{ alertaImei }}</span>
            <p class="hint">Aparelho quebrado pode entrar sem IMEI. Informe os 15 dígitos depois do conserto.</p>
          </div>
          <div class="form-group">
            <label>Cor</label>
            <select *ngIf="coresEntrada.length" [ngModel]="corLista" (ngModelChange)="onCorLista($event)" name="corListaCompra">
              <option value="">Selecione…</option>
              <option *ngFor="let c of coresEntrada" [value]="c">{{ c }}</option>
              <option value="__nova">Nova cor</option>
            </select>
            <input *ngIf="!coresEntrada.length || corLista === '__nova'" [(ngModel)]="entrada.cor" name="corCompra" placeholder="Cor do aparelho" />
          </div>
          <div class="form-group">
            <label>Configuração</label>
            <select [(ngModel)]="entrada.configuracao" name="configCompra">
              <option value="">Selecione…</option>
              <option *ngFor="let c of configuracoes" [value]="c">{{ c }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Valor pago pela loja</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="compra.valorPago" name="valorPago" />
            <p class="hint" *ngIf="osAberta">O deságio já está neste valor.</p>
          </div>
        </div>
        <p class="etapa">2. Preços</p>
        <div class="form-row valores-venda">
          <div class="form-group">
            <label>Valor de venda</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="entrada.valorVenda" name="valorVendaCompra" />
          </div>
          <div class="form-group">
            <label>Valor mínimo para venda</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="entrada.valorMinimoVenda" name="valorMinimoCompra" />
          </div>
        </div>
        <p class="etapa">3. Quem vendeu para a loja</p>
        <div class="form-group">
          <label>Cliente (opcional se for fornecedor)</label>
          <app-cliente-autocomplete
            [(ngModel)]="clienteRef"
            name="clienteCompra"
            (clienteSelecionadoChange)="cliente = $event"
            (novoClienteClick)="modalCliente = true"
          />
          <p class="hint">Com cliente, o contrato de compra abre preenchido. Só pedimos o que ainda não foi informado.</p>
        </div>
        <div class="form-group">
          <label>Fornecedor</label>
          <input [(ngModel)]="compra.fornecedorNome" name="fornecedor" placeholder="Distribuidor ou pessoa sem cadastro" />
        </div>
        <div class="form-group">
          <label>Informações</label>
          <input [(ngModel)]="entrada.observacoes" name="obsCompra" placeholder="Estado, acessórios, o que o cliente relatou" />
        </div>
        <div class="form-group">
          <label>Alerta permanente</label>
          <input [(ngModel)]="entrada.alertaPermanente" name="alertaCompra" placeholder="Ex.: Face ID sem conserto" />
          <p class="hint">Defeito que pode não ter mais conserto. Fica em destaque no estoque, na venda e no contrato.</p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Saúde da bateria (%)</label>
            <input type="number" min="0" max="100" [(ngModel)]="entrada.saudeBateria" name="bateriaCompra" />
          </div>
        </div>
        <div class="iphone-ficha" *ngIf="ehIphone">
          <div class="form-group">
            <label>Bateria em perfeitas condições</label>
            <select [(ngModel)]="entrada.bateriaPerfeita" name="bateriaPerfeitaCompra">
              <option value="">Selecione…</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div class="peca-linha" *ngFor="let peca of entrada.pecas; let i = index">
            <div class="form-group grow">
              <label>Peça trocada</label>
              <input [(ngModel)]="peca.nome" [name]="'pecaTrocadaCompra' + i" placeholder="Ex.: bateria, tela" />
            </div>
            <label class="check-label" *ngIf="peca.nome.trim()">
              <input type="checkbox" [(ngModel)]="peca.apareceMensagem" [name]="'mensagemPecaCompra' + i" />
              Aparece mensagem
            </label>
            <button type="button" class="secundario" *ngIf="entrada.pecas.length > 1" (click)="removerPeca(entrada.pecas, i)">Remover</button>
          </div>
          <button type="button" class="secundario" (click)="adicionarPeca(entrada.pecas)">Adicionar outra peça</button>
        </div>
        <label class="check-label">
          <input type="checkbox" [(ngModel)]="entrada.passaPorAssistencia" name="assistenciaCompra" />
          Passa pela assistência antes de vender
        </label>
        <p class="hint" *ngIf="entrada.passaPorAssistencia">Abre uma ordem de serviço no cliente Mundo Smart e manda o papel para impressão. Não entra na venda nem na troca até a assistência fechar a OS, com o defeito permanente e o valor da assistência.</p>
        <details class="mais">
          <summary>Testes e OS já aberta</summary>
        <div class="form-group">
          <label>OS já aberta</label>
          <input [ngModel]="entrada.osNumero" (ngModelChange)="onOsNumero($event)" name="osCompra" inputmode="numeric" placeholder="Número da OS" />
        </div>
        <p class="hint" *ngIf="osBuscando">Buscando a OS…</p>
        <p class="hint os-ok" *ngIf="osAberta">
          OS {{ osConsulta?.numero }} · {{ osConsulta?.situacao }}
          <span *ngIf="osConsulta?.cliente"> · {{ osConsulta?.cliente }}</span>
          <span *ngIf="osConsulta?.aparelho"> · {{ osConsulta?.aparelho }}</span>
          <span *ngIf="osConsulta?.imei"> · IMEI {{ osConsulta?.imei }}</span>
        </p>
        <p class="hint os-alerta" *ngIf="osEncerrada">A OS {{ osConsulta?.numero }} está {{ osConsulta?.situacao }}. Informe uma OS ainda aberta.</p>
        <p class="hint os-alerta" *ngIf="osNaoEncontrada">Não encontrei essa OS.</p>
        <p class="hint os-alerta" *ngIf="osImeiDiverge">O IMEI desta OS é outro. Confira o aparelho.</p>
        <p class="hint" *ngIf="temOsInformada">Os testes desta OS já valem. A lista de testes fica de fora.</p>
        <div class="form-group" *ngIf="!temOsInformada">
          <label>Testes feitos</label>
          <div class="testes">
            <label *ngFor="let t of testes">
              <input type="checkbox" [(ngModel)]="t.ok" [name]="'testeCompra' + t.nome" />
              {{ t.nome }}
            </label>
          </div>
        </div>
        </details>
        <div class="acoes">
          <button type="submit" [disabled]="salvando">{{ salvando ? 'Salvando…' : 'Registrar compra' }}</button>
          <button type="button" class="secundario" (click)="cancelar()">Cancelar</button>
        </div>
      </form>

      <form class="painel" *ngIf="tela === 'venda'" (ngSubmit)="salvarVenda()" (keydown.enter)="bloquearEnterDaBusca($event)">
        <h3>Venda</h3>
        <p class="etapa">1. Aparelho do estoque</p>
        <div class="form-group">
          <label>Buscar código</label>
          <input [ngModel]="buscaCodigoVenda" (ngModelChange)="onBuscaCodigoVenda($event)" name="codigoVenda" placeholder="N14 ou só o número" autocomplete="off" />
          <p class="hint campo-hint">O sistema gerou esse código quando o aparelho entrou. Está nas costas. N é novo, U é usado.</p>
        </div>
        <div class="grade-codigo" *ngIf="achadosCodigoVenda.length > 1">
          <button type="button" *ngFor="let a of achadosCodigoVenda" (click)="escolherVendaPorCodigo(a)">
            {{ a.codigo }} · {{ a.marca }} {{ a.modelo }}
          </button>
        </div>
        <p class="codigo-etiqueta" *ngIf="aparelhoVendaSelecionado?.codigo as cod">{{ cod }}</p>
        <p class="hint" *ngIf="achadosCodigoVenda.length === 0 && buscaCodigoVenda.trim()">Nenhum aparelho liberado com esse código.</p>
        <div class="form-row">
          <div class="form-group">
            <label>Marca</label>
            <select [ngModel]="venda.marca" (ngModelChange)="onVendaMarca($event)" name="marcaVenda">
              <option value="">Selecione…</option>
              <option *ngFor="let m of marcasVenda" [value]="m">{{ m }}</option>
            </select>
          </div>
          <div class="form-group grow">
            <label>Modelo</label>
            <ng-container *ngIf="venda.marca as marca">
              <app-autocomplete-criavel
                *ngFor="let chave of [marca]"
                placeholder="Digite o modelo do estoque"
                [buscarFn]="buscarModeloVendaFn"
                [permitirCriar]="false"
                [limiteConsulta]="500"
                (itemSelecionadoChange)="onVendaModeloItem($event)"
              />
            </ng-container>
            <p class="hint campo-hint" *ngIf="!venda.marca">Escolha a marca para buscar o modelo.</p>
            <p class="hint campo-hint" *ngIf="venda.marca">Digite e somem os que não combinam. Só aparece o que está liberado para venda.</p>
          </div>
          <div class="form-group">
            <label>Cor</label>
            <select [ngModel]="venda.cor" (ngModelChange)="onVendaCor($event)" name="corVenda" [disabled]="!venda.modelo">
              <option value="">{{ venda.modelo ? 'Selecione…' : 'Escolha o modelo' }}</option>
              <option *ngFor="let c of coresVenda" [value]="c.cor">{{ c.cor }} ({{ c.qtd }})</option>
            </select>
          </div>
        </div>
        <div class="form-group" *ngIf="unidadesVenda.length > 1">
          <label>Aparelho</label>
          <select [ngModel]="venda.aparelhoId" (ngModelChange)="onVendaAparelho($event)" name="aparelhoVenda">
            <option value="">Selecione…</option>
            <option *ngFor="let a of unidadesVenda" [value]="a.id">{{ a.configuracao || 'Sem capacidade' }} · {{ a.imei || 'IMEI pendente' }}</option>
          </select>
        </div>
        <p class="hint" *ngIf="unidadesVenda.length === 1">{{ unidadesVenda[0].configuracao || 'Sem capacidade' }} · IMEI {{ unidadesVenda[0].imei }}</p>
        <p class="hint" *ngIf="!disponiveis.length">Nenhum aparelho liberado para venda. Os que estão na assistência aparecem no estoque.</p>
        <p class="etapa">2. Preço e pagamento</p>
        <div class="form-row">
          <div class="form-group">
            <label>Preço do aparelho</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.preco" name="precoVenda" />
            <p class="hint">Este é o valor de venda cadastrado no estoque.</p>
            <p class="hint" *ngIf="aparelhoVendaSelecionado?.valorMinimoVenda">Mínimo para venda: {{ dinheiro(aparelhoVendaSelecionado?.valorMinimoVenda) }}.</p>
            <p class="alerta-permanente" *ngIf="aparelhoVendaSelecionado?.alertaPermanente">Alerta permanente: {{ aparelhoVendaSelecionado?.alertaPermanente }}</p>
            <p class="campo-aviso" *ngIf="abaixoDoMinimo(venda.preco, venda.desconto, aparelhoVendaSelecionado?.valorMinimoVenda)">O valor fica abaixo do mínimo para venda.</p>
          </div>
          <div class="form-group">
            <label>Desconto</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.desconto" name="descontoVenda" />
            <p class="hint">Máximo {{ dinheiro(teto(venda.preco, descontoMaxPct)) }} ({{ descontoMaxPct }}%).</p>
            <p class="campo-aviso" *ngIf="descontoEstoura(venda.preco, venda.desconto)">O desconto passa do limite.</p>
          </div>
        </div>
        <p class="diferenca" *ngIf="precoCobradoVenda !== null">Valor do contrato: {{ dinheiro(precoCobradoVenda) }}.</p>
        <div class="juros" *ngIf="baseParcelasVenda > 0">
          <button type="button" class="secundario" (click)="jurosVendaAberto = !jurosVendaAberto">
            {{ jurosVendaAberto ? 'Ocultar parcelas' : 'Calcular parcelas no cartão' }}
          </button>
          <ng-container *ngIf="jurosVendaAberto">
            <p class="hint">Para a loja receber {{ dinheiro(baseParcelasVenda) }} no cartão, passar para o cliente:</p>
            <div class="grade-juros">
              <button type="button" *ngFor="let op of opcoesJuros(baseParcelasVenda)" (click)="opcaoJurosVenda = op" [class.ativo]="opcaoJurosVenda?.parcelas === op.parcelas">
                <strong>{{ op.parcelas }}x</strong>
                <span>{{ dinheiro(op.parcelas === 1 ? op.total : op.valorParcela) }}</span>
                <small *ngIf="op.parcelas > 1">total {{ dinheiro(op.total) }}</small>
              </button>
            </div>
            <p class="hint" *ngIf="opcaoJurosVenda as op">
              {{ op.parcelas === 1 ? dinheiro(op.total) : op.parcelas + 'x de ' + dinheiro(op.valorParcela) }}.
              Acréscimo {{ dinheiro(op.juros) }}. Taxa {{ taxa(op.taxaExibidaPct) }}.
              A loja recebe {{ dinheiro(baseParcelasVenda) }}.
            </p>
          </ng-container>
        </div>
        <div class="form-group">
          <label>Negociação</label>
          <select [(ngModel)]="venda.forma" name="formaVenda">
            <option value="avista">À vista na loja</option>
            <option value="cartao">Cartão de crédito</option>
            <option value="avista_cartao">À vista + cartão</option>
            <option value="payjoy">Payjoy</option>
            <option value="paymobi">Paymobi</option>
            <option value="crefaz">Crefaz</option>
            <option value="outra">Outra financiadora</option>
          </select>
          <p class="hint campo-hint" *ngIf="venda.forma === 'avista'">O dinheiro que entra é o preço. Esse CPF e esse IMEI passam a ter desconto na assistência. O contrato abre preenchido.</p>
          <p class="hint campo-hint" *ngIf="venda.forma === 'cartao'">O valor que entra é o preço, no cartão. A parcela calculada é o que passa para o cliente. A loja recebe o preço.</p>
          <p class="hint campo-hint" *ngIf="venda.forma === 'avista_cartao'">Parte à vista e parte no cartão. As duas somam o preço e as duas entram no caixa.</p>
          <p class="hint campo-hint" *ngIf="ehFinanciada(venda.forma)">O preço é o valor do contrato. No caixa entra a entrada e o repasse da financiadora. O saldo que o cliente deve a ela não é dinheiro da loja.</p>
        </div>
        <div class="form-group" *ngIf="venda.forma === 'outra'">
          <label>Nome da financiadora</label>
          <input [(ngModel)]="venda.financiadoraNome" name="nomeFinVenda" />
        </div>
        <div class="form-row" *ngIf="venda.forma === 'avista_cartao'">
          <div class="form-group">
            <label>À vista</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.entrada" name="avistaVenda" />
          </div>
          <div class="form-group">
            <label>No cartão</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.repasse" name="cartaoVenda" />
          </div>
        </div>
        <p class="hint" *ngIf="venda.forma === 'avista_cartao'">Entra no caixa: {{ dinheiro(caixaVenda) }}.</p>
        <div class="form-row" *ngIf="ehFinanciada(venda.forma)">
          <div class="form-group">
            <label>Entrada na loja</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.entrada" name="entradaVenda" />
          </div>
          <div class="form-group" *ngIf="venda.forma !== 'paymobi'">
            <label>Repasse da financiadora</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.repasse" name="repasseVenda" />
          </div>
        </div>
        <p class="hint" *ngIf="ehFinanciada(venda.forma)">
          Entra no caixa agora: {{ dinheiro(caixaVenda) }}.
          Na Paymobi a loja é a credora: a entrada entra agora e o restante fica em boleto.
          Na Payjoy e na Crefaz, o repasse é o que a financiadora paga à loja.
        </p>
        <div class="form-group" *ngIf="ehFinanciada(venda.forma)">
          <label>Acréscimo para a financiadora</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="venda.acrescimo" name="acrescimoVenda" />
          <p class="hint">Sobe o valor do contrato até {{ dinheiro(teto(venda.preco, acrescimoMaxPct)) }} ({{ acrescimoMaxPct }}%) para a financiadora calcular uma entrada menor. O caixa continua sendo a entrada e o repasse.</p>
          <p class="campo-aviso" *ngIf="acrescimoEstoura(venda.preco, venda.acrescimo)">O acréscimo passa do limite.</p>
        </div>
        <p class="etapa">3. Cliente</p>
        <div class="form-group">
          <label>Cliente</label>
          <app-cliente-autocomplete
            [(ngModel)]="clienteRef"
            name="clienteVenda"
            (clienteSelecionadoChange)="cliente = $event"
            (novoClienteClick)="modalCliente = true"
          />
          <p class="campo-aviso" *ngIf="clienteSemDocumento">Este cliente está sem CPF/CNPJ. Cadastre o documento para liberar o desconto.</p>
          <ng-container *ngIf="aparelhoPromocaoVenda as aparelho">
            <div class="promocao" *ngIf="!clienteSemDocumento">
              <strong>Este aparelho entra na promoção de desconto.</strong>
              <div>{{ nomeAparelho(aparelho) }} · IMEI {{ aparelho.imei }}</div>
              <div>Na assistência, o funcionário precisa validar o IMEI se o cliente trouxer o mesmo modelo.</div>
            </div>
          </ng-container>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <input [(ngModel)]="venda.observacoes" name="obsVenda" />
        </div>
        <div class="acoes">
          <button type="submit" [disabled]="salvando">{{ salvando ? 'Salvando…' : 'Registrar venda' }}</button>
          <button type="button" class="secundario" (click)="cancelar()">Limpar</button>
        </div>
      </form>

      <form class="painel" *ngIf="tela === 'troca'" (ngSubmit)="salvarTroca()" (keydown.enter)="bloquearEnterDaBusca($event)">
        <h3>Troca</h3>
        <p class="hint">O caixa registra só a diferença. O aparelho que entra fica no estoque pelo valor avaliado.</p>
        <p class="etapa">1. Aparelho que sai</p>
        <div class="form-group">
          <label>Buscar código</label>
          <input [ngModel]="buscaCodigoTroca" (ngModelChange)="onBuscaCodigoTroca($event)" name="codigoTroca" placeholder="N14 ou só o número" autocomplete="off" />
          <p class="hint campo-hint">O sistema gerou esse código quando o aparelho entrou. Está nas costas do que o cliente vai levar.</p>
        </div>
        <div class="grade-codigo" *ngIf="achadosCodigoTroca.length > 1">
          <button type="button" *ngFor="let a of achadosCodigoTroca" (click)="escolherTrocaPorCodigo(a)">
            {{ a.codigo }} · {{ a.marca }} {{ a.modelo }}
          </button>
        </div>
        <p class="codigo-etiqueta" *ngIf="aparelhoTrocaSelecionado?.codigo as cod">{{ cod }}</p>
        <p class="hint" *ngIf="achadosCodigoTroca.length === 0 && buscaCodigoTroca.trim()">Nenhum aparelho liberado com esse código.</p>
        <div class="form-row">
          <div class="form-group">
            <label>Marca que sai</label>
            <select [ngModel]="troca.marca" (ngModelChange)="onTrocaMarca($event)" name="marcaTroca">
              <option value="">Selecione…</option>
              <option *ngFor="let m of marcasVenda" [value]="m">{{ m }}</option>
            </select>
          </div>
          <div class="form-group grow">
            <label>Modelo</label>
            <ng-container *ngIf="troca.marca as marca">
              <app-autocomplete-criavel
                *ngFor="let chave of [marca]"
                placeholder="Digite o modelo que sai"
                [buscarFn]="buscarModeloTrocaFn"
                [permitirCriar]="false"
                [limiteConsulta]="500"
                (itemSelecionadoChange)="onTrocaModeloItem($event)"
              />
            </ng-container>
            <p class="hint campo-hint" *ngIf="!troca.marca">Escolha a marca para buscar o modelo.</p>
            <p class="hint campo-hint" *ngIf="troca.marca">Digite e somem os que não combinam. Só aparece o que está liberado para venda.</p>
          </div>
          <div class="form-group">
            <label>Cor</label>
            <select [ngModel]="troca.cor" (ngModelChange)="onTrocaCor($event)" name="corTroca" [disabled]="!troca.modelo">
              <option value="">{{ troca.modelo ? 'Selecione…' : 'Escolha o modelo' }}</option>
              <option *ngFor="let c of coresTroca" [value]="c.cor">{{ c.cor }} ({{ c.qtd }})</option>
            </select>
          </div>
        </div>
        <div class="form-group" *ngIf="unidadesTroca.length > 1">
          <label>Aparelho que sai</label>
          <select [ngModel]="troca.aparelhoSaidaId" (ngModelChange)="onTrocaAparelho($event)" name="saida">
            <option value="">Selecione…</option>
            <option *ngFor="let a of unidadesTroca" [value]="a.id">{{ a.configuracao || 'Sem capacidade' }} · {{ a.imei || 'IMEI pendente' }}</option>
          </select>
        </div>
        <p class="hint" *ngIf="unidadesTroca.length === 1">{{ unidadesTroca[0].configuracao || 'Sem capacidade' }} · IMEI {{ unidadesTroca[0].imei }}</p>
        <div class="form-row">
          <div class="form-group">
            <label>Preço do aparelho que sai</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.precoSaida" name="precoSaida" />
            <p class="hint">Este é o valor de venda cadastrado no estoque.</p>
            <p class="hint" *ngIf="aparelhoTrocaSelecionado?.valorMinimoVenda">Mínimo para venda: {{ dinheiro(aparelhoTrocaSelecionado?.valorMinimoVenda) }}.</p>
            <p class="alerta-permanente" *ngIf="aparelhoTrocaSelecionado?.alertaPermanente">Alerta permanente: {{ aparelhoTrocaSelecionado?.alertaPermanente }}</p>
            <p class="campo-aviso" *ngIf="abaixoDoMinimo(troca.precoSaida, troca.desconto, aparelhoTrocaSelecionado?.valorMinimoVenda)">O valor fica abaixo do mínimo para venda.</p>
          </div>
          <div class="form-group">
            <label>Desconto</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.desconto" name="descontoTroca" />
            <p class="hint">Máximo {{ dinheiro(teto(troca.precoSaida, descontoMaxPct)) }} ({{ descontoMaxPct }}%).</p>
            <p class="campo-aviso" *ngIf="descontoEstoura(troca.precoSaida, troca.desconto)">O desconto passa do limite.</p>
          </div>
        </div>
        <p class="hint" *ngIf="somaAvaliados !== null">Os aparelhos que entram somam {{ dinheiro(somaAvaliados) }}. Cada um fica no estoque pelo próprio valor avaliado.</p>
        <p class="diferenca" *ngIf="precoCobradoTroca !== null">Valor do contrato: {{ dinheiro(precoCobradoTroca) }}.</p>
        <p class="hint" *ngIf="diferencaTroca !== null">
          Pelos valores dos aparelhos, a conta dá
          <ng-container *ngIf="diferencaTroca > 0">{{ dinheiro(diferencaTroca) }} a favor da loja.</ng-container>
          <ng-container *ngIf="diferencaTroca < 0">{{ dinheiro(-diferencaTroca) }} a favor do cliente.</ng-container>
          <ng-container *ngIf="diferencaTroca === 0">zero.</ng-container>
          O caixa usa a diferença que você informar.
        </p>
        <p class="etapa">2. Diferença</p>
        <div class="form-group">
          <label>Volta da diferença</label>
          <select [ngModel]="troca.sentido" (ngModelChange)="onSentidoTroca($event)" name="sentidoTroca">
            <option value="">Selecione…</option>
            <option value="loja">Volta para a loja</option>
            <option value="cliente">Volta para o cliente</option>
            <option value="nenhuma">Sem diferença</option>
          </select>
        </div>
        <div class="form-group" *ngIf="troca.sentido === 'loja' || troca.sentido === 'cliente'">
          <label>Diferença</label>
          <input type="number" min="0.01" step="0.01" [(ngModel)]="troca.diferenca" name="diferencaTroca" />
        </div>
        <div class="form-group" *ngIf="troca.sentido === 'loja'">
          <label>Pagamento da diferença</label>
          <select [(ngModel)]="troca.pagamento" name="pagamentoTrocaLoja">
            <option value="">Selecione…</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
            <option value="financiadora">Financiadora</option>
          </select>
        </div>
        <div class="form-group" *ngIf="troca.sentido === 'loja' && troca.pagamento === 'financiadora'">
          <label>Qual financiadora</label>
          <input [(ngModel)]="troca.financiadoraNome" name="nomeFinTroca" />
        </div>
        <div class="form-group" *ngIf="troca.sentido === 'cliente'">
          <label>Como a loja devolve</label>
          <select [(ngModel)]="troca.pagamento" name="pagamentoTrocaCliente">
            <option value="">Selecione…</option>
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
        </div>
        <div class="juros" *ngIf="troca.pagamento === 'cartao' && diferencaDigitada > 0">
          <button type="button" class="secundario" (click)="jurosTrocaAberto = !jurosTrocaAberto">
            {{ jurosTrocaAberto ? 'Ocultar parcelas' : 'Calcular parcelas no cartão' }}
          </button>
          <ng-container *ngIf="jurosTrocaAberto">
            <p class="hint">Para a loja receber {{ dinheiro(diferencaDigitada) }} no cartão, passar para o cliente:</p>
            <div class="grade-juros">
              <button type="button" *ngFor="let op of opcoesJuros(diferencaDigitada)" (click)="opcaoJurosTroca = op" [class.ativo]="opcaoJurosTroca?.parcelas === op.parcelas">
                <strong>{{ op.parcelas }}x</strong>
                <span>{{ dinheiro(op.parcelas === 1 ? op.total : op.valorParcela) }}</span>
                <small *ngIf="op.parcelas > 1">total {{ dinheiro(op.total) }}</small>
              </button>
            </div>
            <p class="hint" *ngIf="opcaoJurosTroca as op">
              {{ op.parcelas === 1 ? dinheiro(op.total) : op.parcelas + 'x de ' + dinheiro(op.valorParcela) }}.
              Acréscimo {{ dinheiro(op.juros) }}. Taxa {{ taxa(op.taxaExibidaPct) }}.
              A loja recebe {{ dinheiro(diferencaDigitada) }}. O cálculo não altera a diferença informada.
            </p>
          </ng-container>
        </div>
        <p class="etapa">3. Cliente</p>
        <div class="form-group">
          <label>Cliente</label>
          <app-cliente-autocomplete
            [(ngModel)]="clienteRef"
            name="clienteTroca"
            (clienteSelecionadoChange)="cliente = $event"
            (novoClienteClick)="modalCliente = true"
          />
          <p class="campo-aviso" *ngIf="clienteSemDocumento">Este cliente está sem CPF/CNPJ. Cadastre o documento para liberar o desconto.</p>
          <ng-container *ngIf="aparelhoPromocaoTroca as aparelho">
            <div class="promocao" *ngIf="!clienteSemDocumento">
              <strong>O aparelho que o cliente leva entra na promoção de desconto.</strong>
              <div>{{ nomeAparelho(aparelho) }} · IMEI {{ aparelho.imei }}</div>
              <div>Na assistência, o funcionário precisa validar o IMEI se o cliente trouxer o mesmo modelo.</div>
            </div>
          </ng-container>
        </div>
        <div class="entrada-troca" *ngFor="let f of entradasTroca; let i = index">
          <div class="entrada-troca-topo">
            <h4>4. Aparelho que entra<span *ngIf="entradasTroca.length > 1"> {{ i + 1 }}</span></h4>
            <button type="button" class="secundario" *ngIf="entradasTroca.length > 1" (click)="removerEntradaTroca(f)">Remover</button>
          </div>
          <p class="hint">O código das costas deste aparelho o sistema gera quando ele entrar. Não precisa informar.</p>
          <div class="form-row">
            <div class="form-group">
              <label>Marca</label>
              <select [ngModel]="f.marcaId" (ngModelChange)="onMarcaFicha($event, f)" [name]="'marcaTrocaEntrada' + f.id">
                <option value="">Selecione…</option>
                <option *ngFor="let m of marcas" [value]="m.id">{{ m.nome }}</option>
              </select>
            </div>
            <div class="form-group grow">
              <label>Modelo</label>
              <ng-container *ngIf="f.marcaId as marcaId">
                <p class="hint campo-hint" *ngIf="f.carregando">Carregando modelos…</p>
                <ng-container *ngIf="!f.carregando">
                  <app-autocomplete-criavel
                    *ngFor="let chave of [marcaId]"
                    placeholder="Digite o modelo que entra"
                    [buscarFn]="f.buscarModelo"
                    [permitirCriar]="false"
                    [limiteConsulta]="500"
                    (itemSelecionadoChange)="onModeloFicha($event, f)"
                  />
                  <p class="hint campo-hint">Digite e a lista deixa só o que combina.</p>
                </ng-container>
              </ng-container>
              <p class="hint campo-hint" *ngIf="!f.marcaId">Escolha a marca para buscar o modelo.</p>
            </div>
            <div class="form-group">
              <label>Condição</label>
              <select [(ngModel)]="f.dados.condicao" [name]="'condicaoTroca' + f.id">
                <option value="usado">Usado</option>
                <option value="novo">Novo</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>IMEI</label>
              <input [ngModel]="f.dados.imei" (ngModelChange)="onImeiFicha($event, f)" [name]="'imeiTroca' + f.id" inputmode="numeric" placeholder="Opcional, 15 dígitos" />
              <span class="campo-aviso" *ngIf="alertaImeiDe(f) as alerta">{{ alerta }}</span>
              <p class="hint">Pode entrar sem IMEI. Informe depois do conserto.</p>
            </div>
            <div class="form-group">
              <label>Cor</label>
              <select *ngIf="coresDeFicha(f).length" [ngModel]="f.corLista" (ngModelChange)="onCorFicha($event, f)" [name]="'corListaTroca' + f.id">
                <option value="">Selecione…</option>
                <option *ngFor="let c of coresDeFicha(f)" [value]="c">{{ c }}</option>
                <option value="__nova">Nova cor</option>
              </select>
              <input *ngIf="!coresDeFicha(f).length || f.corLista === '__nova'" [(ngModel)]="f.dados.cor" [name]="'corTrocaEntrada' + f.id" placeholder="Cor do aparelho" />
            </div>
            <div class="form-group">
              <label>Configuração</label>
              <select [(ngModel)]="f.dados.configuracao" [name]="'configTroca' + f.id">
                <option value="">Selecione…</option>
                <option *ngFor="let c of configuracoes" [value]="c">{{ c }}</option>
              </select>
            </div>
          </div>
          <div class="form-row valores-venda">
            <div class="form-group">
              <label>Valor de venda</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="f.dados.valorVenda" [name]="'valorVendaTroca' + f.id" />
            </div>
            <div class="form-group">
              <label>Valor mínimo para venda</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="f.dados.valorMinimoVenda" [name]="'valorMinimoTroca' + f.id" />
            </div>
            <div class="form-group">
              <label>Valor avaliado</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="f.valorAvaliado" [name]="'avaliadoTroca' + f.id" />
              <p class="hint" *ngIf="osAbertaDe(f)">O deságio já está neste valor. É o que a loja paga por este aparelho.</p>
            </div>
          </div>
          <div class="form-group">
            <label>Informações</label>
            <input [(ngModel)]="f.dados.observacoes" [name]="'obsTroca' + f.id" placeholder="Estado, acessórios, o que o cliente relatou" />
          </div>
          <div class="form-group">
            <label>Alerta permanente</label>
            <input [(ngModel)]="f.dados.alertaPermanente" [name]="'alertaTroca' + f.id" placeholder="Ex.: Face ID sem conserto" />
            <p class="hint">Defeito que pode não ter mais conserto. Fica em destaque no estoque, na venda e no contrato.</p>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Saúde da bateria (%)</label>
              <input type="number" min="0" max="100" [(ngModel)]="f.dados.saudeBateria" [name]="'bateriaTroca' + f.id" />
            </div>
          </div>
          <div class="iphone-ficha" *ngIf="ehIphoneDe(f)">
            <div class="form-group">
              <label>Bateria em perfeitas condições</label>
              <select [(ngModel)]="f.dados.bateriaPerfeita" [name]="'bateriaPerfeitaTroca' + f.id">
                <option value="">Selecione…</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div class="peca-linha" *ngFor="let peca of f.dados.pecas; let i = index">
              <div class="form-group grow">
                <label>Peça trocada</label>
                <input [(ngModel)]="peca.nome" [name]="'pecaTrocadaTroca' + f.id + i" placeholder="Ex.: bateria, tela" />
              </div>
              <label class="check-label" *ngIf="peca.nome.trim()">
                <input type="checkbox" [(ngModel)]="peca.apareceMensagem" [name]="'mensagemPecaTroca' + f.id + i" />
                Aparece mensagem
              </label>
              <button type="button" class="secundario" *ngIf="f.dados.pecas.length > 1" (click)="removerPeca(f.dados.pecas, i)">Remover</button>
            </div>
            <button type="button" class="secundario" (click)="adicionarPeca(f.dados.pecas)">Adicionar outra peça</button>
          </div>
          <label class="check-label">
            <input type="checkbox" [(ngModel)]="f.dados.passaPorAssistencia" [name]="'assistenciaTroca' + f.id" />
            Este aparelho passa pela assistência antes de vender
          </label>
          <p class="hint" *ngIf="f.dados.passaPorAssistencia">Abre uma ordem de serviço no cliente Mundo Smart e manda o papel para impressão. Ele fica no estoque, mas não entra na venda nem na troca até a assistência fechar a OS, com o defeito permanente e o valor da assistência.</p>
          <details class="mais">
            <summary>Testes e OS já aberta</summary>
          <div class="form-group">
            <label>OS já aberta</label>
            <input [ngModel]="f.dados.osNumero" (ngModelChange)="onOsFicha($event, f)" [name]="'osTroca' + f.id" inputmode="numeric" placeholder="Número da OS" />
          </div>
          <p class="hint" *ngIf="f.osBuscando">Buscando a OS…</p>
          <p class="hint os-ok" *ngIf="osAbertaDe(f)">
            OS {{ f.osConsulta?.numero }} · {{ f.osConsulta?.situacao }}
            <span *ngIf="f.osConsulta?.cliente"> · {{ f.osConsulta?.cliente }}</span>
            <span *ngIf="f.osConsulta?.aparelho"> · {{ f.osConsulta?.aparelho }}</span>
            <span *ngIf="f.osConsulta?.imei"> · IMEI {{ f.osConsulta?.imei }}</span>
          </p>
          <p class="hint os-alerta" *ngIf="osEncerradaDe(f)">A OS {{ f.osConsulta?.numero }} está {{ f.osConsulta?.situacao }}. Informe uma OS ainda aberta.</p>
          <p class="hint os-alerta" *ngIf="osNaoEncontradaDe(f)">Não encontrei essa OS.</p>
          <p class="hint os-alerta" *ngIf="osImeiDivergeDe(f)">O IMEI desta OS é outro. Confira o aparelho.</p>
          <p class="hint" *ngIf="osAbertaDe(f)">Os testes desta OS já valem. A lista de testes fica de fora.</p>
          <div class="form-group" *ngIf="!osAbertaDe(f)">
            <label>Testes feitos</label>
            <div class="testes">
              <label *ngFor="let t of f.testes">
                <input type="checkbox" [(ngModel)]="t.ok" [name]="'testeTroca' + f.id + t.nome" />
                {{ t.nome }}
              </label>
            </div>
          </div>
          </details>
        </div>
        <div class="acoes">
          <button type="button" class="secundario" (click)="adicionarEntradaTroca()">Adicionar outro aparelho</button>
        </div>
        <div class="acoes">
          <button type="submit" [disabled]="salvando">{{ salvando ? 'Salvando…' : 'Registrar troca' }}</button>
          <button type="button" class="secundario" (click)="cancelar()">Cancelar</button>
        </div>
      </form>

      <ng-container *ngIf="tela === 'estoque'">
      <p class="hint" *ngIf="!carregando && estoque.length === 0">Nenhum celular no estoque. Use Compra para receber o primeiro aparelho.</p>
      <div class="busca-estoque" *ngIf="estoque.length">
        <div class="form-group">
          <label>Código</label>
          <input [(ngModel)]="buscaCodigo" (ngModelChange)="resetPaginaEstoque()" name="buscaCodigo" placeholder="N14 ou 14" />
        </div>
        <div class="form-group">
          <label>Marca</label>
          <select [ngModel]="buscaMarca" (ngModelChange)="onBuscaMarca($event)" name="buscaMarca">
            <option value="">Todas</option>
            <option *ngFor="let m of marcasBusca" [value]="m">{{ m }}</option>
          </select>
        </div>
        <div class="form-group filtro-modelo">
          <label>Modelo</label>
          <ng-container *ngFor="let k of [modeloFiltroKey]">
            <app-autocomplete-criavel
              placeholder="ip 11, sm a54…"
              [buscarFn]="buscarModeloEstoqueFn"
              [permitirCriar]="false"
              [valorInicial]="buscaModeloLabel"
              [valorInicialId]="buscaModeloId"
              [valorInicialMarcaNome]="buscaModeloMarca"
              (itemSelecionadoChange)="onFiltroModeloEstoque($event)"
            />
          </ng-container>
        </div>
        <div class="form-group">
          <label>Vendedor</label>
          <select [(ngModel)]="buscaVendedor" (ngModelChange)="resetPaginaEstoque()" name="buscaVendedorEstoque">
            <option value="">Todos</option>
            <option *ngFor="let v of vendedoresCadastrados; trackBy: trackVendedor" [value]="v.nome">{{ v.nome }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Configuração</label>
          <input [(ngModel)]="buscaConfig" (ngModelChange)="resetPaginaEstoque()" name="buscaConfig" placeholder="128 GB" />
        </div>
        <div class="form-group">
          <label>Cor</label>
          <input [(ngModel)]="buscaCor" (ngModelChange)="resetPaginaEstoque()" name="buscaCor" placeholder="Cor" />
        </div>
        <div class="form-group">
          <label>Valor de</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="buscaValorDe" (ngModelChange)="resetPaginaEstoque()" name="buscaValorDe" />
        </div>
        <div class="form-group">
          <label>Valor até</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="buscaValorAte" (ngModelChange)="resetPaginaEstoque()" name="buscaValorAte" />
        </div>
      </div>
      <p class="hint" *ngIf="estoque.length && !estoqueFiltrado.length">Nenhum aparelho com esse filtro.</p>
      <app-grid-paginator
        *ngIf="estoqueFiltrado.length"
        [total]="estoqueFiltrado.length"
        [page]="gridEstoque.page"
        [pageSize]="gridEstoque.pageSize"
        (pageChange)="gridEstoque.onPageChange($event)"
        (pageSizeChange)="gridEstoque.onPageSizeChange($event)"
      />
      <table class="data-grid" *ngIf="estoquePaginado.length">
        <thead>
          <tr>
            <th>Código</th>
            <th>Foto</th>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Valor</th>
            <th>Pago</th>
            <th>P/ compra</th>
            <th>Margem</th>
            <th>No desconto</th>
            <th>Configuração</th>
            <th>Cor</th>
            <th>Situação</th>
            <th>Vendedor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of estoquePaginado" class="clicavel" [class.selecionada]="fichaId === a.id" [class.na-assistencia]="a.status === 'em_assistencia'" (click)="alternarFicha(a.id)">
            <td class="codigo-celula">{{ a.codigo || '—' }}</td>
            <td>
              <span class="flag-foto" *ngIf="temFoto(a)" title="Este aparelho tem foto">Foto</span>
            </td>
            <td>{{ a.marca }}</td>
            <td>{{ a.modelo }}</td>
            <td>{{ a.valorVenda ? dinheiro(a.valorVenda) : '—' }}</td>
            <td>{{ pagoDe(a) ? dinheiro(pagoDe(a)) : '—' }}</td>
            <td [class.valor-negativo]="acimaDaVenda(a.valorParaCompra, a.valorVenda)">{{ a.valorParaCompra ? dinheiro(a.valorParaCompra) : '—' }}</td>
            <td class="margem" [class.valor-positivo]="(lucroDe(a.valorVenda, pagoDe(a)) ?? 0) > 0" [class.valor-negativo]="(lucroDe(a.valorVenda, pagoDe(a)) ?? 0) < 0">{{ textoLucro(a.valorVenda, pagoDe(a)) }}</td>
            <td class="margem" [class.valor-positivo]="(lucroDe(a.valorMinimoVenda, pagoDe(a)) ?? 0) > 0" [class.valor-negativo]="(lucroDe(a.valorMinimoVenda, pagoDe(a)) ?? 0) < 0">{{ textoLucro(a.valorMinimoVenda, pagoDe(a)) }}</td>
            <td>{{ a.configuracao || '—' }}</td>
            <td>{{ a.cor || '—' }}</td>
            <td class="celula-situacao">
              <span>{{ rotuloSituacao(a.status) }}</span>
              <span
                *ngIf="a.status === 'em_assistencia'"
                class="info-os"
                [attr.aria-label]="dicaAssistencia(a)"
                (mouseenter)="mostrarDicaAssistencia($event, a)"
                (mouseleave)="esconderDicaAssistencia()"
                (click)="$event.stopPropagation()"
              >i</span>
            </td>
            <td>{{ a.vendedorEntradaNome || '—' }}</td>
            <td class="grid-acoes-cell" (click)="$event.stopPropagation()">
              <div class="grid-acoes" *ngIf="podeEditar(a)">
                <app-grid-acao tipo="editar" titulo="Editar" (acao)="abrirEdicao(a)" />
                <app-grid-acao tipo="excluir" titulo="Excluir" *ngIf="isAdmin" [disabled]="salvando" (acao)="excluirAparelho(a)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div
        class="dica-flutuante"
        *ngIf="dicaAssistenciaAberta as dica"
        [style.top.px]="dica.top"
        [style.left.px]="dica.left"
      >{{ dica.texto }}</div>
      <div class="ficha-card" *ngIf="aparelhoFicha as a" id="cadastro-aberto">
            <div class="ficha-grade">
              <p class="codigo-etiqueta" *ngIf="a.codigo">{{ a.codigo }}</p>
              <p class="hint codigo-faixa" *ngIf="a.codigo">O sistema gerou este código na entrada, para colar nas costas. Ele não muda se você editar o cadastro.</p>
              <div class="ficha-fotos">
                <h4>Fotos deste aparelho</h4>
                <p class="hint" *ngIf="temFoto(a)">Este aparelho tem foto. Elas abrem em Editar, junto com os vídeos.</p>
                <p class="hint" *ngIf="!temFoto(a)">Nenhuma foto ainda. Inclua em Editar.</p>
              </div>
              <div class="ficha-dados">
                <h4>Cadastro</h4>
                <dl>
                  <div><dt>Modelo</dt><dd>{{ a.marca }} {{ a.modelo }}</dd></div>
                  <div><dt>Cor</dt><dd>{{ a.cor || '—' }}</dd></div>
                  <div><dt>Configuração</dt><dd>{{ a.configuracao || '—' }}</dd></div>
                  <div><dt>Estado</dt><dd>{{ rotuloCondicao(a.condicao) }}</dd></div>
                  <div><dt>IMEI</dt><dd>{{ a.imei || 'Pendente' }}</dd></div>
                  <div><dt>Situação</dt><dd>{{ rotuloSituacao(a.status) }}</dd></div>
                  <div><dt>Entrou</dt><dd>{{ a.dataEntrada | date:'dd/MM/yyyy':'UTC' }}</dd></div>
                  <div><dt>Origem</dt><dd>{{ rotuloTipo(a.origem) }}</dd></div>
                  <div *ngIf="a.clienteOrigemNome"><dt>Veio de</dt><dd>{{ a.clienteOrigemNome }}</dd></div>
                  <div *ngIf="a.vendedorEntradaNome"><dt>Vendedor</dt><dd>{{ a.vendedorEntradaNome }}</dd></div>
                  <div><dt>Pagamento</dt><dd>{{ rotuloFormaAparelho(a) }}</dd></div>
                  <div><dt>Pago</dt><dd>{{ pagoDe(a) ? dinheiro(pagoDe(a)) : '—' }}</dd></div>
                  <div>
                    <dt>P/ compra</dt>
                    <dd [class.valor-negativo]="acimaDaVenda(a.valorParaCompra, a.valorVenda)">{{ a.valorParaCompra ? dinheiro(a.valorParaCompra) : '—' }}</dd>
                  </div>
                  <div><dt>Venda</dt><dd>{{ a.valorVenda ? dinheiro(a.valorVenda) : '—' }}</dd></div>
                  <div *ngIf="a.valorMinimoVenda"><dt>Mínimo</dt><dd>{{ dinheiro(a.valorMinimoVenda) }}</dd></div>
                  <div *ngIf="pagoDe(a) && a.valorVenda">
                    <dt>Margem no preço real</dt>
                    <dd [class.valor-positivo]="(lucroDe(a.valorVenda, pagoDe(a)) ?? 0) > 0" [class.valor-negativo]="(lucroDe(a.valorVenda, pagoDe(a)) ?? 0) < 0">{{ textoLucro(a.valorVenda, pagoDe(a)) }}</dd>
                  </div>
                  <div *ngIf="pagoDe(a) && a.valorMinimoVenda">
                    <dt>Margem no preço com desconto</dt>
                    <dd [class.valor-positivo]="(lucroDe(a.valorMinimoVenda, pagoDe(a)) ?? 0) > 0" [class.valor-negativo]="(lucroDe(a.valorMinimoVenda, pagoDe(a)) ?? 0) < 0">{{ textoLucro(a.valorMinimoVenda, pagoDe(a)) }}</dd>
                  </div>
                  <div *ngIf="financeiro"><dt>Custo</dt><dd>{{ dinheiro(custoTotalDe(a)) }}</dd></div>
                  <div *ngIf="a.saudeBateria != null"><dt>Saúde da bateria</dt><dd>{{ a.saudeBateria }}%</dd></div>
                  <div *ngIf="a.bateriaPerfeita === true"><dt>Bateria</dt><dd>Em perfeitas condições</dd></div>
                  <div *ngIf="a.bateriaPerfeita === false"><dt>Bateria</dt><dd>Fora das perfeitas condições</dd></div>
                  <div *ngIf="a.osEntradaId || a.osEntradaNumero">
                    <dt>OS</dt>
                    <dd>
                      <a *ngIf="a.osEntradaId" class="os-link" [routerLink]="['/ordens-servico', a.osEntradaId]">OS {{ a.osEntradaNumero || a.osEntradaId }}</a>
                      <span *ngIf="!a.osEntradaId">OS {{ a.osEntradaNumero }}</span>
                    </dd>
                  </div>
                </dl>
                <p *ngIf="a.observacoes">{{ a.observacoes }}</p>
                <p class="os-alerta" *ngIf="a.status === 'em_assistencia' && a.justificativaAssistencia">{{ a.justificativaAssistencia }}</p>
                <p class="alerta-permanente" *ngIf="a.alertaPermanente">{{ a.alertaPermanente }}</p>
                <p class="sub" *ngIf="textoPecas(a) as pecas">Peças trocadas: {{ pecas }}</p>
                <p class="sub" *ngIf="a.testesNaOs">Testes feitos na OS {{ a.osEntradaNumero || 'vinculada' }}.</p>
                <p class="sub" *ngIf="a.testes?.length">{{ testesResumo(a) }}</p>
                <div class="acoes-ficha">
                  <button type="button" *ngIf="podeEditar(a)" (click)="abrirEdicao(a)">Editar cadastro</button>
                  <a *ngIf="a.status === 'em_estoque'" class="secundario" [routerLink]="['/vendas-celulares/venda']" [queryParams]="{ codigo: a.codigo }">Vender</a>
                  <a *ngIf="a.status === 'em_estoque'" class="secundario" [routerLink]="['/vendas-celulares/troca']" [queryParams]="{ codigo: a.codigo }">Trocar</a>
                  <button type="button" class="perigo" *ngIf="isAdmin && podeEditar(a)" [disabled]="salvando" (click)="excluirAparelho(a)">Excluir aparelho</button>
                </div>
                <p class="hint" *ngIf="!podeEditar(a)">Este aparelho já saiu. O cadastro fica só para consulta.</p>
              </div>
            </div>
          </div>
      </ng-container>

      <h3 class="secao" *ngIf="financeiro && custosAssistencia.length">Custo de assistência por aparelho</h3>
      <p class="hint" *ngIf="financeiro && custosAssistencia.length">
        O custo do aparelho é a compra mais o custo da peça. Uma compra de 1400 com bateria de 400 fica 1800.
        A mão de obra cobrada do cliente não entra nesse custo.
      </p>
      <table class="data-grid" *ngIf="financeiro && custosAssistencia.length">
        <thead>
          <tr>
            <th>Aparelho</th>
            <th>IMEI</th>
            <th>Vendedor</th>
            <th>Compra</th>
            <th>Peças</th>
            <th>Custo</th>
            <th>Ordens</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of custosAssistencia">
            <td>{{ nomeAparelho(a) }}</td>
            <td>{{ a.imei }}</td>
            <td>{{ a.vendedorEntradaNome || '—' }}</td>
            <td>{{ dinheiro(a.custo) }}</td>
            <td>{{ dinheiro(a.custoPecas) }}</td>
            <td>{{ dinheiro(custoTotalDe(a)) }}</td>
            <td>
              <a
                *ngFor="let os of linksOs(a)"
                class="os-link"
                [routerLink]="['/ordens-servico', os.id]"
              >OS {{ os.numero }}</a>
              <span *ngIf="!linksOs(a).length">—</span>
            </td>
          </tr>
        </tbody>
      </table>

      <h3 class="secao" *ngIf="financeiro">Dinheiro do movimento</h3>
      <p class="hint" *ngIf="financeiro && isAdmin">
        O percentual do desconto na assistência continua em
        <a routerLink="/configuracoes/bling">Configurações → Bling</a>.
        Vendas antigas já importadas do Bling seguem valendo na consulta de desconto.
      </p>
      <table class="data-grid" *ngIf="financeiro && operacoes.length">
        <thead>
          <tr>
            <th>Data</th>
            <th>Vendedor</th>
            <th>Tipo</th>
            <th>Pessoa</th>
            <th>Entrou</th>
            <th>Saiu</th>
            <th *ngIf="financeiro">Entrou R$</th>
            <th *ngIf="financeiro">Saiu R$</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let op of operacoes" [class.estornada]="op.status === 'estornada'">
            <td>{{ op.data | date:'dd/MM/yyyy HH:mm':'UTC' }}</td>
            <td>{{ op.vendedorNome || '—' }}</td>
            <td>
              {{ rotuloTipo(op.tipo) }}
              <div class="sub" *ngIf="op.financiadoraNome">{{ op.financiadoraNome }}</div>
              <div class="sub" *ngIf="op.formaNegociacao && op.formaNegociacao !== 'avista' && (op.formaNegociacao !== 'financiadora' || !op.financiadoraNome)">{{ rotuloForma(op.formaNegociacao) }}</div>
            </td>
            <td>
              {{ op.clienteNome || op.fornecedorNome || '—' }}
              <div class="sub" *ngIf="op.clienteCpf">{{ formatarDoc(op.clienteCpf) }}</div>
            </td>
            <td>{{ op.entradaResumo || '—' }}</td>
            <td>{{ op.saidaResumo || '—' }}</td>
            <td *ngIf="financeiro">
              {{ dinheiro(op.dinheiroRecebido) }}
              <div class="sub" *ngIf="op.financiadoraNome && (op.entradaLoja || op.repasseFinanciadora)">
                Entrada {{ dinheiro(op.entradaLoja) }} · Repasse {{ dinheiro(op.repasseFinanciadora) }}
              </div>
              <div class="sub" *ngIf="op.formaNegociacao === 'avista_cartao'">
                À vista {{ dinheiro(op.entradaLoja) }} · Cartão {{ dinheiro(op.repasseFinanciadora) }}
              </div>
            </td>
            <td *ngIf="financeiro">{{ dinheiro(op.dinheiroPago) }}</td>
            <td>
              <button
                type="button"
                class="secundario"
                *ngIf="op.podeEstornar"
                [disabled]="salvando"
                (click)="estornar(op)"
              >Desfazer</button>
              <button
                type="button"
                class="perigo"
                *ngIf="isAdmin && (op.podeEstornar || op.status === 'estornada')"
                [disabled]="salvando"
                (click)="excluirOperacao(op)"
              >Excluir</button>
              <span class="sub" *ngIf="op.status === 'estornada'">Desfeita</span>
            </td>
          </tr>
        </tbody>
      </table>

      <h3 class="secao" *ngIf="false">Por vendedor</h3>
      <table class="data-grid" *ngIf="false">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Entradas</th>
            <th>Vendas</th>
            <th>Trocas</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let v of vendedores">
            <td>{{ v.nome }}</td>
            <td>{{ v.entradas }}</td>
            <td>{{ v.vendas }}</td>
            <td>{{ v.trocas }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <app-novo-cliente-modal
      *ngIf="modalCliente"
      (clienteCriado)="onClienteCriado($event)"
      (fecharModal)="modalCliente = false"
    />

    <app-editar-aparelho-loja-modal
      *ngIf="aparelhoEmEdicao as a"
      [aparelho]="a"
      [marcas]="marcas"
      [podeExcluir]="isAdmin"
      (fechou)="cancelarEdicao()"
      (salvou)="aoSalvarEdicao($event)"
      (atualizou)="aoAtualizarEdicao($event)"
      (excluiu)="aoExcluirAparelho($event)"
    />
  `,
  styles: [`
    .hint { color: #64748b; font-size: 13px; margin: 0 0 14px; max-width: 820px; line-height: 1.45; }
    .codigo-etiqueta, .codigo-faixa { grid-column: 1 / -1; }
    .codigo-etiqueta { font-size: 48px; font-weight: 800; letter-spacing: 1px; margin: 0 0 8px; line-height: 1; }
    .codigo-banner { background: #0f172a; color: #fff; border-radius: 12px; padding: 16px 18px; margin: 0 0 16px; max-width: 920px; }
    .codigo-banner p { margin: 0 0 8px; color: #cbd5e1; }
    .codigo-banner strong { display: block; font-size: 64px; letter-spacing: 2px; line-height: 1; }
    .codigo-banner span { color: #e2e8f0; }
    .codigo-celula { font-size: 18px; font-weight: 800; }
    .flag-foto {
      display: inline-flex;
      align-items: center;
      padding: 1px 7px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1e3a8a;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .valor-positivo { color: #166534; font-weight: 700; }
    .valor-negativo { color: #9a3412; font-weight: 700; }
    td.margem { white-space: nowrap; }
    tr.selecionada td { background: #eff6ff; }
    tr.na-assistencia td { background: #fee2e2; }
    tr.na-assistencia.selecionada td, tr.na-assistencia:hover td { background: #fecaca; }
    .celula-situacao { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
    .info-os {
      display: inline-flex;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1.5px solid #9a3412;
      color: #9a3412;
      background: #fff;
      font-size: 11px;
      font-weight: 800;
      font-style: italic;
      font-family: Georgia, 'Times New Roman', serif;
      align-items: center;
      justify-content: center;
      cursor: help;
      line-height: 1;
      flex-shrink: 0;
    }
    .dica-flutuante {
      position: fixed;
      z-index: 5000;
      min-width: 180px;
      max-width: 280px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #7f1d1d;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      white-space: pre-line;
      pointer-events: none;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
    }
    .grade-codigo { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .grade-codigo button { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; }
    .campo-hint { margin: 4px 0 0; }
    .form-group app-autocomplete-criavel { display: block; }
    .form-row .grow { flex: 1; min-width: 220px; }
    .hint a, .page-header a { color: #1d4ed8; font-weight: 600; text-decoration: none; font-size: 13px; }
    .page-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .erro { color: #b91c1c; margin-bottom: 12px; }
    .campo-aviso { color: #b45309; font-size: 12px; }
    .check-label { display: flex; gap: 8px; align-items: center; margin: 0 0 8px; font-size: 14px; }
    td .secundario { margin-top: 6px; padding: 4px 8px; font-size: 12px; }
    .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 12px 14px; min-width: 180px; display: flex; flex-direction: column; gap: 4px;
    }
    .card span, .card small { color: #64748b; font-size: 12px; }
    .card strong { font-size: 18px; color: #0d0d0d; }
    .acoes { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0 4px; }
    .iniciar { margin: 0 0 8px; }
    .iniciar h3 { margin: 0 0 4px; font-size: 18px; }
    .modos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0 0 18px; }
    .modos button, .modos a {
      display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
      padding: 16px 18px; background: #2563eb; color: #fff; border: none; border-radius: 12px; text-align: left;
      min-height: 76px; text-decoration: none; cursor: pointer;
    }
    .modos button:hover, .modos a:hover { background: #1d4ed8; }
    .modos button strong, .modos a strong { font-size: 18px; color: #fff; }
    .modos button span, .modos a span { color: #dbeafe; font-size: 13px; font-weight: 500; line-height: 1.35; }
    .modos button.ativo, .modos a.ativo { background: #1e3a8a; outline: 3px solid #93c5fd; }
    .modos.visoes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .filtros-periodo { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
    .filtros-periodo button { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 999px; padding: 6px 12px; }
    .filtros-periodo button.ativo { background: #0f172a; color: #fff; border-color: #0f172a; }
    .filtro-vendedor { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 14px; }
    .filtro-vendedor label { font-size: 13px; font-weight: 600; }
    .filtro-vendedor select { min-width: 220px; }
    .grupo-aparelhos { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; margin: 0 0 4px; }
    .acoes-ficha a.secundario { display: inline-flex; align-items: center; text-decoration: none; padding: 8px 12px; border-radius: 8px; }
    .ficha-card { border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 12px; background: #fff; overflow: hidden; }
    .etapa { margin: 16px 0 8px; font-size: 13px; font-weight: 700; color: #0f172a; }
    .mais { margin: 8px 0 12px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; background: #f8fafc; }
    .mais summary { cursor: pointer; font-size: 13px; font-weight: 600; color: #334155; }
    @media (max-width: 720px) { .modos { grid-template-columns: 1fr; } }
    .secundario { background: #fff; color: #0d0d0d; border: 1px solid #cbd5e1; }
    .secundario:hover { background: #f8fafc; color: #0d0d0d; }
    .painel {
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 0 0 22px;
      background: #fff; max-width: 920px;
    }
    .painel .form-row { flex-wrap: wrap; }
    .painel .form-row .form-group { flex: 1 1 160px; min-width: 160px; }
    .valores-venda .form-group { flex: 1 1 220px; max-width: 320px; }
    .iphone-ficha { max-width: 640px; }
    .peca-linha { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: flex-end; margin-bottom: 8px; }
    .peca-linha .grow { flex: 1; min-width: 180px; }
    .painel h3, .painel h4 { margin: 0 0 8px; font-size: 15px; }
    .grow { flex: 1; min-width: 220px; }
    .diferenca {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 8px;
      background: #f0fdf4; border: 1px solid #86efac; color: #166534; font-size: 13px;
    }
    .prejuizo { color: #9a3412; font-size: 13px; margin: 6px 0 0; }
    .secao { margin-top: 28px; }
    .sub { color: #64748b; font-size: 11px; }
    .cadeia { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin: 8px 0; background: #fff; }
    .cadeia.aberta { border-color: #fdba74; }
    .cadeia.fechada { border-color: #86efac; }
    .cadeia.focada { outline: 2px solid #1d4ed8; outline-offset: 2px; }
    .cadeia-topo { display: flex; gap: 12px; align-items: baseline; width: 100%; background: transparent; border: 0; padding: 0; text-align: left; }
    button.cadeia-topo { cursor: pointer; }
    .passos { margin-top: 8px; }
    .passo { padding: 8px 0; border-top: 1px solid #f1f5f9; }
    .mes { margin: 16px 0 24px; }
    .link { background: none; border: 0; padding: 0; color: #1d4ed8; cursor: pointer; text-align: left; }
    .ficha-passo { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; padding: 8px 0; }
    .ficha-passo h4 { margin: 0 0 4px; font-size: 12px; }
    .lado p { margin: 0 0 2px; }
    .os-link { margin-left: 6px; }
    .imei-pendente { display: flex; gap: 6px; margin-top: 4px; }
    .imei-pendente input { flex: 1; min-width: 0; font-size: 12px; padding: 4px 6px; }
    .imei-pendente button { font-size: 12px; padding: 4px 8px; }
    tr.estornada { color: #94a3b8; }
    tr.clicavel { cursor: pointer; }
    tr.ficha td { background: #f8fafc; font-size: 13px; }
    select:disabled { opacity: 0.65; }
    .testes { display: flex; flex-wrap: wrap; gap: 8px 14px; }
    .testes label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .busca-estoque { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 14px; }
    .busca-estoque .form-group { min-width: 140px; }
    .busca-estoque select { min-width: 180px; }
    .busca-estoque .filtro-modelo { min-width: 260px; flex: 1.4; }
    .marca-estoque { margin: 18px 0 8px; font-size: 16px; }
    .marca-estoque span { margin-left: 8px; color: #64748b; font-size: 13px; font-weight: 500; }
    .grade-estoque { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 8px; }
    .card-aparelho { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; cursor: pointer; }
    .card-aparelho.aberta { outline: 2px solid #0f172a; grid-column: 1 / -1; }
    .ficha-grade { display: grid; grid-template-columns: minmax(240px, 360px) minmax(0, 1fr); gap: 16px; padding: 12px; background: #f8fafc; }
    .ficha-fotos h4, .ficha-dados h4 { margin: 0 0 8px; }
    .galeria { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 8px; }
    .galeria-item { position: relative; }
    .galeria-item.marcada .mini { outline: 3px solid #0f766e; }
    .marca-whats { position: absolute; top: 6px; left: 6px; z-index: 1; background: #fff; border-radius: 4px; padding: 2px; }
    .galeria .mini { width: 100%; padding: 0; border: 0; background: #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer; }
    .galeria img, .galeria video { width: 100%; height: 108px; object-fit: cover; display: block; }
    .foto-ampliada { margin: 8px 0; }
    .foto-ampliada img, .foto-ampliada video { width: 100%; max-height: 420px; object-fit: contain; background: #0f172a; border-radius: 8px; }
    .arquivo { display: inline-block; margin: 8px 8px 8px 0; cursor: pointer; }
    .ficha-dados dl { display: grid; gap: 6px; margin: 0 0 10px; }
    .ficha-dados dl div { display: flex; justify-content: space-between; gap: 12px; }
    .ficha-dados dt { color: #64748b; }
    .ficha-dados dd { margin: 0; font-weight: 600; text-align: right; }
    .ficha-dados label { display: block; margin: 8px 0; font-size: 13px; }
    .ficha-dados textarea, .ficha-dados input, .ficha-dados select { width: 100%; box-sizing: border-box; }
    .peca-linha { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .peca-linha input[type="text"], .peca-linha input:not([type="checkbox"]) { flex: 1; }
    .acoes-ficha { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .acoes-celula { white-space: nowrap; }
    .perigo { color: #9a3412; border-color: #fecaca; background: #fff; }
    button.link.perigo { border: 0; background: transparent; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 10100;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-box {
      background: #fff; border-radius: 12px; width: 100%; max-width: 760px; max-height: 90vh;
      display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25); overflow: hidden;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; background: #0d0d0d; color: #fff;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #fff; }
    .modal-close { background: transparent; border: 0; color: rgba(255,255,255,0.75); font-size: 18px; cursor: pointer; }
    .modal-close:hover { color: #fff; }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .modal-body .hint { margin-bottom: 12px; }
    .modal-body .codigo-etiqueta { font-size: 36px; margin-bottom: 4px; }
    .modal-body label { display: block; margin: 8px 0; font-size: 13px; }
    .modal-body textarea, .modal-body input, .modal-body select { width: 100%; box-sizing: border-box; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #e2e8f0;
    }
    @media (max-width: 720px) { .ficha-grade { grid-template-columns: 1fr; } }
    .card-aparelho .capa { width: 100%; height: 140px; object-fit: cover; background: #f1f5f9; display: block; }
    .card-aparelho .capa.vazia { display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; }
    .card-aparelho .corpo { padding: 10px 12px 12px; }
    .card-aparelho dl { display: grid; gap: 4px; margin: 8px 0; }
    .card-aparelho dl div { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
    .card-aparelho dt { color: #64748b; }
    .card-aparelho dd { margin: 0; font-weight: 600; text-align: right; }
    .ficha-card { padding: 0 12px 12px; cursor: default; }
    .fotos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; align-items: flex-start; }
    .foto-escolha { position: relative; display: block; }
    .foto-escolha input { position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; z-index: 1; }
    .foto-escolha.marcada img, .foto-escolha.marcada video { outline: 3px solid #0f766e; outline-offset: -3px; }
    .fotos img { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; }
    .fotos video { width: 180px; height: 120px; border-radius: 8px; background: #0f172a; }
    .os-ok { color: #166534; }
    .promocao {
      margin-top: 8px; padding: 10px 12px; border: 1px solid #86efac; border-radius: 8px;
      background: #f0fdf4; color: #166534; font-size: 13px; line-height: 1.45;
    }
    .juros { margin: 0 0 14px; }
    .grade-juros { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 8px; margin-top: 8px; }
    .grade-juros button {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      padding: 8px 10px; background: #fff; color: #0d0d0d; border: 1px solid #e2e8f0; border-radius: 8px;
    }
    .grade-juros button.ativo { outline: 2px solid #0d0d0d; }
    .grade-juros small { color: #64748b; }
    .os-alerta { color: #9a3412; }
    .alerta-permanente {
      margin: 8px 0 0; padding: 8px 10px; border-radius: 8px;
      background: #fff7ed; color: #9a3412; font-size: 13px; font-weight: 700; line-height: 1.4;
    }
    .entrada-troca { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px 4px; margin: 0 0 12px; }
    .entrada-troca-topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .entrada-troca-topo h4 { margin: 0 0 10px; }
    .qr-box { margin-top: 10px; }
    .qr { width: 180px; height: 180px; background: #fff; border-radius: 8px; }
    h3 { font-size: 15px; margin: 8px 0 10px; }
  `],
})
export class AparelhosLojaPage implements OnInit, OnDestroy {
  dicaAssistenciaAberta: { top: number; left: number; texto: string } | null = null;
  painel: AparelhoLojaPainel | null = null;
  carregando = false;
  salvando = false;
  erro = '';
  modo: Modo | null = null;
  modalCliente = false;
  cliente: BlingContato | null = null;
  clienteRef: BlingContatoRef | null = null;
  modelo: AutocompleteItem | null = null;
  readonly configuracoes = ['16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];
  readonly formasBusca = [
    { id: 'avista', nome: 'À vista' },
    { id: 'cartao', nome: 'Cartão de crédito' },
    { id: 'avista_cartao', nome: 'À vista + cartão' },
    { id: 'payjoy', nome: 'Payjoy' },
    { id: 'paymobi', nome: 'Paymobi' },
    { id: 'crefaz', nome: 'Crefaz' },
    { id: 'outra', nome: 'Outra' },
  ];
  buscaMarca = '';
  buscaModelo = '';
  buscaModeloId = '';
  buscaModeloLabel = '';
  buscaModeloMarca = '';
  modeloFiltroKey = 0;
  buscaConfig = '';
  buscaCor = '';
  buscaCodigo = '';
  buscaCodigoVenda = '';
  achadosCodigoVenda: AparelhoLojaItem[] = [];
  buscaCodigoTroca = '';
  achadosCodigoTroca: AparelhoLojaItem[] = [];
  visaoTransacoes: VisaoTransacoes = 'lista';
  avisoCadeia = '';
  buscaVendedor = '';
  filtroCodigoTx = '';
  filtroDataTx = '';
  filtroTipoTx = '';
  filtroModeloTx = '';
  filtroValorDeTx: number | null = null;
  filtroValorAteTx: number | null = null;
  gridTransacoes = new GridPaginationState();
  gridEstoque = new GridPaginationState();
  periodoDias: PeriodoDias = 30;
  readonly periodos: { dias: PeriodoDias; nome: string }[] = [
    { dias: 7, nome: '1 semana' },
    { dias: 14, nome: '2 semanas' },
    { dias: 30, nome: '1 mês' },
    { dias: 90, nome: '3 meses' },
  ];
  private codigoPendente = '';
  buscaCadeia = '';
  codigosRecem: { codigo: string; nome: string }[] = [];
  buscaValorDe: number | null = null;
  buscaValorAte: number | null = null;
  buscaForma = '';
  buscaEstado = '';
  marcas: MarcaAparelho[] = [];
  modelosEntrada: ModeloAparelho[] = [];
  modelosEntradaCarregando = false;
  marcaEntradaId = '';
  modeloEntradaId = '';
  corLista = '';
  entrada = this.entradaVazia();
  entradasTroca: FichaEntrada[] = [];
  private seqFicha = 0;
  private cacheCoresVenda = { chave: '', lista: [] as { cor: string; qtd: number }[] };
  private cacheCoresTroca = { chave: '', lista: [] as { cor: string; qtd: number }[] };
  compra = { valorPago: null as number | null, fornecedorNome: '' };
  venda = { aparelhoId: '', marca: '', modelo: '', cor: '', preco: null as number | null, desconto: null as number | null, acrescimo: null as number | null, observacoes: '', ...negociacaoVazia() };
  troca = { aparelhoSaidaId: '', marca: '', modelo: '', cor: '', precoSaida: null as number | null, desconto: null as number | null, acrescimo: null as number | null, ...negociacaoVazia(), ...this.diferencaTrocaVazia() };
  jurosCfg = carregarCalculoJurosConfig();
  jurosVendaAberto = false;
  jurosTrocaAberto = false;
  opcaoJurosVenda: OpcaoParcela | null = null;
  opcaoJurosTroca: OpcaoParcela | null = null;
  fichaId: string | null = null;
  editandoId = '';
  aparelhoEmEdicao: AparelhoLojaItem | null = null;
  salvandoEdicao = false;
  enviandoFotos = false;
  fotoAmpliada: { url?: string; tipo?: string } | null = null;
  edicao: {
    imei: string;
    cor: string;
    configuracao: string;
    condicao: string;
    valorVenda: number | null;
    valorMinimo: number | null;
    saudeBateria: number | null;
    bateriaPerfeita: '' | 'sim' | 'nao';
    observacoes: string;
    alerta: string;
    pecas: { nome: string; apareceMensagem: boolean }[];
  } | null = null;
  edicaoMarcaId = '';
  edicaoModelo: ModeloAparelho | null = null;
  edicaoModelos: ModeloAparelho[] = [];
  imeiInformado: Record<string, string> = {};
  fotosMarcadas = new Set<string>();
  enviandoWhatsapp = false;
  financeiro = false;
  tela: TelaLoja = 'estoque';
  fotos: File[] = [];
  videos: File[] = [];
  testes = this.testesVazios();
  qrAberto = false;
  qrAparelhoId = '';
  qrDataUrl = '';
  sessaoToken = '';
  fotosSessao: { id: string; url: string; tipo?: string }[] = [];
  private fotosNaSessao = 0;
  private imeisQr: string[] = [];
  private idsEstoqueAntes = new Set<string>();
  private abrirQrNoProximo = false;
  osConsulta: OsAbertaConsulta | null = null;
  osBuscando = false;
  private buscaOs?: ReturnType<typeof setTimeout>;
  private pollFotos?: ReturnType<typeof setInterval>;
  private imeisOsNova: string[] = [];

  constructor(
    private api: AparelhoLojaService,
    private aparelhos: AparelhosService,
    private route: ActivatedRoute,
    private router: Router,
    private appAuth: AppAuthService,
    private impressao: OsImpressaoService,
  ) {
    this.gridTransacoes.pageSize = 100;
    this.gridEstoque.pageSize = 100;
  }

  get isAdmin(): boolean {
    return this.appAuth.isAdmin();
  }

  get ehIphone(): boolean {
    return this.normalizar(`${this.modelo?.marcaNome || ''} ${this.modelo?.nome || ''}`).includes('iphone');
  }

  get estoque(): AparelhoLojaItem[] {
    return this.painel?.estoque ?? [];
  }

  get marcasBusca(): string[] {
    return this.opcoesDe('marca', () => true, this.estoque);
  }

  get estoqueFiltrado(): AparelhoLojaItem[] {
    const config = this.normalizar(this.buscaConfig);
    const cor = this.normalizar(this.buscaCor);
    const de = this.numeroBusca(this.buscaValorDe);
    const ate = this.numeroBusca(this.buscaValorAte);
    const porCodigo = this.buscaCodigo.trim()
      ? new Set(this.aparelhosPorCodigo(this.buscaCodigo, this.estoque).map(a => a.id))
      : null;
    return this.estoque.filter(a => {
      if (porCodigo && !porCodigo.has(a.id)) return false;
      if (this.buscaMarca && !this.igual(a.marca, this.buscaMarca)) return false;
      if ((this.buscaModeloId || this.buscaModelo) && !this.aparelhoBateModeloFiltro(a)) return false;
      if (this.buscaVendedor && !this.vendedorBate(a.vendedorEntradaId, a.vendedorEntradaNome)) return false;
      if (config && !this.normalizar(a.configuracao).includes(config)) return false;
      if (cor && !this.normalizar(a.cor).includes(cor)) return false;
      if (this.buscaEstado && !this.igual(a.condicao, this.buscaEstado)) return false;
      if (this.buscaForma && this.formaDe(a) !== this.buscaForma) return false;
      const valor = Number(a.valorVenda) || 0;
      if (de != null && valor < de) return false;
      if (ate != null && valor > ate) return false;
      return true;
    });
  }

  get disponiveis(): AparelhoLojaItem[] {
    return this.estoque.filter(a => a.status === 'em_estoque');
  }

  get disponiveisPorMarca(): { marca: string; qtd: number }[] {
    return this.agruparPorMarca(this.disponiveis).map(g => ({ marca: g.marca, qtd: g.itens.length }));
  }

  get estoquePorMarca(): { marca: string; itens: AparelhoLojaItem[]; disponiveis: number }[] {
    return this.agruparPorMarca(this.estoqueFiltrado).map(g => ({
      marca: g.marca,
      itens: g.itens,
      disponiveis: g.itens.filter(a => a.status === 'em_estoque').length,
    }));
  }

  textoDisponiveis(qtd: number): string {
    return qtd === 1 ? '1 disponível' : `${qtd} disponíveis`;
  }

  get marcasVenda(): string[] {
    const mapa = new Map<string, string>();
    const guardar = (nome?: string | null) => {
      const texto = (nome || '').trim();
      if (!texto) return;
      const chave = texto.toLowerCase();
      if (!mapa.has(chave)) mapa.set(chave, texto);
    };
    for (const m of this.marcas) guardar(m.nome);
    for (const a of this.estoque) guardar(a.marca);
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  get modelosVenda(): string[] {
    return this.opcoesDe('modelo', a => this.igual(a.marca, this.venda.marca));
  }

  get coresVenda(): { cor: string; qtd: number }[] {
    return this.coresEmCache(this.cacheCoresVenda, this.venda.marca, this.venda.modelo);
  }

  get unidadesVenda(): AparelhoLojaItem[] {
    return this.unidadesDe(this.venda.marca, this.venda.modelo, this.venda.cor);
  }

  get aparelhoVendaSelecionado(): AparelhoLojaItem | null {
    const daLista = this.unidadeDaLista(this.venda.aparelhoId, this.unidadesVenda);
    if (daLista) return daLista;
    if (!this.venda.aparelhoId) return null;
    return this.disponiveis.find(a => a.id === this.venda.aparelhoId) ?? null;
  }

  get aparelhoFicha(): AparelhoLojaItem | null {
    if (!this.fichaId) return null;
    return this.estoque.find(a => a.id === this.fichaId) ?? null;
  }

  get movimentos(): AparelhoMovimentoLinha[] {
    return this.painel?.movimentos ?? [];
  }

  get tituloTela(): string {
    if (this.tela === 'compra') return 'Compra';
    if (this.tela === 'venda') return 'Venda';
    if (this.tela === 'troca') return 'Troca';
    if (this.tela === 'estoque') return 'Estoque';
    if (this.tela === 'transacoes') return 'Transações';
    return 'Financeiro dos aparelhos';
  }

  get dicaTela(): string {
    if (this.tela === 'compra') return 'A loja recebe um aparelho. O código das costas o sistema gera na entrada — não precisa informar.';
    if (this.tela === 'venda') return 'Busque pelo código que o sistema gerou na entrada, ou escolha marca e modelo.';
    if (this.tela === 'troca') return 'O aparelho que sai se busca pelo código das costas. O que entra ganha um código novo na hora.';
    if (this.tela === 'estoque') return 'Clique na linha para ver o cadastro. Editar abre uma janela. Compra, venda e troca ficam nos botões acima.';
    if (this.tela === 'transacoes') return 'Uma linha por negócio. Filtre por código, data, tipo, vendedor, modelo e valor. A grid mostra 100 por página.';
    return 'Valor de estoque e o dinheiro que entrou e saiu. Esta parte fica só para administrador.';
  }

  get transacoesFiltradas(): AparelhoOperacao[] {
    const tipo = this.filtroTipoTx;
    const modelo = this.normalizar(this.filtroModeloTx);
    const de = this.numeroBusca(this.filtroValorDeTx);
    const ate = this.numeroBusca(this.filtroValorAteTx);
    return this.operacoes.filter(op => {
      if (!this.noPeriodo(op.data)) return false;
      if (!this.vendedorBate(op.vendedorId, op.vendedorNome)) return false;
      if (tipo && op.tipo !== tipo) return false;
      if (this.filtroCodigoTx.trim() && !this.transacaoBateCodigo(op, this.filtroCodigoTx)) return false;
      if (modelo && !this.transacaoBateModelo(op, this.filtroModeloTx)) return false;
      if (de != null || ate != null) {
        const valor = this.valorTransacao(op);
        if (de != null && valor < de) return false;
        if (ate != null && valor > ate) return false;
      }
      return true;
    });
  }

  get transacoesPaginadas(): AparelhoOperacao[] {
    return this.gridTransacoes.paginate(this.transacoesFiltradas);
  }

  get cadeiasDoPeriodo() {
    const lista = this.cadeiasVisiveis;
    const noTempo = this.buscaCadeia.trim()
      ? lista
      : lista.filter(c => this.noPeriodo(c.inicio) || c.passos.some(p => this.noPeriodo(p.data)));
    const comVendedor = this.buscaVendedor
      ? noTempo.filter(c => c.passos.some(p =>
        this.vendedorBate(p.vendedorId || this.vendedorIdDaOperacao(p.operacaoId), p.vendedorNome || this.vendedorDaOperacao(p.operacaoId))))
      : noTempo;
    if (!this.cadeiaAberta) return comVendedor;
    const foco = this.cadeias.find(c => c.id === this.cadeiaAberta);
    if (!foco || comVendedor.some(c => c.id === foco.id)) return comVendedor;
    return [foco, ...comVendedor];
  }

  private vendedoresCacheChave = '';
  private vendedoresCache: AparelhoVendedorCadastro[] = [];

  trackVendedor = (_: number, v: AparelhoVendedorCadastro) => v.id || v.nome;

  get vendedoresCadastrados(): AparelhoVendedorCadastro[] {
    const chave = [
      (this.painel?.vendedoresCadastrados ?? []).map(v => `${v.id}:${v.nome}`).join('|'),
      this.operacoes.map(op => `${op.vendedorId}:${op.vendedorNome}`).join('|'),
      this.estoque.map(a => `${a.vendedorEntradaId}:${a.vendedorEntradaNome}`).join('|'),
    ].join('/');
    if (chave === this.vendedoresCacheChave) return this.vendedoresCache;
    const mapa = new Map<string, AparelhoVendedorCadastro>();
    const guardar = (id?: string | null, nome?: string | null) => {
      const texto = (nome || '').trim();
      if (!texto) return;
      const k = this.normalizar(texto);
      const atual = mapa.get(k);
      if (!atual) {
        mapa.set(k, { id: id || undefined, nome: texto });
        return;
      }
      if (!atual.id && id) atual.id = id;
    };
    for (const v of this.painel?.vendedoresCadastrados ?? []) guardar(v.id, v.nome);
    for (const op of this.operacoes) guardar(op.vendedorId, op.vendedorNome);
    for (const a of this.estoque) guardar(a.vendedorEntradaId, a.vendedorEntradaNome);
    this.vendedoresCacheChave = chave;
    this.vendedoresCache = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return this.vendedoresCache;
  }

  get resultadosPorVendedor(): {
    nome: string;
    compras: number;
    vendas: number;
    trocas: number;
    entrou: number;
    saiu: number;
    resultado: number;
  }[] {
    const noPeriodo = this.operacoes.filter(op => this.noPeriodo(op.data) && op.status !== 'estornada');
    return this.vendedoresCadastrados.map(v => {
      const ops = noPeriodo.filter(op => this.vendedorBateCadastro(op.vendedorId, op.vendedorNome, v));
      const entrou = ops.reduce((s, op) => s + (Number(op.dinheiroRecebido) || 0), 0);
      const saiu = ops.reduce((s, op) => s + (Number(op.dinheiroPago) || 0), 0);
      return {
        nome: v.nome,
        compras: ops.filter(op => op.tipo === 'compra').length,
        vendas: ops.filter(op => op.tipo === 'venda').length,
        trocas: ops.filter(op => op.tipo === 'troca').length,
        entrou,
        saiu,
        resultado: Math.round((entrou - saiu) * 100) / 100,
      };
    });
  }

  get resumoVendedor(): {
    nome: string;
    compras: number;
    vendas: number;
    trocas: number;
    entrou: number;
    saiu: number;
    resultado: number;
  } | null {
    if (!this.buscaVendedor) return null;
    const ops = this.transacoesFiltradas.filter(op => op.status !== 'estornada');
    const entrou = ops.reduce((s, op) => s + (Number(op.dinheiroRecebido) || 0), 0);
    const saiu = ops.reduce((s, op) => s + (Number(op.dinheiroPago) || 0), 0);
    return {
      nome: this.buscaVendedor,
      compras: ops.filter(op => op.tipo === 'compra').length,
      vendas: ops.filter(op => op.tipo === 'venda').length,
      trocas: ops.filter(op => op.tipo === 'troca').length,
      entrou,
      saiu,
      resultado: Math.round((entrou - saiu) * 100) / 100,
    };
  }

  get cadeiasVisiveis() {
    return this.cadeiasDoTermo(this.buscaCadeia);
  }

  get aparelhoTrocaSelecionado(): AparelhoLojaItem | null {
    const daLista = this.unidadeDaLista(this.troca.aparelhoSaidaId, this.unidadesTroca);
    if (daLista) return daLista;
    if (!this.troca.aparelhoSaidaId) return null;
    return this.disponiveis.find(a => a.id === this.troca.aparelhoSaidaId) ?? null;
  }

  get modelosTroca(): string[] {
    return this.opcoesDe('modelo', a => this.igual(a.marca, this.troca.marca));
  }

  get coresTroca(): { cor: string; qtd: number }[] {
    return this.coresEmCache(this.cacheCoresTroca, this.troca.marca, this.troca.modelo);
  }

  get unidadesTroca(): AparelhoLojaItem[] {
    return this.unidadesDe(this.troca.marca, this.troca.modelo, this.troca.cor);
  }

  get coresEntrada(): string[] {
    if (!this.modelo?.id) return [];
    return this.opcoesDe('cor', a => a.modeloId === this.modelo?.id, this.estoque);
  }

  get temOsInformada(): boolean {
    return this.osAberta;
  }

  get osAberta(): boolean {
    return !!this.osConsulta?.encontrada && !!this.osConsulta.aberta;
  }

  get osEncerrada(): boolean {
    return !!this.osConsulta?.encontrada && !this.osConsulta.aberta;
  }

  get osNaoEncontrada(): boolean {
    return !!this.osConsulta && !this.osConsulta.encontrada && apenasDigitos(this.entrada.osNumero).length > 0;
  }

  get osImeiDiverge(): boolean {
    const imeiOs = apenasDigitos(this.osConsulta?.imei);
    const imei = apenasDigitos(this.entrada.imei);
    return this.osAberta && imeiOs.length === 15 && imei.length === 15 && imeiOs !== imei;
  }

  get operacoes(): AparelhoOperacao[] {
    return this.painel?.operacoes ?? [];
  }

  get lucroVendasAdmin(): LucroVendas {
    return this.lucroDasVendas(this.operacoes);
  }

  get lucroVendasPeriodo(): LucroVendas {
    return this.lucroDasVendas(this.transacoesFiltradas);
  }

  get vendedores(): AparelhoVendedorResumo[] {
    return this.painel?.resumo.porVendedor ?? [];
  }

  get custosAssistencia(): AparelhoLojaItem[] {
    return this.painel?.custosAssistencia ?? [];
  }

  get alertaImei(): string {
    return mensagemAlertaImei(this.entrada.imei);
  }

  get aparelhoPromocaoVenda(): AparelhoLojaItem | null {
    return this.unidadeEscolhida(this.venda.aparelhoId, this.unidadesVenda);
  }

  get aparelhoPromocaoTroca(): AparelhoLojaItem | null {
    return this.unidadeEscolhida(this.troca.aparelhoSaidaId, this.unidadesTroca);
  }

  get clienteSemDocumento(): boolean {
    if (!this.cliente) return false;
    const d = apenasDigitos(this.cliente.cpfCnpj);
    return d.length !== 11 && d.length !== 14;
  }

  get descontoMaxPct(): number {
    const n = Number(this.painel?.descontoVendaMaxPercentual);
    return Number.isFinite(n) ? n : 5;
  }

  get acrescimoMaxPct(): number {
    const n = Number(this.painel?.acrescimoFinanciadoraMaxPercentual);
    return Number.isFinite(n) ? n : 10;
  }

  get precoCobradoVenda(): number | null {
    return this.precoCobrado(this.venda.preco, this.venda.desconto, this.venda.acrescimo, this.venda.forma);
  }

  get precoCobradoTroca(): number | null {
    return this.precoCobrado(this.troca.precoSaida, this.troca.desconto, this.troca.acrescimo, this.troca.forma);
  }

  get baseCartaoVenda(): number {
    return this.precoCobrado(this.venda.preco, this.venda.desconto, 0, 'avista') ?? 0;
  }

  get baseCartaoTroca(): number {
    return this.precoCobrado(this.troca.precoSaida, this.troca.desconto, 0, 'avista') ?? 0;
  }

  get baseParcelasVenda(): number {
    if (this.venda.forma === 'avista_cartao') return Math.max(0, this.centavos(this.venda.repasse));
    return this.baseCartaoVenda;
  }

  get baseParcelasTroca(): number {
    if (this.troca.forma === 'avista_cartao') return Math.max(0, this.centavos(this.troca.repasse));
    if (this.troca.forma === 'cartao') return Math.max(0, this.diferencaTroca ?? 0);
    return this.baseCartaoTroca;
  }

  ehFinanciada(forma: FormaNegociacao): boolean {
    return forma === 'payjoy' || forma === 'paymobi' || forma === 'crefaz' || forma === 'outra';
  }

  get somaAvaliados(): number | null {
    if (!this.entradasTroca.length) return null;
    let soma = 0;
    for (const ficha of this.entradasTroca) {
      if (ficha.valorAvaliado == null || Number.isNaN(Number(ficha.valorAvaliado))) return null;
      soma += Number(ficha.valorAvaliado);
    }
    return Math.round(soma * 100) / 100;
  }

  get diferencaTroca(): number | null {
    if (!(this.baseCartaoTroca > 0) || this.somaAvaliados == null) return null;
    return Math.round((this.baseCartaoTroca - this.somaAvaliados) * 100) / 100;
  }

  get diferencaDigitada(): number {
    return this.centavos(this.troca.diferenca);
  }

  get caixaVenda(): number {
    return this.caixaAgora(this.venda);
  }

  get caixaTroca(): number {
    return this.caixaAgora(this.troca);
  }

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.financeiro = data['financeiro'] === true;
    const tela = data['tela'] as TelaLoja | undefined;
    this.tela = this.financeiro ? 'financeiro' : (tela ?? 'estoque');
    this.codigoPendente = this.route.snapshot.queryParamMap.get('codigo') ?? '';
    if (this.tela === 'transacoes' && this.codigoPendente) {
      this.buscaCadeia = this.codigoPendente;
      this.visaoTransacoes = 'cadeia';
    }
    if (this.tela === 'compra' || this.tela === 'venda' || this.tela === 'troca') this.abrir(this.tela);
    this.aparelhos.listarMarcas(undefined, 'Celular').subscribe({
      next: marcas => { this.marcas = marcas ?? []; },
      error: () => { this.marcas = []; },
    });
    this.carregar();
  }

  ngOnDestroy(): void {
    this.pararPoll();
    if (this.buscaOs) clearTimeout(this.buscaOs);
    for (const ficha of this.entradasTroca) {
      if (ficha.buscaOs) clearTimeout(ficha.buscaOs);
    }
  }

  abrir(modo: Modo): void {
    this.fecharQr();
    this.codigosRecem = [];
    this.buscaCodigoVenda = '';
    this.achadosCodigoVenda = [];
    this.buscaCodigoTroca = '';
    this.achadosCodigoTroca = [];
    this.modo = modo;
    this.erro = '';
    this.cliente = null;
    this.clienteRef = null;
    this.modelo = null;
    this.marcaEntradaId = '';
    this.modeloEntradaId = '';
    this.modelosEntrada = [];
    this.corLista = '';
    this.entrada = this.entradaVazia(modo === 'troca' ? 'usado' : 'usado');
    this.testes = this.testesVazios();
    this.fotos = [];
    this.videos = [];
    this.osConsulta = null;
    this.osBuscando = false;
    this.compra = { valorPago: null, fornecedorNome: '' };
    this.venda = { aparelhoId: '', marca: '', modelo: '', cor: '', preco: null, desconto: null, acrescimo: null, observacoes: '', ...negociacaoVazia() };
    this.troca = { aparelhoSaidaId: '', marca: '', modelo: '', cor: '', precoSaida: null, desconto: null, acrescimo: null, ...negociacaoVazia(), ...this.diferencaTrocaVazia() };
    this.entradasTroca = [this.novaFicha()];
    this.jurosVendaAberto = false;
    this.jurosTrocaAberto = false;
    this.opcaoJurosVenda = null;
    this.opcaoJurosTroca = null;
  }

  buscarModeloEntradaFn = (termo: string): Observable<AutocompleteItem[]> => {
    const marcaId = this.marcaEntradaId;
    if (!marcaId) return of([]);
    if (this.modelosEntrada.length > 0) return of(this.sugerirCatalogo(this.modelosEntrada, termo));
    if (!this.modelosEntradaCarregando) return of([]);
    return this.aparelhos.buscarModelos(termo, marcaId, 'Celular').pipe(
      map(lista => this.sugerirCatalogo(lista ?? [], termo)),
    );
  };

  buscarModeloVendaFn = (termo: string): Observable<AutocompleteItem[]> =>
    of(this.sugerirDoEstoque(this.modelosVenda, termo, this.venda.marca));

  buscarModeloTrocaFn = (termo: string): Observable<AutocompleteItem[]> =>
    of(this.sugerirDoEstoque(this.modelosTroca, termo, this.troca.marca));

  onMarcaEntrada(id: string): void {
    this.marcaEntradaId = id;
    this.modeloEntradaId = '';
    this.modelo = null;
    this.modelosEntrada = [];
    this.corLista = '';
    this.entrada.cor = '';
    if (!id) {
      this.modelosEntradaCarregando = false;
      return;
    }
    this.modelosEntradaCarregando = true;
    this.aparelhos.listarModelos({ marcaId: id, tipoDispositivo: 'Celular', limite: MODELO_LIMITE_LISTA }).subscribe({
      next: lista => {
        if (this.marcaEntradaId !== id) return;
        this.modelosEntrada = lista ?? [];
        this.modelosEntradaCarregando = false;
      },
      error: () => {
        if (this.marcaEntradaId !== id) return;
        this.modelosEntrada = [];
        this.modelosEntradaCarregando = false;
      },
    });
  }

  onModeloEntradaItem(item: AutocompleteItem | null): void {
    this.corLista = '';
    this.entrada.cor = '';
    if (!item?.id || !item.nome?.trim()) {
      this.modelo = null;
      this.modeloEntradaId = '';
      return;
    }
    const marca = this.marcas.find(m => m.id === this.marcaEntradaId);
    this.modeloEntradaId = item.id;
    this.modelo = {
      id: item.id,
      nome: item.nome.trim(),
      marcaId: this.marcaEntradaId,
      marcaNome: marca?.nome || '',
    };
  }

  onVendaModeloItem(item: AutocompleteItem | null): void {
    this.onVendaModelo(item?.nome ?? '');
  }

  onTrocaModeloItem(item: AutocompleteItem | null): void {
    this.onTrocaModelo(item?.nome ?? '');
  }

  bloquearEnterDaBusca(event: Event): void {
    const alvo = event.target as HTMLElement | null;
    if (alvo?.closest('app-autocomplete-criavel')) event.preventDefault();
  }

  onCorLista(cor: string): void {
    this.corLista = cor;
    this.entrada.cor = cor === '__nova' ? '' : cor;
  }

  onVendaMarca(marca: string): void {
    this.venda.marca = marca;
    this.venda.modelo = '';
    this.venda.cor = '';
    this.aplicarPrecoVenda(this.fixarUnidade(this.unidadesVenda, id => { this.venda.aparelhoId = id; }));
  }

  onVendaModelo(modelo: string): void {
    this.venda.modelo = modelo;
    this.venda.cor = '';
    this.aplicarPrecoVenda(this.fixarUnidade(this.unidadesVenda, id => { this.venda.aparelhoId = id; }));
  }

  onVendaCor(cor: string): void {
    this.venda.cor = cor;
    this.aplicarPrecoVenda(this.fixarUnidade(this.unidadesVenda, id => { this.venda.aparelhoId = id; }));
  }

  onVendaAparelho(id: string): void {
    this.venda.aparelhoId = id;
    this.aplicarPrecoVenda(this.unidadesVenda.find(a => a.id === id) ?? null);
  }

  onTrocaMarca(marca: string): void {
    this.troca.marca = marca;
    this.troca.modelo = '';
    this.troca.cor = '';
    this.aplicarPrecoTroca(this.fixarUnidade(this.unidadesTroca, id => { this.troca.aparelhoSaidaId = id; }));
  }

  onTrocaModelo(modelo: string): void {
    this.troca.modelo = modelo;
    this.troca.cor = '';
    this.aplicarPrecoTroca(this.fixarUnidade(this.unidadesTroca, id => { this.troca.aparelhoSaidaId = id; }));
  }

  onTrocaCor(cor: string): void {
    this.troca.cor = cor;
    this.aplicarPrecoTroca(this.fixarUnidade(this.unidadesTroca, id => { this.troca.aparelhoSaidaId = id; }));
  }

  onTrocaAparelho(id: string): void {
    this.troca.aparelhoSaidaId = id;
    this.aplicarPrecoTroca(this.unidadesTroca.find(a => a.id === id) ?? null);
  }

  abaixoDoMinimo(preco: number | null, desconto: number | null, minimo?: number | null): boolean {
    const piso = this.centavos(minimo);
    if (!(piso > 0)) return false;
    return this.centavos(this.centavos(preco) - this.centavos(desconto)) < piso;
  }

  onImei(valor: string): void {
    this.entrada.imei = apenasDigitos(valor).slice(0, 15);
  }

  onOsNumero(valor: string): void {
    this.entrada.osNumero = apenasDigitos(valor);
    this.osConsulta = null;
    if (this.buscaOs) clearTimeout(this.buscaOs);
    if (!this.entrada.osNumero) {
      this.osBuscando = false;
      return;
    }
    this.osBuscando = true;
    const numero = this.entrada.osNumero;
    this.buscaOs = setTimeout(() => this.buscarOs(numero), 400);
  }

  private buscarOs(numero: string): void {
    this.api.consultarOs(numero).subscribe({
      next: os => {
        if (this.entrada.osNumero !== numero) return;
        this.osConsulta = os;
        this.osBuscando = false;
        if (os.encontrada && os.aberta && os.imei && !this.entrada.imei) this.entrada.imei = os.imei;
      },
      error: () => {
        if (this.entrada.osNumero !== numero) return;
        this.osBuscando = false;
        this.osConsulta = null;
      },
    });
  }

  onMidia(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    const videos = arquivos.filter(a => this.arquivoVideo(a));
    const fotos = arquivos.filter(a => !this.arquivoVideo(a));
    const videoGrande = videos.find(a => a.size > 40 * 1024 * 1024);
    const fotoGrande = fotos.find(a => a.size > 8 * 1024 * 1024);
    if (videoGrande) avisarErroUsuario('Cada vídeo pode ter no máximo 40 MB.');
    else if (fotoGrande) avisarErroUsuario('Cada foto pode ter no máximo 8 MB.');
    this.fotos = fotos.filter(a => a.size <= 8 * 1024 * 1024).slice(0, 12);
    this.videos = videos.filter(a => a.size <= 40 * 1024 * 1024).slice(0, 3);
  }

  ehVideo(item: { tipo?: string; url?: string }): boolean {
    if (item.tipo === 'video') return true;
    return /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(item.url ?? '');
  }

  get textoMidiaSelecionada(): string {
    return this.textoMidia(this.fotos.length, this.videos.length);
  }

  get textoMidiaRecebida(): string {
    const videos = this.fotosSessao.filter(f => this.ehVideo(f)).length;
    const total = this.fotosSessao.length;
    const recebido = total === 1 ? 'recebido' : 'recebidos';
    return this.textoMidia(total - videos, videos) + ` ${recebido} do celular.`;
  }

  private chaveFoto(foto: { id?: string; url?: string }): string {
    return foto.id || foto.url || '';
  }

  private textoWhatsapp(a: AparelhoLojaItem): string {
    const linhas = [this.nomeAparelho(a), a.imei ? `IMEI ${a.imei}` : '', this.rotuloCondicao(a.condicao)];
    if (a.saudeBateria != null) linhas.push(`Bateria ${a.saudeBateria}%`);
    if (a.bateriaPerfeita === true) linhas.push('Bateria em perfeitas condições');
    if (a.bateriaPerfeita === false) linhas.push('Bateria fora das perfeitas condições');
    if (a.alertaPermanente?.trim()) linhas.push(`Alerta permanente: ${a.alertaPermanente.trim()}`);
    const pecas = this.textoPecas(a);
    if (pecas) linhas.push(`Peças trocadas: ${pecas}`);
    return linhas.filter(linha => !!linha.trim()).join('\n');
  }

  private nomeArquivoWhatsapp(foto: { url?: string; tipo?: string }, indice: number): string {
    const url = foto.url ?? '';
    const ext = (url.match(/\.([a-z0-9]+)(\?|$)/i)?.[1] || (this.ehVideo(foto) ? 'mp4' : 'jpg')).toLowerCase();
    return `aparelho-${indice + 1}.${ext}`;
  }

  private tipoPeloNome(nome: string): string {
    if (/\.(mp4|m4v)$/i.test(nome)) return 'video/mp4';
    if (/\.mov$/i.test(nome)) return 'video/quicktime';
    if (/\.webm$/i.test(nome)) return 'video/webm';
    if (/\.3gp$/i.test(nome)) return 'video/3gpp';
    if (/\.png$/i.test(nome)) return 'image/png';
    if (/\.webp$/i.test(nome)) return 'image/webp';
    return 'image/jpeg';
  }

  private baixarArquivos(files: File[]): void {
    for (const arquivo of files) {
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = arquivo.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  private arquivoVideo(arquivo: File): boolean {
    return arquivo.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(arquivo.name);
  }

  private textoMidia(fotos: number, videos: number): string {
    const partes: string[] = [];
    if (fotos === 1) partes.push('1 foto');
    else if (fotos > 1) partes.push(`${fotos} fotos`);
    if (videos === 1) partes.push('1 vídeo com áudio');
    else if (videos > 1) partes.push(`${videos} vídeos com áudio`);
    return partes.join(' e ');
  }

  abrirQrAparelho(a: AparelhoLojaItem): void {
    if (!a.id) return;
    if (this.qrAparelhoId === a.id && this.qrAberto && this.sessaoToken) {
      this.iniciarPoll();
      return;
    }
    this.fecharQr();
    this.qrAparelhoId = a.id;
    this.qrAberto = true;
    this.api.criarSessaoFotos(a.id).subscribe({
      next: async sessao => {
        if (this.qrAparelhoId !== a.id) return;
        this.sessaoToken = sessao.token;
        this.fotosNaSessao = 0;
        this.qrDataUrl = await QRCode.toDataURL(sessao.url, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
        this.iniciarPoll();
      },
      error: (err: { error?: { erro?: string } }) => {
        this.fecharQr();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível gerar o QR.');
      },
    });
  }

  cancelar(): void {
    this.fecharQr();
    void this.router.navigate(['/vendas-celulares/estoque']);
  }

  onBuscaCodigoVenda(termo: string): void {
    this.buscaCodigoVenda = termo;
    const achados = this.aparelhosPorCodigo(termo, this.disponiveis);
    this.achadosCodigoVenda = achados;
    if (achados.length === 1) this.escolherVendaPorCodigo(achados[0]);
  }

  escolherVendaPorCodigo(a: AparelhoLojaItem): void {
    this.venda.marca = a.marca;
    this.venda.modelo = a.modelo;
    this.venda.cor = a.cor;
    this.venda.aparelhoId = a.id || '';
    this.aplicarPrecoVenda(a);
  }

  onBuscaCodigoTroca(termo: string): void {
    this.buscaCodigoTroca = termo;
    const achados = this.aparelhosPorCodigo(termo, this.disponiveis);
    this.achadosCodigoTroca = achados;
    if (achados.length === 1) this.escolherTrocaPorCodigo(achados[0]);
  }

  escolherTrocaPorCodigo(a: AparelhoLojaItem): void {
    this.troca.marca = a.marca;
    this.troca.modelo = a.modelo;
    this.troca.cor = a.cor;
    this.troca.aparelhoSaidaId = a.id || '';
    this.aplicarPrecoTroca(a);
  }

  aparelhosSaiu(op: AparelhoOperacao): AparelhoCadeiaItem[] {
    return op.saiu?.length ? op.saiu : [];
  }

  aparelhosEntrou(op: AparelhoOperacao): AparelhoCadeiaItem[] {
    return op.entrou?.length ? op.entrou : [];
  }

  textoAparelhoGrupo(a: AparelhoCadeiaItem): string {
    const partes = [a.codigo, a.nome, a.imei ? `IMEI ${a.imei}` : ''].filter(s => !!s);
    return partes.join(' · ') || 'aparelho';
  }

  abrirVisaoCadeia(): void {
    this.visaoTransacoes = 'cadeia';
    this.avisoCadeia = '';
    if (!this.cadeiaAberta && this.cadeiasDoPeriodo.length === 1) {
      this.cadeiaAberta = this.cadeiasDoPeriodo[0].id;
    }
  }

  abrirCadeiaDaOperacao(op: AparelhoOperacao): void {
    const ids = new Set([
      ...(op.saiu ?? []).map(a => a.aparelhoId),
      ...(op.entrou ?? []).map(a => a.aparelhoId),
    ].filter((id): id is string => !!id));
    const cadeia = this.cadeias.find(c =>
      c.passos.some(p => p.operacaoId === op.id)
      || c.passos.some(p => [...p.entrou, ...p.saiu].some(a => a.aparelhoId && ids.has(a.aparelhoId))));
    this.visaoTransacoes = 'cadeia';
    this.buscaCadeia = '';
    if (cadeia) {
      this.avisoCadeia = '';
      this.cadeiaAberta = cadeia.id;
      this.rolarAteCadeia(cadeia.id);
      return;
    }
    this.cadeiaAberta = '';
    this.avisoCadeia = op.tipo === 'compra'
      ? 'Compra ainda não tem cadeia. A cadeia aparece quando esse aparelho entra numa troca ou numa venda.'
      : 'Não encontrei a cadeia desta transação. Ela só existe depois de uma troca ou venda.';
  }

  private noPeriodo(dataIso?: string | null): boolean {
    if (!dataIso) return false;
    if (this.filtroDataTx) return this.dataTransacaoBate(dataIso, this.filtroDataTx);
    const t = Date.parse(dataIso);
    if (!Number.isFinite(t)) return false;
    return t >= Date.now() - this.periodoDias * 24 * 60 * 60 * 1000;
  }

  escolherVendedor(nome: string): void {
    this.buscaVendedor = this.buscaVendedor === nome ? '' : nome;
    this.resetPaginaTransacoes();
  }

  escolherPeriodo(dias: PeriodoDias): void {
    this.periodoDias = dias;
    this.resetPaginaTransacoes();
  }

  resetPaginaTransacoes(): void {
    this.gridTransacoes.reset();
  }

  codigosTransacao(op: AparelhoOperacao): string {
    const itens = [...this.aparelhosEntrou(op), ...this.aparelhosSaiu(op)];
    const codes = [...new Set(itens.map(a => (a.codigo || '').trim()).filter(c => !!c))];
    return codes.join(' · ') || '—';
  }

  valorTransacao(op: AparelhoOperacao): number {
    const caixa = Math.max(Number(op.dinheiroRecebido) || 0, Number(op.dinheiroPago) || 0);
    if (caixa > 0) return caixa;
    const itens = [...this.aparelhosEntrou(op), ...this.aparelhosSaiu(op)];
    return itens.reduce((m, a) => Math.max(m, Number(a.valor) || 0), 0);
  }

  private transacaoBateCodigo(op: AparelhoOperacao, termo: string): boolean {
    const t = termo.trim().toUpperCase().replace(/\s+/g, '');
    if (!t) return true;
    const itens = [...this.aparelhosEntrou(op), ...this.aparelhosSaiu(op)];
    return itens.some(a => {
      const c = (a.codigo || '').toUpperCase();
      if (!c) return false;
      if (/^[NU]\d+$/.test(t)) return c === t;
      if (/^\d+$/.test(t)) return c.slice(1) === String(Number(t));
      return c.startsWith(t);
    });
  }

  private transacaoBateModelo(op: AparelhoOperacao, termo: string): boolean {
    const tokens = this.normalizar(termo).split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    const itens = [...this.aparelhosEntrou(op), ...this.aparelhosSaiu(op)];
    return itens.some(a => {
      const hay = this.normalizar(`${a.codigo || ''} ${a.nome || ''}`);
      return tokens.every(tok => hay.includes(tok));
    });
  }

  private dataTransacaoBate(iso: string, ymd: string): boolean {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const chave = [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0'),
    ].join('-');
    return chave === ymd;
  }

  private vendedorBate(id?: string | null, nome?: string | null): boolean {
    if (!this.buscaVendedor) return true;
    const escolhido = this.vendedoresCadastrados.find(v => this.igual(v.nome, this.buscaVendedor));
    return this.vendedorBateCadastro(id, nome, escolhido ?? { nome: this.buscaVendedor });
  }

  private vendedorBateCadastro(id?: string | null, nome?: string | null, escolhido?: AparelhoVendedorCadastro): boolean {
    if (!escolhido) return true;
    if (escolhido.id && id && escolhido.id === id) return true;
    return this.igual(nome || 'Loja', escolhido.nome);
  }

  private vendedorDaOperacao(operacaoId?: string | null): string {
    if (!operacaoId) return '';
    return this.operacoes.find(op => op.id === operacaoId)?.vendedorNome || '';
  }

  private vendedorIdDaOperacao(operacaoId?: string | null): string {
    if (!operacaoId) return '';
    return this.operacoes.find(op => op.id === operacaoId)?.vendedorId || '';
  }

  onBuscaCadeia(termo: string): void {
    this.buscaCadeia = termo;
    this.avisoCadeia = '';
    const lista = this.cadeiasDoTermo(termo);
    this.cadeiaAberta = lista.length === 1 ? lista[0].id : '';
  }

  aparelhosPorCodigo(termo: string, lista: AparelhoLojaItem[]): AparelhoLojaItem[] {
    const t = termo.trim().toUpperCase().replace(/\s+/g, '');
    if (!t) return [];
    const com = lista.filter(a => !!a.codigo);
    if (/^[NU]\d+$/.test(t)) return com.filter(a => (a.codigo || '').toUpperCase() === t);
    if (/^\d+$/.test(t)) {
      const n = String(Number(t));
      return com.filter(a => (a.codigo || '').toUpperCase().slice(1) === n);
    }
    return com.filter(a => (a.codigo || '').toUpperCase().startsWith(t));
  }

  onBuscaMarca(marca: string): void {
    this.buscaMarca = marca;
    this.resetPaginaEstoque();
    if (this.buscaModeloMarca && marca && !this.igual(this.buscaModeloMarca, marca)) {
      this.limparFiltroModeloEstoque();
    }
  }

  buscarModeloEstoqueFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhos.listarModelos({
      termo: termo.trim() || undefined,
      marcaId: this.marcaIdDaBusca,
      marcaNome: this.buscaMarca || undefined,
      tipoDispositivo: 'Celular',
      limite: MODELO_LIMITE_LISTA,
    }).pipe(
      map(lista => (lista ?? [])
        .filter(modelo => this.modeloEstaNoEstoque(modelo))
        .map(modeloParaAutocomplete)),
    );

  onFiltroModeloEstoque(item: AutocompleteItem | null): void {
    this.resetPaginaEstoque();
    if (!item?.id && !item?.nome?.trim()) {
      this.buscaModeloId = '';
      this.buscaModelo = '';
      this.buscaModeloLabel = '';
      this.buscaModeloMarca = '';
      return;
    }
    this.buscaModeloId = item.id || '';
    this.buscaModelo = (item.nome || '').trim();
    this.buscaModeloMarca = (item.marcaNome || '').trim();
    this.buscaModeloLabel = this.buscaModeloMarca
      ? `${this.buscaModeloMarca} · ${this.buscaModelo}`
      : this.buscaModelo;
    if (this.buscaModeloMarca && !this.buscaMarca) this.buscaMarca = this.buscaModeloMarca;
  }

  private limparFiltroModeloEstoque(): void {
    this.buscaModeloId = '';
    this.buscaModelo = '';
    this.buscaModeloLabel = '';
    this.buscaModeloMarca = '';
    this.modeloFiltroKey += 1;
  }

  private get marcaIdDaBusca(): string | undefined {
    if (!this.buscaMarca) return undefined;
    return this.marcas.find(m => this.igual(m.nome, this.buscaMarca))?.id;
  }

  private modeloEstaNoEstoque(modelo: ModeloAparelho): boolean {
    return this.estoque.some(a =>
      (!!modelo.id && a.modeloId === modelo.id)
      || (this.igual(a.marca, modelo.marcaNome) && this.igual(a.modelo, modelo.nome)));
  }

  private aparelhoBateModeloFiltro(a: AparelhoLojaItem): boolean {
    if (this.buscaModeloId && a.modeloId === this.buscaModeloId) return true;
    if (!this.buscaModelo) return !this.buscaModeloId;
    return this.igual(a.modelo, this.buscaModelo)
      && (!this.buscaModeloMarca || this.igual(a.marca, this.buscaModeloMarca));
  }

  formaDe(a: AparelhoLojaItem): string {
    if (a.formaNegociacao) return a.formaNegociacao;
    const entrada = this.operacoes.find(op =>
      op.status !== 'estornada'
      && (op.tipo === 'compra' || op.tipo === 'troca')
      && (op.entradaResumo || '').includes(a.imei));
    if (entrada?.formaNegociacao) return entrada.formaNegociacao;
    return a.origem === 'compra' ? 'avista' : '';
  }

  rotuloFormaAparelho(a: AparelhoLojaItem): string {
    const forma = this.formaDe(a);
    if (forma === 'outra' && a.financiadoraNome) return a.financiadoraNome;
    return this.rotuloForma(forma);
  }

  rotuloForma(forma?: string): string {
    if (forma === 'dinheiro') return 'Dinheiro';
    if (forma === 'pix') return 'PIX';
    if (forma === 'financiadora') return 'Financiadora';
    const achada = this.formasBusca.find(f => f.id === (forma || ''));
    return achada?.nome || '—';
  }

  onSentidoTroca(sentido: '' | 'loja' | 'cliente' | 'nenhuma'): void {
    this.troca.sentido = sentido;
    this.troca.pagamento = '';
    this.troca.financiadoraNome = '';
    if (sentido === 'nenhuma') this.troca.diferenca = null;
  }

  private diferencaTrocaVazia() {
    return {
      sentido: '' as '' | 'loja' | 'cliente' | 'nenhuma',
      diferenca: null as number | null,
      pagamento: '' as '' | 'dinheiro' | 'cartao' | 'financiadora' | 'pix',
    };
  }

  capaDe(a: AparelhoLojaItem): string {
    return (a.fotos ?? []).find(f => !this.ehVideo(f))?.url || '';
  }

  temFoto(a: AparelhoLojaItem): boolean {
    return !!a.temFoto;
  }

  resetPaginaEstoque(): void {
    this.gridEstoque.reset();
  }

  get estoquePaginado(): AparelhoLojaItem[] {
    return this.gridEstoque.paginate(this.estoqueFiltrado);
  }

  alternarFicha(id?: string): void {
    if (!id) return;
    const fecha = this.fichaId === id;
    this.fichaId = fecha ? null : id;
    this.fotosMarcadas = new Set();
    if (fecha) this.fotoAmpliada = null;
  }

  get aparelhoEdicao(): AparelhoLojaItem | null {
    if (!this.editandoId) return null;
    return this.estoque.find(a => a.id === this.editandoId) ?? null;
  }

  podeEditar(a: AparelhoLojaItem): boolean {
    return a.status === 'em_estoque' || a.status === 'em_assistencia';
  }

  ampliarFoto(foto: { url?: string; tipo?: string }): void {
    this.fotoAmpliada = this.fotoAmpliada?.url === foto.url ? null : foto;
  }

  async incluirFotos(a: AparelhoLojaItem, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    input.value = '';
    if (!a.id || !arquivos.length || this.enviandoFotos) return;
    this.enviandoFotos = true;
    let preparados: File[];
    try {
      preparados = await Promise.all(arquivos.map(arquivo => this.prepararFotoComputador(arquivo)));
    } catch (err) {
      this.enviandoFotos = false;
      avisarErroUsuario(err instanceof Error ? err.message : 'Não foi possível ler a foto.');
      return;
    }
    const grande = preparados.find(arquivo => {
      const video = arquivo.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(arquivo.name);
      return arquivo.size > (video ? 40 : 8) * 1024 * 1024;
    });
    if (grande) {
      this.enviandoFotos = false;
      avisarErroUsuario('Cada foto pode ter no máximo 8 MB e cada vídeo 40 MB.');
      return;
    }
    this.api.fotos(a.id, preparados).subscribe({
      next: painel => {
        this.painel = painel;
        this.enviandoFotos = false;
        avisarSucessoUsuario('Fotos incluídas neste aparelho.');
      },
      error: err => {
        this.enviandoFotos = false;
        avisarErroUsuario(err?.error?.erro || 'Não foi possível incluir as fotos.');
      },
    });
  }

  private async prepararFotoComputador(arquivo: File): Promise<File> {
    const video = arquivo.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(arquivo.name);
    if (video) return arquivo;
    try {
      const bitmap = await createImageBitmap(arquivo);
      const maximo = 2000;
      const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
      const largura = Math.max(1, Math.round(bitmap.width * escala));
      const altura = Math.max(1, Math.round(bitmap.height * escala));
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      const ctx = tela.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return arquivo;
      }
      ctx.drawImage(bitmap, 0, 0, largura, altura);
      bitmap.close();
      const blob = await new Promise<Blob | null>(resolve => tela.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob?.size) return arquivo;
      const base = (arquivo.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
    } catch {
      const compativel = /jpe?g|png|webp|gif/i.test(arquivo.type) || /\.(jpe?g|png|webp|gif)$/i.test(arquivo.name);
      if (compativel) return arquivo;
      throw new Error('Esta foto não abriu neste computador. Envie JPG ou PNG, ou use o QR no celular.');
    }
  }

  get configuracoesEdicao(): string[] {
    const atual = (this.edicao?.configuracao || '').trim();
    if (atual && !this.configuracoes.includes(atual)) return [atual, ...this.configuracoes];
    return this.configuracoes;
  }

  get edicaoEhIphone(): boolean {
    const nome = `${this.edicaoModelo?.marcaNome || ''} ${this.edicaoModelo?.nome || ''}`;
    return this.normalizar(nome).includes('iphone');
  }

  abrirEdicao(a: AparelhoLojaItem): void {
    if (!this.podeEditar(a)) return;
    this.aparelhoEmEdicao = a;
  }

  aoSalvarEdicao(painel: AparelhoLojaPainel): void {
    this.painel = painel;
    this.cancelarEdicao();
  }

  aoAtualizarEdicao(painel: AparelhoLojaPainel): void {
    this.painel = painel;
    const id = this.aparelhoEmEdicao?.id;
    if (id) {
      const atual = (painel.estoque || []).find(x => x.id === id);
      if (atual) this.aparelhoEmEdicao = atual;
    }
  }

  aoExcluirAparelho(painel: AparelhoLojaPainel): void {
    const id = this.aparelhoEmEdicao?.id;
    this.painel = painel;
    this.cancelarEdicao();
    if (id && this.fichaId === id) this.fichaId = null;
  }

  excluirAparelho(a: AparelhoLojaItem): void {
    if (!this.isAdmin || !a.id) return;
    if (!confirm('Excluir este aparelho do estoque? Se ele entrou por compra, a compra some junto. Aparelho de troca precisa excluir a troca nas transações.')) return;
    const id = a.id;
    this.enviar(this.api.excluirAparelho(id), 'Aparelho excluído.', undefined, () => {
      if (this.fichaId === id) this.fichaId = null;
      if (this.aparelhoEmEdicao?.id === id) this.cancelarEdicao();
    });
  }

  comecarEdicao(a: AparelhoLojaItem): void {
    const marca = this.marcas.find(m => m.id === a.marcaId) || this.marcas.find(m => this.igual(m.nome, a.marca));
    this.editandoId = a.id || '';
    this.edicaoMarcaId = marca?.id || '';
    this.edicaoModelo = {
      id: a.modeloId || '',
      nome: a.modelo,
      marcaId: this.edicaoMarcaId,
      marcaNome: a.marca,
    };
    this.edicaoModelos = this.edicaoModelo.id ? [this.edicaoModelo] : [];
    this.edicao = {
      imei: a.imei || '',
      cor: a.cor || '',
      configuracao: a.configuracao || '',
      condicao: a.condicao === 'novo' ? 'novo' : 'usado',
      valorVenda: a.valorVenda ?? null,
      valorMinimo: a.valorMinimoVenda ?? null,
      saudeBateria: a.saudeBateria ?? null,
      bateriaPerfeita: a.bateriaPerfeita === true ? 'sim' : a.bateriaPerfeita === false ? 'nao' : '',
      observacoes: a.observacoes || '',
      alerta: a.alertaPermanente || '',
      pecas: (a.pecasTrocadas?.length ? a.pecasTrocadas : [{ nome: '', apareceMensagem: false }])
        .map(p => ({ nome: p.nome, apareceMensagem: !!p.apareceMensagem })),
    };
    this.carregarModelosEdicao(this.edicaoMarcaId);
  }

  cancelarEdicao(): void {
    this.editandoId = '';
    this.aparelhoEmEdicao = null;
    this.edicao = null;
    this.edicaoModelo = null;
    this.edicaoMarcaId = '';
    this.edicaoModelos = [];
  }

  onMarcaEdicao(id: string): void {
    this.edicaoMarcaId = id;
    this.edicaoModelo = null;
    this.edicaoModelos = [];
    this.carregarModelosEdicao(id);
  }

  onModeloEdicaoId(id: string): void {
    if (!id) {
      this.edicaoModelo = null;
      return;
    }
    const modelo = this.edicaoModelos.find(m => m.id === id);
    const marca = this.marcas.find(m => m.id === this.edicaoMarcaId);
    this.edicaoModelo = {
      id,
      nome: modelo?.nome || '',
      marcaId: this.edicaoMarcaId,
      marcaNome: marca?.nome || modelo?.marcaNome || '',
    };
  }

  salvarCadastro(): void {
    const a = this.aparelhoEdicao;
    if (!a?.id || !this.edicao || this.salvandoEdicao) return;
    if (!this.edicaoModelo?.nome?.trim() || !this.edicaoModelo.marcaNome?.trim()) {
      avisarErroUsuario('Selecione a marca e o modelo.');
      return;
    }
    const valorVenda = Number(this.edicao.valorVenda);
    const valorMinimo = Number(this.edicao.valorMinimo);
    if (!(valorVenda > 0) || !(valorMinimo > 0)) {
      avisarErroUsuario('Informe o valor de venda e o mínimo.');
      return;
    }
    if (valorMinimo > valorVenda) {
      avisarErroUsuario('O valor mínimo não pode passar do valor de venda.');
      return;
    }
    if (this.edicaoEhIphone && this.edicao.bateriaPerfeita !== 'sim' && this.edicao.bateriaPerfeita !== 'nao') {
      avisarErroUsuario('Informe se a saúde da bateria do iPhone está em perfeitas condições.');
      return;
    }
    const imei = this.imeiParaEntrada(this.edicao.imei);
    const pecas = this.edicaoEhIphone ? this.pecasPreenchidas(this.edicao.pecas) : [];
    this.salvandoEdicao = true;
    this.api.editarCadastro(a.id, {
      imei,
      marca: this.edicaoModelo.marcaNome,
      modelo: this.edicaoModelo.nome,
      marcaId: this.edicaoModelo.marcaId,
      modeloId: this.edicaoModelo.id,
      cor: this.edicao.cor,
      configuracao: this.edicao.configuracao,
      condicao: this.edicao.condicao,
      valorVenda,
      valorMinimoVenda: valorMinimo,
      observacoes: this.edicao.observacoes,
      alertaPermanente: this.edicao.alerta,
      saudeBateria: this.edicao.saudeBateria,
      bateriaPerfeita: this.edicaoEhIphone ? this.edicao.bateriaPerfeita === 'sim' : null,
      pecasTrocadas: pecas,
    }).subscribe({
      next: painel => {
        this.painel = painel;
        this.salvandoEdicao = false;
        this.cancelarEdicao();
        avisarSucessoUsuario('Cadastro atualizado.');
      },
      error: err => {
        this.salvandoEdicao = false;
        avisarErroUsuario(err?.error?.erro || 'Não foi possível salvar o cadastro.');
      },
    });
  }

  private carregarModelosEdicao(marcaId: string): void {
    if (!marcaId) {
      this.edicaoModelos = [];
      return;
    }
    this.aparelhos.listarModelos({ marcaId, tipoDispositivo: 'Celular', limite: MODELO_LIMITE_LISTA }).subscribe({
      next: lista => {
        if (this.edicaoMarcaId !== marcaId) return;
        const modelos = lista ?? [];
        const atual = this.edicaoModelo;
        this.edicaoModelos = atual?.id && !modelos.some(m => m.id === atual.id)
          ? [atual, ...modelos]
          : modelos;
      },
      error: () => {
        if (this.edicaoMarcaId === marcaId && !this.edicaoModelos.length) this.edicaoModelos = [];
      },
    });
  }

  salvarImei(a: AparelhoLojaItem): void {
    const imei = (this.imeiInformado[a.id || ''] || '').replace(/\D/g, '');
    if (imei.length !== 15) {
      avisarErroUsuario('O IMEI precisa ter 15 dígitos.');
      return;
    }
    this.api.informarImei(a.id || '', imei).subscribe({
      next: painel => {
        this.painel = painel;
        avisarSucessoUsuario('IMEI salvo.');
      },
      error: err => avisarErroUsuario(err?.error?.erro || 'Não foi possível salvar o IMEI.'),
    });
  }

  fotoMarcada(foto: { id?: string; url?: string }): boolean {
    return this.fotosMarcadas.has(this.chaveFoto(foto));
  }

  temFotoMarcada(a: AparelhoLojaItem): boolean {
    return (a.fotos ?? []).some(f => this.fotoMarcada(f));
  }

  alternarFoto(foto: { id?: string; url?: string }): void {
    const chave = this.chaveFoto(foto);
    const proximo = new Set(this.fotosMarcadas);
    if (proximo.has(chave)) proximo.delete(chave);
    else proximo.add(chave);
    this.fotosMarcadas = proximo;
  }

  async enviarWhatsapp(a: AparelhoLojaItem): Promise<void> {
    const escolhidas = (a.fotos ?? []).filter(f => this.fotoMarcada(f));
    if (!escolhidas.length || this.enviandoWhatsapp) return;
    this.enviandoWhatsapp = true;
    try {
      const files: File[] = [];
      for (let i = 0; i < escolhidas.length; i++) {
        const item = escolhidas[i];
        const resposta = await fetch(item.url);
        if (!resposta.ok) throw new Error('foto');
        const blob = await resposta.blob();
        const nome = this.nomeArquivoWhatsapp(item, i);
        files.push(new File([blob], nome, { type: blob.type || this.tipoPeloNome(nome) }));
      }
      const texto = this.textoWhatsapp(a);
      const compartilhar = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (compartilhar.share && (!compartilhar.canShare || compartilhar.canShare({ files }))) {
        await compartilhar.share({ files, text: texto, title: this.nomeAparelho(a) });
        return;
      }
      this.baixarArquivos(files);
      window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
      avisarSucessoUsuario('O WhatsApp abriu com os dados do aparelho. As fotos selecionadas foram baixadas para soltar no chat.');
    } catch (erro: unknown) {
      if (erro instanceof DOMException && erro.name === 'AbortError') return;
      avisarErroUsuario('Não foi possível preparar as fotos para o WhatsApp.');
    } finally {
      this.enviandoWhatsapp = false;
    }
  }

  custoTotalDe(a: { custo?: number; custoPecas?: number; custoTotal?: number }): number {
    if (a.custoTotal != null) return Number(a.custoTotal) || 0;
    return (Number(a.custo) || 0) + (Number(a.custoPecas) || 0);
  }

  linksOs(a: AparelhoLojaItem): { id: number; numero: string; pecas: number }[] {
    const mapa = new Map<number, { id: number; numero: string; pecas: number }>();
    if (a.osEntradaId) {
      mapa.set(a.osEntradaId, {
        id: a.osEntradaId,
        numero: a.osEntradaNumero || String(a.osEntradaId),
        pecas: 0,
      });
    }
    for (const c of a.custosOs ?? []) {
      if (!c.osId) continue;
      const atual = mapa.get(c.osId);
      mapa.set(c.osId, {
        id: c.osId,
        numero: c.numero || atual?.numero || String(c.osId),
        pecas: (atual?.pecas || 0) + (Number(c.pecas) || 0),
      });
    }
    return [...mapa.values()];
  }

  testesResumo(a: AparelhoLojaItem): string {
    const lista = a.testes ?? [];
    const ok = lista.filter(t => t.ok).map(t => t.nome);
    const falhou = lista.filter(t => !t.ok).map(t => t.nome);
    const partes = [];
    if (ok.length) partes.push('Ok: ' + ok.join(', '));
    if (falhou.length) partes.push('Falhou: ' + falhou.join(', '));
    return partes.join(' · ');
  }

  onClienteCriado(cliente: BlingContato): void {
    this.modalCliente = false;
    this.cliente = cliente;
    if (cliente.id != null) {
      this.clienteRef = { id: cliente.id, nome: cliente.nome };
    }
  }

  custoSelecionado(id: string): number | null {
    const item = this.estoque.find(a => a.id === id);
    return item ? item.custo : null;
  }

  prejuizoVenda(): number | null {
    return this.prejuizo(this.venda.aparelhoId, this.precoCobradoVenda);
  }

  prejuizoTroca(): number | null {
    return this.prejuizo(this.troca.aparelhoSaidaId, this.precoCobradoTroca);
  }

  teto(base: number | null, pct: number): number {
    return this.centavos(Math.max(0, this.centavos(base)) * pct / 100);
  }

  descontoEstoura(base: number | null, desconto: number | null): boolean {
    if (!(this.centavos(base) > 0)) return false;
    return this.centavos(desconto) > this.teto(base, this.descontoMaxPct);
  }

  acrescimoEstoura(base: number | null, acrescimo: number | null): boolean {
    if (!(this.centavos(base) > 0)) return false;
    return this.centavos(acrescimo) > this.teto(base, this.acrescimoMaxPct);
  }

  precoCobrado(
    tabela: number | null,
    desconto: number | null,
    acrescimo: number | null,
    forma: FormaNegociacao,
  ): number | null {
    const preco = this.centavos(tabela);
    if (!(preco > 0)) return null;
    const desc = Math.max(0, this.centavos(desconto));
    const acr = this.ehFinanciada(forma) ? Math.max(0, this.centavos(acrescimo)) : 0;
    const final = this.centavos(preco - desc + acr);
    return final > 0 ? final : null;
  }

  opcoesJuros(valor: number): OpcaoParcela[] {
    return gerarOpcoesParcelas(valor, this.jurosCfg);
  }

  taxa(valor: number): string {
    return formatarTaxaPct(valor);
  }

  private numeroBusca(valor: number | null): number | null {
    if (valor == null || valor === ('' as unknown as number)) return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  private centavos(valor: number | null | undefined): number {
    const n = Number(valor ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  private avisoAjuste(
    tabela: number | null,
    desconto: number | null,
    acrescimo: number | null,
    forma: FormaNegociacao,
    minimo?: number | null,
  ): string {
    const preco = this.centavos(tabela);
    if (!(preco > 0)) return 'Informe o preço do aparelho.';
    const desc = this.centavos(desconto);
    const acr = this.centavos(acrescimo);
    if (desc < 0 || acr < 0) return 'Desconto e acréscimo não podem ser negativos.';
    if (this.descontoEstoura(preco, desc)) return `O desconto passa do limite de ${this.descontoMaxPct}%.`;
    if (this.abaixoDoMinimo(preco, desc, minimo)) return 'O valor fica abaixo do mínimo para venda.';
    if (this.ehFinanciada(forma) && this.acrescimoEstoura(preco, acr)) return `O acréscimo passa do limite de ${this.acrescimoMaxPct}%.`;
    if (this.precoCobrado(preco, desc, acr, forma) == null) return 'O valor cobrado precisa ser maior que zero.';
    return '';
  }

  private prejuizo(aparelhoId: string, preco: number | null): number | null {
    const custo = this.custoSelecionado(aparelhoId);
    const valor = Number(preco);
    if (custo == null || !(valor > 0)) return null;
    const diff = Math.round((custo - valor) * 100) / 100;
    return diff > 0 ? diff : null;
  }

  rotuloEstoque(a: AparelhoLojaItem): string {
    const nome = this.nomeAparelho(a);
    return `${nome} · ${a.imei}`;
  }

  nomeAparelho(a: { marca?: string; modelo?: string; cor?: string; configuracao?: string }): string {
    return [a.marca, a.modelo, a.configuracao, a.cor].filter(s => !!s?.trim()).join(' ');
  }

  rotuloCondicao(condicao?: string): string {
    return condicao === 'novo' ? 'Novo' : 'Usado';
  }

  rotuloSituacao(status?: string): string {
    if (status === 'em_assistencia') return 'Na assistência';
    if (status === 'em_estoque') return 'Disponível';
    return status || '—';
  }

  dicaAssistencia(a: AparelhoLojaItem): string {
    const os = (a.osEntradaNumero || a.osEntradaId || '').toString().trim();
    const justificativa = (a.justificativaAssistencia || a.observacoes || 'Aparelho na assistência.').trim();
    return os ? `OS ${os}\n${justificativa}` : justificativa;
  }

  mostrarDicaAssistencia(ev: MouseEvent, a: AparelhoLojaItem): void {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.dicaAssistenciaAberta = {
      top: r.bottom + 8,
      left: Math.max(12, r.left - 140),
      texto: this.dicaAssistencia(a),
    };
  }

  esconderDicaAssistencia(): void {
    this.dicaAssistenciaAberta = null;
  }

  liberar(item: AparelhoLojaItem): void {
    if (!item.id) return;
    this.enviar(this.api.liberar(item.id), 'Aparelho liberado para venda.');
  }

  rotuloTipo(tipo?: string): string {
    if (tipo === 'compra') return 'Compra';
    if (tipo === 'venda') return 'Venda';
    if (tipo === 'troca') return 'Troca';
    return tipo || '—';
  }

  formatarDoc(valor?: string): string {
    return formatarCpfCnpj(valor) || '';
  }

  cadeiaAberta = '';
  unidadeAberta = '';

  get cadeias() {
    return this.painel?.cadeias ?? [];
  }

  private cadeiasDoTermo(termo: string) {
    const compacto = (valor: string) => this.normalizar(valor).replace(/\s+/g, '');
    const t = compacto(termo);
    if (!t) return this.cadeias;
    return this.cadeias.filter(c => {
      if (compacto(c.titulo).includes(t) || this.normalizar(c.titulo).includes(this.normalizar(termo))) return true;
      return c.passos.some(p => [...p.entrou, ...p.saiu].some(a => {
        const codigo = (a.codigo || '').toLowerCase();
        const imei = (a.imei || '').toLowerCase();
        const nome = compacto(a.nome);
        if (/^[nu]\d+$/.test(t)) return codigo === t;
        if (/^\d+$/.test(t)) return codigo.slice(1) === String(Number(t));
        return codigo.startsWith(t) || imei.includes(t) || nome.includes(t) || compacto(a.nome).includes(t);
      }));
    });
  }

  private rolarAteCadeia(id: string): void {
    setTimeout(() => {
      document.getElementById('cadeia-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  get meses() {
    return this.painel?.meses ?? [];
  }

  rotuloMovimento(movimento?: string): string {
    if (movimento === 'compra') return 'Compra';
    if (movimento === 'entrou') return 'Entrou na troca';
    if (movimento === 'saiu') return 'Saiu na troca';
    if (movimento === 'venda') return 'Venda';
    return movimento || '—';
  }

  alternarCadeia(id: string): void {
    this.cadeiaAberta = this.cadeiaAberta === id ? '' : id;
  }

  chaveUnidade(u: AparelhoCadeiaUnidade): string {
    return `${u.operacaoId || ''}|${u.imei}|${u.movimento}`;
  }

  alternarUnidade(u: AparelhoCadeiaUnidade): void {
    const chave = this.chaveUnidade(u);
    this.unidadeAberta = this.unidadeAberta === chave ? '' : chave;
    this.cadeiaAberta = u.cadeiaId;
  }

  passoDaUnidade(u: AparelhoCadeiaUnidade): AparelhoCadeiaPasso | undefined {
    return this.cadeias
      .find(c => c.id === u.cadeiaId)
      ?.passos.find(p => p.operacaoId === u.operacaoId);
  }

  fichaAparelho(item: AparelhoCadeiaItem): string {
    const condicao = item.condicao ? this.rotuloCondicao(item.condicao) : '';
    return [item.cor, condicao].filter(parte => !!parte).join(' · ');
  }

  formatarFone(valor?: string): string {
    return formatarTelefone(valor) || '';
  }

  rotuloEtapa(passo: AparelhoCadeiaPasso): string {
    if (passo.tipo === 'compra') return 'Investimento';
    return passo.resultado < 0 ? 'Prejuízo desta etapa' : 'Resultado desta etapa';
  }

  valorEtapa(passo: AparelhoCadeiaPasso): number {
    if (passo.tipo === 'compra') return passo.dinheiroSaiu;
    const valor = Number(passo.resultado) || 0;
    return valor < 0 ? -valor : valor;
  }

  dataCurta(iso?: string | null): string {
    if (!iso) return '';
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  dinheiro(valor?: number | null): string {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  pagoDe(a: { valorPago?: number; custo?: number }): number {
    const pago = Number(a.valorPago);
    if (pago > 0) return pago;
    return Number(a.custo) || 0;
  }

  acimaDaVenda(paraCompra?: number | null, venda?: number | null): boolean {
    const compra = Number(paraCompra);
    const preco = Number(venda);
    return compra > 0 && preco > 0 && compra > preco;
  }

  lucroDe(preco?: number | null, pago?: number | null): number | null {
    const venda = Number(preco);
    const custo = Number(pago);
    if (!(venda > 0) || !(custo > 0)) return null;
    return Math.round((venda - custo) * 100) / 100;
  }

  textoLucro(preco?: number | null, pago?: number | null): string {
    const lucro = this.lucroDe(preco, pago);
    if (lucro == null) return '—';
    const pct = Math.round((lucro / Number(preco)) * 1000) / 10;
    return `${this.dinheiro(lucro)} (${this.percentual(pct)})`;
  }

  percentual(valor: number | null): string {
    if (valor == null) return '—';
    return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  private lucroDasVendas(ops: AparelhoOperacao[]): LucroVendas {
    const itens = ops
      .filter(op => op.tipo === 'venda' && op.status !== 'estornada')
      .flatMap(op => this.aparelhosSaiu(op))
      .filter(a => (Number(a.valor) || 0) > 0);
    const valor = itens.reduce((s, a) => s + (Number(a.valor) || 0), 0);
    const custo = itens.reduce((s, a) => s + (Number(a.custo) || 0), 0);
    const lucro = custo - valor;
    const quantidade = itens.length;
    const arredondar = (n: number) => Math.round(n * 100) / 100;
    return {
      quantidade,
      valor: arredondar(valor),
      custo: arredondar(custo),
      lucro: arredondar(lucro),
      percentual: valor > 0 ? Math.round((lucro / valor) * 1000) / 10 : null,
      valorMedio: quantidade > 0 ? arredondar(valor / quantidade) : null,
    };
  }

  salvarCompra(): void {
    const aparelho = this.payloadEntrada();
    if (!aparelho) return;
    const valor = Number(this.compra.valorPago);
    if (!(valor > 0)) {
      avisarErroUsuario('Informe o valor pago pela loja.');
      return;
    }
    if (!this.cliente?.id && !this.compra.fornecedorNome.trim()) {
      avisarErroUsuario('Informe o cliente ou o fornecedor.');
      return;
    }
    const rascunho = this.cliente ? this.rascunhoCompra(aparelho, valor) : null;
    this.imeisOsNova = this.entrada.passaPorAssistencia && !this.entrada.osNumero.trim()
      ? [apenasDigitos(this.entrada.imei)]
      : [];
    this.marcarEstoqueAntes();
    this.abrirQrNoProximo = true;
    this.imeisQr = aparelho.imei ? [apenasDigitos(aparelho.imei)] : [];
    this.enviar(
      this.api.comprar({
        aparelho,
        valorPago: valor,
        clienteId: this.cliente?.id,
        fornecedorNome: this.compra.fornecedorNome.trim(),
        observacoes: this.entrada.observacoes,
        sessaoToken: undefined,
      }),
      rascunho
        ? 'Compra registrada. O contrato abriu com os dados já informados.'
        : 'Compra registrada. O aparelho entrou no estoque.',
      aparelho.imei,
      () => this.abrirContrato(rascunho),
    );
  }

  salvarVenda(): void {
    if (!this.venda.aparelhoId) {
      avisarErroUsuario('Selecione o aparelho do estoque.');
      return;
    }
    const unidade = this.estoque.find(a => a.id === this.venda.aparelhoId);
    if (unidade && (unidade.imei || '').replace(/\D/g, '').length !== 15) {
      avisarErroUsuario('Informe o IMEI deste aparelho antes de vender.');
      return;
    }
    const clienteId = this.cliente?.id;
    if (!clienteId) {
      avisarErroUsuario('Selecione o cliente.');
      return;
    }
    if (this.clienteSemDocumento) {
      avisarErroUsuario('Cadastre o CPF ou CNPJ do cliente para liberar o desconto.');
      return;
    }
    const ajuste = this.avisoAjuste(this.venda.preco, this.venda.desconto, this.venda.acrescimo, this.venda.forma, this.aparelhoVendaSelecionado?.valorMinimoVenda);
    if (ajuste) {
      avisarErroUsuario(ajuste);
      return;
    }
    const preco = this.precoCobradoVenda;
    if (preco == null) {
      avisarErroUsuario('Informe o preço do aparelho.');
      return;
    }
    if (!this.validarNegociacao(this.venda, this.baseCartaoVenda)) return;
    const item = this.estoque.find(a => a.id === this.venda.aparelhoId);
    const rascunho = item ? this.rascunhoVenda(item, preco, this.venda, this.textoParcelasCartao(this.opcaoJurosVenda)) : null;
    this.enviar(
      this.api.vender({
        aparelhoId: this.venda.aparelhoId,
        clienteId,
        preco,
        precoTabela: Number(this.venda.preco),
        desconto: this.centavos(this.venda.desconto),
        acrescimo: this.ehFinanciada(this.venda.forma) ? this.centavos(this.venda.acrescimo) : 0,
        ...this.corpoNegociacao(this.venda),
        observacoes: this.venda.observacoes,
      }),
      'Venda registrada. O contrato abriu com os dados já informados.',
      undefined,
      () => this.abrirContrato(rascunho),
    );
  }

  salvarTroca(): void {
    if (!this.troca.aparelhoSaidaId) {
      avisarErroUsuario('Selecione o aparelho que o cliente leva.');
      return;
    }
    const clienteId = this.cliente?.id;
    if (!clienteId) {
      avisarErroUsuario('Selecione o cliente.');
      return;
    }
    if (this.clienteSemDocumento) {
      avisarErroUsuario('Cadastre o CPF ou CNPJ do cliente para liberar o desconto.');
      return;
    }
    const prontos = [];
    for (const ficha of this.entradasTroca) {
      const aparelho = this.payloadFicha(ficha);
      if (!aparelho) return;
      const avaliado = Number(ficha.valorAvaliado);
      if (ficha.valorAvaliado == null || Number.isNaN(avaliado) || avaliado < 0) {
        avisarErroUsuario('Informe o valor avaliado de cada aparelho que entra.');
        return;
      }
      prontos.push({ ficha, aparelho, avaliado });
    }
    const imeis = prontos.map(p => p.aparelho.imei).filter(imei => apenasDigitos(imei).length === 15);
    if (new Set(imeis).size !== imeis.length) {
      avisarErroUsuario('Não repita o mesmo IMEI na troca.');
      return;
    }
    const saida = this.estoque.find(a => a.id === this.troca.aparelhoSaidaId);
    if (saida && imeis.includes(apenasDigitos(saida.imei))) {
      avisarErroUsuario('O aparelho que entra não pode ser o mesmo que sai.');
      return;
    }
    const ajuste = this.avisoAjuste(this.troca.precoSaida, this.troca.desconto, this.troca.acrescimo, this.troca.forma, this.aparelhoTrocaSelecionado?.valorMinimoVenda);
    if (ajuste) {
      avisarErroUsuario(ajuste);
      return;
    }
    const preco = this.precoCobradoTroca;
    if (preco == null) {
      avisarErroUsuario('Informe o preço do aparelho que sai.');
      return;
    }
    if (!this.validarDiferencaTroca()) return;
    const complemento = prontos
      .map(p => `Aparelho dado na troca: ${p.aparelho.marca} ${p.aparelho.modelo} ${p.aparelho.configuracao}, IMEI ${p.aparelho.imei}, avaliado em R$ ${moedaContrato(p.avaliado)}. ${this.estadoDoAparelho(p.aparelho)}`)
      .join(' ');
    const rascunho = saida ? this.rascunhoVenda(saida, preco, this.troca, complemento) : null;
    this.aplicarDiferencaNoContrato(rascunho, preco);
    const soma = prontos.reduce((total, p) => total + p.avaliado, 0);
    const diferenca = this.troca.sentido === 'nenhuma' ? 0 : this.centavos(this.troca.diferenca);
    this.imeisOsNova = this.entradasTroca
      .filter(ficha => ficha.dados.passaPorAssistencia && !ficha.dados.osNumero.trim())
      .map(ficha => apenasDigitos(ficha.dados.imei));
    this.marcarEstoqueAntes();
    this.abrirQrNoProximo = true;
    this.imeisQr = imeis.map(valor => apenasDigitos(valor));
    this.enviarComMidias(
      this.api.trocar({
        aparelhoSaidaId: this.troca.aparelhoSaidaId,
        precoSaida: preco,
        precoTabela: Number(this.troca.precoSaida),
        desconto: this.centavos(this.troca.desconto),
        acrescimo: 0,
        entradas: prontos.map(p => ({
          aparelho: p.aparelho,
          valorAvaliado: p.avaliado,
          sessaoToken: undefined,
        })),
        valorAvaliado: Math.round(soma * 100) / 100,
        sentidoDiferenca: this.troca.sentido,
        diferencaInformada: diferenca,
        forma: this.troca.sentido === 'nenhuma' ? 'avista' : this.troca.pagamento,
        financiadoraNome: this.troca.pagamento === 'financiadora' ? this.troca.financiadoraNome.trim() : '',
        entradaLoja: 0,
        repasse: 0,
        clienteId,
        observacoes: prontos.map(p => p.aparelho.observacoes).filter(texto => !!texto?.trim()).join(' · '),
      }),
      'Troca registrada. O contrato do aparelho que saiu abriu com os dados já informados.',
      prontos.map(p => ({ imei: p.aparelho.imei, arquivos: [...p.ficha.fotos, ...p.ficha.videos] })),
      () => this.abrirContrato(rascunho),
    );
  }

  estornar(op: AparelhoOperacao): void {
    if (!op.id || !confirm('Desfazer esta operação? O estoque e o desconto voltam ao estado anterior.')) return;
    this.enviar(this.api.estornar(op.id), 'Operação desfeita.');
  }

  excluirOperacao(op: AparelhoOperacao): void {
    if (!this.isAdmin || !op.id) return;
    if (!confirm('Excluir esta transação? Compra tira o aparelho do estoque. Venda devolve o aparelho. A linha some da lista.')) return;
    this.enviar(this.api.excluirOperacao(op.id), 'Transação excluída.');
  }

  private validarDiferencaTroca(): boolean {
    if (this.troca.sentido !== 'loja' && this.troca.sentido !== 'cliente' && this.troca.sentido !== 'nenhuma') {
      avisarErroUsuario('Informe se a diferença volta para a loja, para o cliente ou se não há diferença.');
      return false;
    }
    const diferenca = this.centavos(this.troca.diferenca);
    if (this.troca.sentido === 'nenhuma') {
      if (diferenca > 0) {
        avisarErroUsuario('Se há diferença, informe se ela volta para a loja ou para o cliente.');
        return false;
      }
      return true;
    }
    if (!(diferenca > 0)) {
      avisarErroUsuario('Informe a diferença.');
      return false;
    }
    if (this.troca.sentido === 'loja' && this.troca.pagamento !== 'dinheiro' && this.troca.pagamento !== 'cartao' && this.troca.pagamento !== 'financiadora') {
      avisarErroUsuario('Informe se a diferença entra em dinheiro, cartão ou financiadora.');
      return false;
    }
    if (this.troca.pagamento === 'financiadora' && !this.troca.financiadoraNome.trim()) {
      avisarErroUsuario('Informe qual é a financiadora.');
      return false;
    }
    if (this.troca.sentido === 'cliente' && this.troca.pagamento !== 'pix' && this.troca.pagamento !== 'dinheiro') {
      avisarErroUsuario('Informe se a loja devolve em PIX ou em dinheiro.');
      return false;
    }
    return true;
  }

  private aplicarDiferencaNoContrato(rascunho: RascunhoContrato | null, preco: number): void {
    if (!rascunho) return;
    const diferenca = this.centavos(this.troca.diferenca);
    if (this.troca.sentido === 'nenhuma') {
      rascunho.valores['valor_entrada'] = moedaContrato(0);
      rascunho.valores['valor_saldo'] = moedaContrato(preco);
      rascunho.formaPagamento = 'acombinar';
      rascunho.entrada = '';
      rascunho.complemento = `${rascunho.complemento || ''} Troca sem diferença em dinheiro.`.trim();
      rascunho.valores['observacoes'] = rascunho.complemento;
      return;
    }
    if (this.troca.sentido === 'loja') {
      const saldo = Math.max(0, Math.round((preco - diferenca) * 100) / 100);
      rascunho.valores['valor_entrada'] = moedaContrato(diferenca);
      rascunho.valores['valor_saldo'] = moedaContrato(saldo);
      rascunho.entrada = moedaContrato(diferenca);
      rascunho.repasse = '';
      if (this.troca.pagamento === 'dinheiro') rascunho.formaPagamento = 'dinheiro';
      else if (this.troca.pagamento === 'cartao') rascunho.formaPagamento = 'cartao';
      else {
        rascunho.formaPagamento = 'outra';
        rascunho.financiadoraNome = this.troca.financiadoraNome.trim();
      }
      const parcelas = this.troca.pagamento === 'cartao' ? this.textoParcelasCartao(this.opcaoJurosTroca) : '';
      rascunho.complemento = `${rascunho.complemento || ''} Diferença de R$ ${moedaContrato(diferenca)} para a loja, em ${this.rotuloForma(this.troca.pagamento)}. ${parcelas}`.trim();
      rascunho.valores['observacoes'] = rascunho.complemento;
      return;
    }
    rascunho.valores['valor_entrada'] = moedaContrato(0);
    rascunho.valores['valor_saldo'] = moedaContrato(preco);
    rascunho.entrada = '';
    rascunho.formaPagamento = this.troca.pagamento === 'dinheiro' ? 'dinheiro' : 'pix';
    rascunho.complemento = `${rascunho.complemento || ''} A loja devolve R$ ${moedaContrato(diferenca)} em ${this.troca.pagamento === 'pix' ? 'PIX' : 'dinheiro'}.`.trim();
    rascunho.valores['observacoes'] = rascunho.complemento;
  }

  private textoParcelasCartao(op: OpcaoParcela | null): string {
    if (!op || op.parcelas <= 1) return '';
    return `No cartão, ${op.parcelas}x de R$ ${moedaContrato(op.valorParcela)}, total R$ ${moedaContrato(op.total)}.`;
  }

  private caixaAgora(n: NegociacaoForm): number {
    if (n.forma === 'avista' || n.forma === 'cartao') return 0;
    const entrada = Number(n.entrada ?? 0);
    const repasse = n.forma === 'paymobi' ? 0 : Number(n.repasse ?? 0);
    if (Number.isNaN(entrada) || Number.isNaN(repasse)) return 0;
    return Math.round((entrada + repasse) * 100) / 100;
  }

  private validarNegociacao(n: NegociacaoForm, total?: number | null): boolean {
    if (n.forma === 'avista_cartao') {
      const avista = this.centavos(n.entrada);
      const cartao = this.centavos(n.repasse);
      if (!(avista > 0) || !(cartao > 0)) {
        avisarErroUsuario('Informe o valor à vista e o valor no cartão.');
        return false;
      }
      if (total != null && this.centavos(avista + cartao) !== this.centavos(total)) {
        avisarErroUsuario(this.centavos(total) > 0
          ? 'À vista e cartão precisam somar o valor que o cliente paga.'
          : 'À vista + cartão vale quando o cliente paga.');
        return false;
      }
      return true;
    }
    if (n.forma === 'outra' && !n.financiadoraNome.trim()) {
      avisarErroUsuario('Informe o nome da financiadora.');
      return false;
    }
    if (this.ehFinanciada(n.forma)) {
      const entrada = Number(n.entrada ?? 0);
      const repasse = Number(n.repasse ?? 0);
      if (Number.isNaN(entrada) || Number.isNaN(repasse) || entrada < 0 || repasse < 0) {
        avisarErroUsuario('Entrada e repasse não podem ser negativos.');
        return false;
      }
    }
    return true;
  }

  private corpoNegociacao(n: NegociacaoForm) {
    const semParte = n.forma === 'avista' || n.forma === 'cartao';
    return {
      forma: n.forma,
      financiadoraNome: n.financiadoraNome.trim(),
      entradaLoja: semParte ? 0 : Number(n.entrada ?? 0),
      repasse: semParte || n.forma === 'paymobi' ? 0 : Number(n.repasse ?? 0),
    };
  }

  private abrirContrato(rascunho: RascunhoContrato | null): void {
    if (!rascunho) return;
    guardarRascunhoContrato(rascunho);
    void this.router.navigate(['/contratos']);
  }

  private rascunhoCompra(
    aparelho: {
      marca?: string;
      modelo?: string;
      cor?: string;
      configuracao?: string;
      imei: string;
      condicao: string;
      observacoes?: string;
      saudeBateria?: number | null;
      testes?: { nome: string; ok: boolean }[];
    },
    valor: number,
  ) {
    const pessoa = this.pessoaContrato();
    return {
      codigo: 'contrato-compra-venda',
      valores: {
        vendedora_nome: pessoa?.nome ?? '',
        vendedora_cpf: pessoa?.cpf ?? '',
        vendedora_telefone: pessoa?.telefone ?? '',
        aparelho_marca: aparelho.marca ?? '',
        aparelho_modelo: aparelho.modelo ?? '',
        aparelho_cor: aparelho.cor ?? '',
        aparelho_capacidade: aparelho.configuracao ?? '',
        aparelho_imei: aparelho.imei,
        estado_aparelho: this.estadoDoAparelho(aparelho),
        valor: moedaContrato(valor),
      },
      enderecoChave: 'vendedora_endereco',
      endereco: pessoa?.endereco,
      formaPagamento: 'dinheiro',
    };
  }

  private rascunhoVenda(item: AparelhoLojaItem, preco: number, negociacao: NegociacaoForm, complemento = '') {
    const pessoa = this.pessoaContrato();
    const aVistaOuCartao = negociacao.forma === 'avista' || negociacao.forma === 'cartao';
    const entrada = aVistaOuCartao ? preco : Number(negociacao.entrada ?? 0);
    const repasse = aVistaOuCartao || negociacao.forma === 'paymobi' ? 0 : Number(negociacao.repasse ?? 0);
    const saldo = Math.max(0, Math.round((preco - entrada) * 100) / 100);
    return {
      codigo: negociacao.forma === 'paymobi' ? 'contrato-venda-boleto' : 'contrato-venda',
      valores: {
        comprador_nome: pessoa?.nome ?? '',
        comprador_cpf: pessoa?.cpf ?? '',
        comprador_rg: pessoa?.rg ?? '',
        comprador_telefone: pessoa?.telefone ?? '',
        comprador_email: pessoa?.email ?? '',
        aparelho_produto: [item.marca, item.modelo, item.configuracao].filter(s => !!s?.trim()).join(' '),
        aparelho_marca: item.marca,
        aparelho_modelo: item.modelo,
        aparelho_cor: item.cor ?? '',
        aparelho_capacidade: item.configuracao ?? '',
        aparelho_imei: item.imei,
        estado_aparelho: this.estadoDoAparelho(item),
        valor: moedaContrato(preco),
        valor_entrada: moedaContrato(entrada),
        valor_saldo: moedaContrato(saldo),
        observacoes: complemento,
      },
      enderecoChave: 'comprador_endereco',
      endereco: pessoa?.endereco,
      formaPagamento: negociacao.forma === 'cartao'
        ? 'cartao'
        : negociacao.forma === 'avista_cartao'
          ? 'avista_cartao'
          : negociacao.forma === 'avista' ? 'avista' : negociacao.forma,
      financiadoraNome: negociacao.forma === 'outra' ? negociacao.financiadoraNome.trim() : '',
      entrada: negociacao.forma === 'avista_cartao'
        ? moedaContrato(Number(negociacao.entrada ?? 0))
        : aVistaOuCartao ? '' : moedaContrato(entrada),
      repasse: negociacao.forma === 'avista_cartao'
        ? moedaContrato(Number(negociacao.repasse ?? 0))
        : aVistaOuCartao || !(repasse > 0) ? '' : moedaContrato(repasse),
      complemento,
    };
  }

  private pessoaContrato() {
    const cliente = this.cliente;
    if (!cliente) return null;
    return {
      nome: cliente.nome ?? '',
      cpf: formatarCpfCnpj(cliente.cpfCnpj),
      telefone: formatarTelefone(cliente.celular || cliente.telefone || ''),
      email: cliente.email ?? '',
      rg: cliente.rg ?? '',
      endereco: cliente.endereco,
    };
  }

  private estadoDoAparelho(dados: {
    condicao?: string;
    observacoes?: string;
    saudeBateria?: number | null;
    bateriaPerfeita?: boolean | null;
    alertaPermanente?: string;
    pecaTrocada?: string;
    mensagemPecaTrocada?: boolean;
    pecasTrocadas?: { nome: string; apareceMensagem: boolean }[];
    testes?: { nome: string; ok: boolean }[];
    osNumero?: string;
    testesNaOs?: boolean;
    osEntradaNumero?: string;
  }): string {
    const partes = [dados.condicao === 'novo' ? 'Novo' : 'Usado'];
    const bateria = Number(dados.saudeBateria);
    if (!Number.isNaN(bateria) && bateria > 0) partes.push(`saúde da bateria ${bateria}%`);
    if (dados.bateriaPerfeita === true) partes.push('bateria em perfeitas condições');
    if (dados.bateriaPerfeita === false) partes.push('bateria fora das perfeitas condições');
    if (dados.alertaPermanente?.trim()) partes.push(`alerta permanente: ${dados.alertaPermanente.trim()}`);
    const pecas = this.textoPecas(dados);
    if (pecas) partes.push(`peças trocadas: ${pecas}`);
    const os = (dados.osNumero || dados.osEntradaNumero || '').trim();
    if (os || dados.testesNaOs) {
      partes.push(os ? `testes feitos na OS ${os}` : 'testes feitos na ordem de serviço');
      partes.push('deságio já incluso no valor pago pela loja');
    }
    const testes = dados.testes ?? [];
    const aprovados = testes.filter(t => t.ok);
    if (aprovados.length && !os) {
      const falhas = testes.filter(t => !t.ok).map(t => t.nome);
      partes.push(falhas.length ? `testes com falha: ${falhas.join(', ')}` : 'testes funcionais conferidos');
    }
    if (dados.observacoes?.trim()) partes.push(dados.observacoes.trim());
    return partes.join('. ');
  }

  private igual(a?: string, b?: string): boolean {
    return this.normalizar(a ?? '') === this.normalizar(b ?? '');
  }

  private normalizar(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private tokens(termo: string): string[] {
    return this.normalizar(termo).split(/\s+/).filter(parte => parte.length > 0);
  }

  private sugerirCatalogo(lista: ModeloAparelho[], termo: string): AutocompleteItem[] {
    const partes = this.tokens(termo);
    return lista
      .filter(modelo => partes.every(parte => this.normalizar(modelo.nome).includes(parte)))
      .map(modelo => ({ id: modelo.id, nome: modelo.nome }));
  }

  private sugerirDoEstoque(nomes: string[], termo: string, marca: string): AutocompleteItem[] {
    const partes = this.tokens(termo);
    return nomes
      .filter(nome => partes.every(parte => this.normalizar(nome).includes(parte)))
      .map(nome => {
        const qtd = this.disponiveis.filter(item => this.igual(item.marca, marca) && this.igual(item.modelo, nome)).length;
        return {
          id: nome,
          nome,
          extra: qtd === 1 ? '1 disponível' : `${qtd} disponíveis`,
        };
      });
  }

  private agruparPorMarca(lista: AparelhoLojaItem[]): { marca: string; itens: AparelhoLojaItem[] }[] {
    const mapa = new Map<string, { marca: string; itens: AparelhoLojaItem[] }>();
    for (const item of lista) {
      const marca = (item.marca || '').trim() || 'Sem marca';
      const chave = this.normalizar(marca);
      const grupo = mapa.get(chave);
      if (grupo) grupo.itens.push(item);
      else mapa.set(chave, { marca, itens: [item] });
    }
    return [...mapa.values()].sort((a, b) => a.marca.localeCompare(b.marca, 'pt-BR'));
  }

  private opcoesDe(
    campo: 'marca' | 'modelo' | 'cor',
    filtro: (item: AparelhoLojaItem) => boolean,
    origem: AparelhoLojaItem[] = this.disponiveis,
  ): string[] {
    const mapa = new Map<string, string>();
    for (const item of origem.filter(filtro)) {
      const valor = (item[campo] ?? '').trim();
      if (!valor) continue;
      const chave = valor.toLowerCase();
      if (!mapa.has(chave)) mapa.set(chave, valor);
    }
    return [...mapa.values()].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  }

  private coresEmCache(
    cache: { chave: string; lista: { cor: string; qtd: number }[] },
    marca: string,
    modelo: string,
  ): { cor: string; qtd: number }[] {
    const chave = `${marca}\0${modelo}\0${this.disponiveis.map(a => a.id).join(',')}`;
    if (cache.chave !== chave) {
      cache.chave = chave;
      cache.lista = this.coresDe(a => this.igual(a.marca, marca) && this.igual(a.modelo, modelo));
    }
    return cache.lista;
  }

  private coresDe(filtro: (item: AparelhoLojaItem) => boolean): { cor: string; qtd: number }[] {
    const mapa = new Map<string, { cor: string; qtd: number }>();
    for (const item of this.disponiveis.filter(filtro)) {
      const cor = (item.cor ?? '').trim();
      if (!cor) continue;
      const chave = cor.toLowerCase();
      const atual = mapa.get(chave);
      if (atual) atual.qtd += 1;
      else mapa.set(chave, { cor, qtd: 1 });
    }
    return [...mapa.values()].sort((x, y) => x.cor.localeCompare(y.cor, 'pt-BR'));
  }

  private unidadesDe(marca: string, modelo: string, cor: string): AparelhoLojaItem[] {
    if (!marca || !modelo || !cor) return [];
    return this.disponiveis.filter(item =>
      this.igual(item.marca, marca) && this.igual(item.modelo, modelo) && this.igual(item.cor, cor));
  }

  private unidadeEscolhida(id: string, lista: AparelhoLojaItem[]): AparelhoLojaItem | null {
    if (!this.cliente) return null;
    if (id) return lista.find(a => a.id === id) ?? null;
    return lista.length === 1 ? lista[0] : null;
  }

  private fixarUnidade(lista: AparelhoLojaItem[], gravar: (id: string) => void): AparelhoLojaItem | null {
    const item = lista.length === 1 ? lista[0] : null;
    gravar(item?.id ?? '');
    return item;
  }

  private unidadeDaLista(id: string, lista: AparelhoLojaItem[]): AparelhoLojaItem | null {
    if (id) return lista.find(a => a.id === id) ?? null;
    return lista.length === 1 ? lista[0] : null;
  }

  private aplicarPrecoVenda(item: AparelhoLojaItem | null): void {
    this.venda.preco = item && Number(item.valorVenda) > 0 ? Number(item.valorVenda) : null;
  }

  private aplicarPrecoTroca(item: AparelhoLojaItem | null): void {
    this.troca.precoSaida = item && Number(item.valorVenda) > 0 ? Number(item.valorVenda) : null;
  }

  adicionarEntradaTroca(): void {
    this.entradasTroca = [...this.entradasTroca, this.novaFicha()];
  }

  removerEntradaTroca(ficha: FichaEntrada): void {
    if (this.entradasTroca.length < 2) return;
    if (ficha.buscaOs) clearTimeout(ficha.buscaOs);
    this.entradasTroca = this.entradasTroca.filter(item => item.id !== ficha.id);
  }

  onMarcaFicha(id: string, ficha: FichaEntrada): void {
    ficha.marcaId = id;
    ficha.modelo = null;
    ficha.modelos = [];
    ficha.corLista = '';
    ficha.dados.cor = '';
    if (!id) {
      ficha.carregando = false;
      return;
    }
    ficha.carregando = true;
    this.aparelhos.listarModelos({ marcaId: id, tipoDispositivo: 'Celular', limite: MODELO_LIMITE_LISTA }).subscribe({
      next: lista => {
        if (ficha.marcaId !== id) return;
        ficha.modelos = lista ?? [];
        ficha.carregando = false;
      },
      error: () => {
        if (ficha.marcaId !== id) return;
        ficha.modelos = [];
        ficha.carregando = false;
      },
    });
  }

  onModeloFicha(item: AutocompleteItem | null, ficha: FichaEntrada): void {
    ficha.corLista = '';
    ficha.dados.cor = '';
    if (!item?.id || !item.nome?.trim()) {
      ficha.modelo = null;
      return;
    }
    const marca = this.marcas.find(m => m.id === ficha.marcaId);
    ficha.modelo = {
      id: item.id,
      nome: item.nome.trim(),
      marcaId: ficha.marcaId,
      marcaNome: marca?.nome || '',
    };
  }

  onCorFicha(cor: string, ficha: FichaEntrada): void {
    ficha.corLista = cor;
    ficha.dados.cor = cor === '__nova' ? '' : cor;
  }

  onImeiFicha(valor: string, ficha: FichaEntrada): void {
    ficha.dados.imei = apenasDigitos(valor).slice(0, 15);
  }

  onOsFicha(valor: string, ficha: FichaEntrada): void {
    ficha.dados.osNumero = apenasDigitos(valor);
    ficha.osConsulta = null;
    if (ficha.buscaOs) clearTimeout(ficha.buscaOs);
    if (!ficha.dados.osNumero) {
      ficha.osBuscando = false;
      return;
    }
    ficha.osBuscando = true;
    const numero = ficha.dados.osNumero;
    ficha.buscaOs = setTimeout(() => this.buscarOsFicha(ficha, numero), 400);
  }

  onMidiaFicha(evento: Event, ficha: FichaEntrada): void {
    const input = evento.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    const videos = arquivos.filter(a => this.arquivoVideo(a));
    const fotos = arquivos.filter(a => !this.arquivoVideo(a));
    const videoGrande = videos.find(a => a.size > 40 * 1024 * 1024);
    const fotoGrande = fotos.find(a => a.size > 8 * 1024 * 1024);
    if (videoGrande) avisarErroUsuario('Cada vídeo pode ter no máximo 40 MB.');
    else if (fotoGrande) avisarErroUsuario('Cada foto pode ter no máximo 8 MB.');
    ficha.fotos = fotos.filter(a => a.size <= 8 * 1024 * 1024).slice(0, 12);
    ficha.videos = videos.filter(a => a.size <= 40 * 1024 * 1024).slice(0, 3);
  }

  abrirQrFicha(ficha: FichaEntrada): void {
    ficha.qrAberto = true;
    if (ficha.sessaoToken) {
      this.iniciarPoll();
      return;
    }
    this.api.criarSessaoFotos().subscribe({
      next: async sessao => {
        ficha.sessaoToken = sessao.token;
        ficha.qrDataUrl = await QRCode.toDataURL(sessao.url, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
        this.iniciarPoll();
      },
      error: (err: { error?: { erro?: string } }) => {
        ficha.qrAberto = false;
        avisarErroUsuario(err?.error?.erro || 'Não foi possível gerar o QR.');
      },
    });
  }

  ehIphoneDe(ficha: FichaEntrada): boolean {
    return this.normalizar(`${ficha.modelo?.marcaNome || ''} ${ficha.modelo?.nome || ''}`).includes('iphone');
  }

  coresDeFicha(ficha: FichaEntrada): string[] {
    if (!ficha.modelo?.id) return [];
    return this.opcoesDe('cor', a => a.modeloId === ficha.modelo?.id, this.estoque);
  }

  alertaImeiDe(ficha: FichaEntrada): string {
    return mensagemAlertaImei(ficha.dados.imei);
  }

  osAbertaDe(ficha: FichaEntrada): boolean {
    return !!ficha.osConsulta?.encontrada && !!ficha.osConsulta.aberta;
  }

  osEncerradaDe(ficha: FichaEntrada): boolean {
    return !!ficha.osConsulta?.encontrada && !ficha.osConsulta.aberta;
  }

  osNaoEncontradaDe(ficha: FichaEntrada): boolean {
    return !!ficha.osConsulta && !ficha.osConsulta.encontrada && apenasDigitos(ficha.dados.osNumero).length > 0;
  }

  osImeiDivergeDe(ficha: FichaEntrada): boolean {
    const imeiOs = apenasDigitos(ficha.osConsulta?.imei);
    const imei = apenasDigitos(ficha.dados.imei);
    return this.osAbertaDe(ficha) && imeiOs.length === 15 && imei.length === 15 && imeiOs !== imei;
  }

  textoMidiaDe(ficha: FichaEntrada): string {
    return this.textoMidia(ficha.fotos.length, ficha.videos.length);
  }

  textoMidiaRecebidaDe(ficha: FichaEntrada): string {
    const videos = ficha.fotosSessao.filter(foto => this.ehVideo(foto)).length;
    const total = ficha.fotosSessao.length;
    const recebido = total === 1 ? 'recebido' : 'recebidos';
    return this.textoMidia(total - videos, videos) + ` ${recebido} do celular.`;
  }

  private novaFicha(): FichaEntrada {
    const ficha: FichaEntrada = {
      id: ++this.seqFicha,
      marcaId: '',
      modelos: [],
      carregando: false,
      modelo: null,
      corLista: '',
      dados: this.entradaVazia('usado'),
      valorAvaliado: null,
      testes: this.testesVazios(),
      fotos: [],
      videos: [],
      qrAberto: false,
      qrDataUrl: '',
      sessaoToken: '',
      fotosSessao: [],
      osConsulta: null,
      osBuscando: false,
      buscarModelo: () => of([]),
    };
    ficha.buscarModelo = (termo: string) => {
      if (!ficha.marcaId) return of([]);
      if (ficha.modelos.length > 0) return of(this.sugerirCatalogo(ficha.modelos, termo));
      if (!ficha.carregando) return of([]);
      return this.aparelhos.buscarModelos(termo, ficha.marcaId, 'Celular').pipe(
        map(lista => this.sugerirCatalogo(lista ?? [], termo)),
      );
    };
    return ficha;
  }

  private buscarOsFicha(ficha: FichaEntrada, numero: string): void {
    this.api.consultarOs(numero).subscribe({
      next: os => {
        if (ficha.dados.osNumero !== numero) return;
        ficha.osConsulta = os;
        ficha.osBuscando = false;
        if (os.encontrada && os.aberta && os.imei && !ficha.dados.imei) ficha.dados.imei = os.imei;
      },
      error: () => {
        if (ficha.dados.osNumero !== numero) return;
        ficha.osBuscando = false;
        ficha.osConsulta = null;
      },
    });
  }

  private payloadFicha(ficha: FichaEntrada) {
    const qual = this.entradasTroca.length > 1 ? ` do aparelho ${this.entradasTroca.indexOf(ficha) + 1}` : '';
    if (!ficha.modelo?.id || !ficha.modelo.nome?.trim() || !ficha.modelo.marcaNome?.trim()) {
      avisarErroUsuario(`Selecione o modelo${qual}.`);
      return null;
    }
    const imei = this.imeiParaEntrada(ficha.dados.imei, qual);
    if (!ficha.dados.cor.trim()) {
      avisarErroUsuario(`Informe a cor${qual}.`);
      return null;
    }
    if (!this.configuracoes.includes(ficha.dados.configuracao)) {
      avisarErroUsuario(`Selecione a configuração${qual}.`);
      return null;
    }
    const iphone = this.ehIphoneDe(ficha);
    if (iphone && ficha.dados.bateriaPerfeita !== 'sim' && ficha.dados.bateriaPerfeita !== 'nao') {
      avisarErroUsuario(`Informe se a saúde da bateria do iPhone${qual} está em perfeitas condições.`);
      return null;
    }
    const pecas = iphone ? this.pecasPreenchidas(ficha.dados.pecas) : [];
    const valorVenda = Number(ficha.dados.valorVenda);
    const valorMinimoVenda = Number(ficha.dados.valorMinimoVenda);
    if (!(valorVenda > 0)) {
      avisarErroUsuario(`Informe o valor de venda${qual}.`);
      return null;
    }
    if (!(valorMinimoVenda > 0)) {
      avisarErroUsuario(`Informe o valor mínimo para venda${qual}.`);
      return null;
    }
    if (valorMinimoVenda > valorVenda) {
      avisarErroUsuario(`O valor mínimo para venda${qual} não pode passar do valor de venda.`);
      return null;
    }
    return {
      imei,
      marca: ficha.modelo.marcaNome,
      modelo: ficha.modelo.nome,
      marcaId: ficha.modelo.marcaId,
      modeloId: ficha.modelo.id,
      cor: ficha.dados.cor,
      configuracao: ficha.dados.configuracao,
      condicao: ficha.dados.condicao,
      valorVenda,
      valorMinimoVenda,
      observacoes: ficha.dados.observacoes,
      alertaPermanente: ficha.dados.alertaPermanente.trim(),
      saudeBateria: ficha.dados.saudeBateria,
      bateriaPerfeita: iphone ? ficha.dados.bateriaPerfeita === 'sim' : null,
      pecasTrocadas: pecas,
      pecaTrocada: pecas.map(p => p.nome).join(', '),
      mensagemPecaTrocada: pecas.some(p => p.apareceMensagem),
      testes: this.osAbertaDe(ficha) ? [] : ficha.testes.map(t => ({ nome: t.nome, ok: t.ok })),
      passaPorAssistencia: ficha.dados.passaPorAssistencia,
      osNumero: ficha.dados.osNumero.trim(),
    };
  }

  private enviarComMidias(
    req: Observable<AparelhoLojaPainel>,
    sucesso: string,
    grupos: { imei: string; arquivos: File[] }[],
    depois?: () => void,
  ): void {
    this.salvando = true;
    this.erro = '';
    req.subscribe({
      next: painel => this.subirMidias(painel, grupos, sucesso, depois, false),
      error: (err: { error?: { erro?: string } }) => {
        this.salvando = false;
        this.imeisOsNova = [];
        this.imeisQr = [];
        this.abrirQrNoProximo = false;
        limparRascunhoContrato();
        this.erro = err?.error?.erro || 'Não foi possível salvar.';
        avisarErroUsuario(this.erro);
      },
    });
  }

  private subirMidias(
    painel: AparelhoLojaPainel,
    grupos: { imei: string; arquivos: File[] }[],
    sucesso: string,
    depois: (() => void) | undefined,
    falha: boolean,
  ): void {
    const indice = grupos.findIndex(grupo => grupo.arquivos.length > 0);
    if (indice < 0) {
      this.concluir(painel, sucesso);
      if (falha) avisarErroUsuario('A troca entrou, mas alguma foto ou vídeo não foi salvo.');
      depois?.();
      return;
    }
    const grupo = grupos[indice];
    const resto = grupos.filter((_, i) => i !== indice);
    const alvo = painel.estoque.find(a => a.imei === grupo.imei && (a.status === 'em_estoque' || a.status === 'em_assistencia'));
    if (!alvo?.id) {
      this.subirMidias(painel, resto, sucesso, depois, true);
      return;
    }
    this.api.fotos(alvo.id, grupo.arquivos).subscribe({
      next: atualizado => this.subirMidias(atualizado, resto, sucesso, depois, falha),
      error: () => this.subirMidias(painel, resto, sucesso, depois, true),
    });
  }

  private payloadEntrada() {
    if (!this.modelo?.id || !this.modelo.nome?.trim() || !this.modelo.marcaNome?.trim()) {
      avisarErroUsuario('Selecione o modelo do aparelho.');
      return null;
    }
    const imei = this.imeiParaEntrada(this.entrada.imei);
    if (!this.entrada.cor.trim()) {
      avisarErroUsuario('Informe a cor do aparelho.');
      return null;
    }
    if (!this.configuracoes.includes(this.entrada.configuracao)) {
      avisarErroUsuario('Selecione a configuração do aparelho.');
      return null;
    }
    if (this.ehIphone && this.entrada.bateriaPerfeita !== 'sim' && this.entrada.bateriaPerfeita !== 'nao') {
      avisarErroUsuario('Informe se a saúde da bateria do iPhone está em perfeitas condições.');
      return null;
    }
    const pecas = this.ehIphone ? this.pecasPreenchidas(this.entrada.pecas) : [];
    const valorVenda = Number(this.entrada.valorVenda);
    const valorMinimoVenda = Number(this.entrada.valorMinimoVenda);
    if (!(valorVenda > 0)) {
      avisarErroUsuario('Informe o valor de venda.');
      return null;
    }
    if (!(valorMinimoVenda > 0)) {
      avisarErroUsuario('Informe o valor mínimo para venda.');
      return null;
    }
    if (valorMinimoVenda > valorVenda) {
      avisarErroUsuario('O valor mínimo para venda não pode passar do valor de venda.');
      return null;
    }
    return {
      imei,
      marca: this.modelo.marcaNome,
      modelo: this.modelo.nome,
      marcaId: this.modelo.marcaId,
      modeloId: this.modelo.id,
      cor: this.entrada.cor,
      configuracao: this.entrada.configuracao,
      condicao: this.entrada.condicao,
      valorVenda,
      valorMinimoVenda,
      observacoes: this.entrada.observacoes,
      alertaPermanente: this.entrada.alertaPermanente.trim(),
      saudeBateria: this.entrada.saudeBateria,
      bateriaPerfeita: this.ehIphone ? this.entrada.bateriaPerfeita === 'sim' : null,
      pecasTrocadas: pecas,
      pecaTrocada: pecas.map(p => p.nome).join(', '),
      mensagemPecaTrocada: pecas.some(p => p.apareceMensagem),
      testes: this.temOsInformada ? [] : this.testes.map(t => ({ nome: t.nome, ok: t.ok })),
      passaPorAssistencia: this.entrada.passaPorAssistencia,
      osNumero: this.entrada.osNumero.trim(),
    };
  }

  private enviar(
    req: Observable<AparelhoLojaPainel>,
    sucesso: string,
    imeiFotos?: string,
    depois?: () => void,
  ): void {
    this.salvando = true;
    this.erro = '';
    const fotos = [...this.fotos, ...this.videos];
    const fim = (painel: AparelhoLojaPainel) => {
      this.concluir(painel, sucesso);
      depois?.();
    };
    req.subscribe({
      next: (painel: AparelhoLojaPainel) => {
        const alvo = imeiFotos
          ? painel.estoque.find(a => a.imei === imeiFotos && (a.status === 'em_estoque' || a.status === 'em_assistencia'))
          : undefined;
        if (alvo?.id && fotos.length) {
          this.api.fotos(alvo.id, fotos).subscribe({
            next: atualizado => fim(atualizado),
            error: () => {
              fim(painel);
              avisarErroUsuario('O aparelho entrou, mas as fotos e os vídeos não foram salvos.');
            },
          });
          return;
        }
        fim(painel);
      },
      error: (err: { error?: { erro?: string } }) => {
        this.salvando = false;
        this.imeisOsNova = [];
        this.imeisQr = [];
        this.abrirQrNoProximo = false;
        limparRascunhoContrato();
        this.erro = err?.error?.erro || 'Não foi possível salvar.';
        avisarErroUsuario(this.erro);
      },
    });
  }

  private carregar(): void {
    this.carregando = true;
    this.api.painel().subscribe({
      next: painel => {
        this.painel = painel;
        this.carregando = false;
        if (this.codigoPendente) {
          if (this.tela === 'venda') this.onBuscaCodigoVenda(this.codigoPendente);
          if (this.tela === 'troca') this.onBuscaCodigoTroca(this.codigoPendente);
          if (this.tela === 'transacoes') this.onBuscaCadeia(this.codigoPendente);
          this.codigoPendente = '';
        } else if (this.tela === 'transacoes' && this.buscaCadeia.trim()) {
          this.onBuscaCadeia(this.buscaCadeia);
        }
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível carregar o estoque de aparelhos.';
      },
    });
  }

  private concluir(painel: AparelhoLojaPainel, sucesso: string): void {
    const imeis = this.imeisOsNova;
    const qr = this.imeisQr;
    this.imeisOsNova = [];
    this.imeisQr = [];
    this.painel = painel;
    this.salvando = false;
    this.fotos = [];
    this.videos = [];
    this.fecharQr();
    const procurarNovo = this.abrirQrNoProximo;
    this.abrirQrNoProximo = false;
    const novos = procurarNovo
      ? painel.estoque.filter(a =>
        !!a.id
        && !this.idsEstoqueAntes.has(a.id)
        && (a.status === 'em_estoque' || a.status === 'em_assistencia'))
      : [];
    const tela = this.tela;
    if (tela === 'compra' || tela === 'venda' || tela === 'troca') {
      const recem = novos
        .filter(a => !!a.codigo)
        .map(a => ({ codigo: a.codigo || '', nome: `${a.marca} ${a.modelo}`.trim() }));
      this.abrir(tela);
      this.codigosRecem = recem;
      const codigos = recem.map(c => c.codigo).join(', ');
      avisarSucessoUsuario(codigos ? `${sucesso} Código: ${codigos}.` : sucesso);
      this.imprimirOsGeradas(painel, imeis, novos);
      return;
    }
    this.modo = null;
    avisarSucessoUsuario(sucesso);
    this.imprimirOsGeradas(painel, imeis, novos);
    const porImei = qr
      .filter(imei => imei.length === 15)
      .map(imei => painel.estoque.find(a => apenasDigitos(a.imei) === imei && (a.status === 'em_estoque' || a.status === 'em_assistencia')))
      .find(item => !!item);
    const alvo = procurarNovo ? (porImei ?? novos[0]) : undefined;
    if (!alvo?.id) return;
    this.fichaId = alvo.id;
    this.abrirQrAparelho(alvo);
    setTimeout(() => document.getElementById(`aparelho-${alvo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  private imprimirOsGeradas(painel: AparelhoLojaPainel, imeis: string[], novos: AparelhoLojaItem[]): void {
    const vistos = new Set<number>();
    const candidatos = [
      ...imeis
        .filter(imei => imei.length === 15)
        .map(imei => painel.estoque.find(a => apenasDigitos(a.imei) === imei && !!a.osEntradaId)),
      ...novos.filter(a => !!a.osEntradaId),
    ];
    for (const item of candidatos) {
      if (!item?.osEntradaId || vistos.has(item.osEntradaId)) continue;
      vistos.add(item.osEntradaId);
      const os = { id: item.osEntradaId, numero: item.osEntradaNumero } as BlingOrdemServico;
      this.impressao.imprimir(OS_IMPRESSAO_PADRAO_POS_CADASTRO, os);
    }
  }

  private marcarEstoqueAntes(): void {
    this.idsEstoqueAntes = new Set(this.estoque.map(a => a.id).filter((id): id is string => !!id));
  }

  private imeiParaEntrada(valor: string, qual = ''): string {
    const digitos = apenasDigitos(valor);
    if (digitos.length === 15 && new Set(digitos).size > 1) return digitos;
    if (digitos.length > 0) {
      avisarAvisoUsuario(`IMEI${qual} incompleto. O aparelho entra sem IMEI. Informe depois do conserto.`);
    }
    return '';
  }

  private iniciarPoll(): void {
    this.pararPoll();
    this.atualizarFotosSessao();
    this.pollFotos = setInterval(() => this.atualizarFotosSessao(), 3000);
  }

  private pararPoll(): void {
    if (!this.pollFotos) return;
    clearInterval(this.pollFotos);
    this.pollFotos = undefined;
  }

  private atualizarFotosSessao(): void {
    if (this.sessaoToken) {
      const token = this.sessaoToken;
      this.api.sessaoFotos(token).subscribe({
        next: sessao => {
          if (this.sessaoToken !== token) return;
          const fotos = sessao.fotos ?? [];
          const mudou = fotos.length !== this.fotosNaSessao;
          this.fotosSessao = fotos;
          this.fotosNaSessao = fotos.length;
          if (mudou && this.qrAparelhoId) {
            this.api.painel().subscribe({ next: painel => { this.painel = painel; } });
          }
        },
        error: () => {},
      });
    }
    for (const ficha of this.entradasTroca) {
      if (!ficha.sessaoToken) continue;
      const token = ficha.sessaoToken;
      this.api.sessaoFotos(token).subscribe({
        next: sessao => { if (ficha.sessaoToken === token) ficha.fotosSessao = sessao.fotos ?? []; },
        error: () => {},
      });
    }
  }

  private fecharQr(): void {
    this.pararPoll();
    this.qrAberto = false;
    this.qrAparelhoId = '';
    this.qrDataUrl = '';
    this.sessaoToken = '';
    this.fotosSessao = [];
    this.fotosNaSessao = 0;
    for (const ficha of this.entradasTroca) {
      ficha.qrAberto = false;
      ficha.qrDataUrl = '';
      ficha.sessaoToken = '';
      ficha.fotosSessao = [];
    }
  }

  adicionarPeca(pecas: { nome: string; apareceMensagem: boolean }[]): void {
    if (pecas.length >= 8) return;
    pecas.push({ nome: '', apareceMensagem: false });
  }

  removerPeca(pecas: { nome: string; apareceMensagem: boolean }[], indice: number): void {
    if (pecas.length < 2) return;
    pecas.splice(indice, 1);
  }

  textoPecas(origem: {
    pecasTrocadas?: { nome: string; apareceMensagem: boolean }[];
    pecaTrocada?: string;
    mensagemPecaTrocada?: boolean;
  }): string {
    const lista = (origem.pecasTrocadas ?? []).filter(p => p.nome?.trim());
    if (lista.length) {
      return lista
        .map(p => p.apareceMensagem ? `${p.nome.trim()} · aparece mensagem` : p.nome.trim())
        .join('; ');
    }
    const legado = origem.pecaTrocada?.trim() ?? '';
    if (!legado) return '';
    return origem.mensagemPecaTrocada ? `${legado} · aparece mensagem` : legado;
  }

  private pecasPreenchidas(pecas: { nome: string; apareceMensagem: boolean }[]): { nome: string; apareceMensagem: boolean }[] {
    return pecas
      .map(p => ({ nome: p.nome.trim(), apareceMensagem: !!p.nome.trim() && p.apareceMensagem }))
      .filter(p => p.nome.length > 0);
  }

  private testesVazios() {
    return [
      'Tela', 'Touch', 'Câmera frontal', 'Câmera traseira', 'Alto-falante',
      'Microfone', 'Carga', 'Biometria', 'Wi-Fi 2.4 GHz', 'Wi-Fi 5 GHz',
      'Bluetooth', 'NFC', 'Teste de vazamento de luz', 'Teste de pressão na tela', 'Botões',
    ].map(nome => ({ nome, ok: false }));
  }

  private entradaVazia(condicao = 'usado') {
    return {
      imei: '',
      cor: '',
      configuracao: '',
      condicao,
      observacoes: '',
      alertaPermanente: '',
      saudeBateria: null as number | null,
      bateriaPerfeita: '' as '' | 'sim' | 'nao',
      pecas: [{ nome: '', apareceMensagem: false }],
      passaPorAssistencia: false,
      osNumero: '',
      valorVenda: null as number | null,
      valorMinimoVenda: null as number | null,
    };
  }
}
