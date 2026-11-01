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
import { AparelhosService } from '../../../services/aparelhos';
import { AppAuthService } from '../../../services/app-auth';
import {
  AparelhoLojaItem,
  AparelhoLojaPainel,
  AparelhoLojaService,
  AparelhoOperacao,
  AparelhoVendedorResumo,
  OsAbertaConsulta,
} from '../../../services/aparelho-loja.service';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import { BlingContato, BlingContatoRef, MarcaAparelho, ModeloAparelho } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA } from '../../../config/aparelhos.config';
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
    saudeBateria: number | null;
    bateriaPerfeita: '' | 'sim' | 'nao';
    pecaTrocada: string;
    mensagemPecaTrocada: boolean;
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
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>{{ financeiro ? 'Financeiro dos aparelhos' : 'Compra, venda e troca' }}</h2>
        <a *ngIf="financeiro" routerLink="/vendas-celulares/loja">Voltar para compra, venda e troca</a>
        <a *ngIf="isAdmin && !financeiro" routerLink="/vendas-celulares/loja/financeiro">Financeiro</a>
      </div>
      <p class="hint" *ngIf="!financeiro">
        Celulares ficam neste estoque, fora do Bling. O Bling continua só com acessórios e eletrônicos.
        Na troca, o caixa registra só a diferença em dinheiro.
        Quem leva um aparelho novo ou usado ganha desconto na assistência, pelo CPF e pelo IMEI.
      </p>
      <p class="hint" *ngIf="financeiro">
        Valor de estoque e o dinheiro que entrou e saiu. Esta parte fica só para administrador.
      </p>

      <div class="cards" *ngIf="painel && !financeiro">
        <div class="card" *ngFor="let g of disponiveisPorMarca">
          <span>{{ g.marca }}</span>
          <strong>{{ g.qtd }}</strong>
          <small>{{ textoDisponiveis(g.qtd) }}</small>
        </div>
        <div class="card" *ngIf="!disponiveisPorMarca.length">
          <span>Disponíveis</span>
          <strong>0</strong>
        </div>
        <div class="card" *ngIf="painel.resumo.emAssistencia">
          <span>Na assistência</span>
          <strong>{{ painel.resumo.emAssistencia }}</strong>
          <small>Fora de venda até liberar</small>
        </div>
      </div>

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
          <span>Assistência no estoque</span>
          <strong>{{ dinheiro(custoOperacao(painel.resumo)) }}</strong>
          <small>Peças {{ dinheiro(painel.resumo.custoPecas) }} · mão de obra {{ dinheiro(painel.resumo.custoMaoDeObra) }}</small>
        </div>
      </div>

      <h3 *ngIf="vendedores.length && !financeiro">Por vendedor</h3>
      <table class="data-grid" *ngIf="vendedores.length && !financeiro">
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

      <div class="acoes" *ngIf="!financeiro">
        <button type="button" (click)="abrir('compra')" [class.ativo]="modo === 'compra'">Compra</button>
        <button type="button" (click)="abrir('venda')" [class.ativo]="modo === 'venda'">Venda</button>
        <button type="button" (click)="abrir('troca')" [class.ativo]="modo === 'troca'">Troca</button>
      </div>

      <p *ngIf="erro" class="erro">{{ erro }}</p>

      <form class="painel" *ngIf="modo === 'compra'" (ngSubmit)="salvarCompra()" (keydown.enter)="bloquearEnterDaBusca($event)">
        <h3>Compra — aparelho entra no estoque</h3>
        <p class="hint">A loja paga. Quem vendeu o aparelho para a loja não ganha desconto na assistência.</p>
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
            <input [ngModel]="entrada.imei" (ngModelChange)="onImei($event)" name="imeiCompra" inputmode="numeric" placeholder="15 dígitos" />
            <span class="campo-aviso" *ngIf="alertaImei">{{ alertaImei }}</span>
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
          <div class="form-group">
            <label>Peça trocada</label>
            <input [(ngModel)]="entrada.pecaTrocada" name="pecaTrocadaCompra" placeholder="Ex.: bateria, tela" />
          </div>
          <label class="check-label" *ngIf="entrada.pecaTrocada.trim()">
            <input type="checkbox" [(ngModel)]="entrada.mensagemPecaTrocada" name="mensagemPecaCompra" />
            Aparece mensagem
          </label>
        </div>
        <label class="check-label">
          <input type="checkbox" [(ngModel)]="entrada.passaPorAssistencia" name="assistenciaCompra" />
          Passa pela assistência antes de vender
        </label>
        <p class="hint" *ngIf="entrada.passaPorAssistencia">Não entra na venda nem na troca até a assistência liberar.</p>
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
        <div class="form-group">
          <label>Fotos e vídeos do aparelho</label>
          <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm,video/*" multiple (change)="onMidia($event)" />
          <p class="hint">Até 12 fotos e 3 vídeos. Os vídeos entram com o áudio da gravação. Fotos até 8 MB, vídeos até 40 MB.</p>
          <p class="hint" *ngIf="textoMidiaSelecionada">{{ textoMidiaSelecionada }}. Sobe junto com o cadastro.</p>
          <button type="button" class="secundario" (click)="abrirQr()">QR code — câmera do celular</button>
          <div class="qr-box" *ngIf="qrAberto">
            <p class="hint">Escaneie com o celular. Dá para tirar fotos ou gravar vídeos com áudio.</p>
            <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="QR code das fotos e vídeos" class="qr" />
            <p class="hint" *ngIf="fotosSessao.length">{{ textoMidiaRecebida }}</p>
          </div>
        </div>
        <div class="acoes">
          <button type="submit" [disabled]="salvando">{{ salvando ? 'Salvando…' : 'Registrar compra' }}</button>
          <button type="button" class="secundario" (click)="cancelar()">Cancelar</button>
        </div>
      </form>

      <form class="painel" *ngIf="modo === 'venda'" (ngSubmit)="salvarVenda()" (keydown.enter)="bloquearEnterDaBusca($event)">
        <h3>Venda — cliente leva um aparelho do estoque</h3>
        <p class="hint" *ngIf="venda.forma === 'avista'">O dinheiro que entra é o preço. Esse CPF e esse IMEI passam a ter desconto na assistência. O contrato abre preenchido.</p>
        <p class="hint" *ngIf="venda.forma === 'cartao'">O valor que entra é o preço, no cartão. A parcela calculada é o que passa para o cliente. A loja recebe o preço.</p>
        <p class="hint" *ngIf="venda.forma === 'avista_cartao'">Parte à vista e parte no cartão. As duas somam o preço e as duas entram no caixa.</p>
        <p class="hint" *ngIf="ehFinanciada(venda.forma)">O preço é o valor do contrato. No caixa entra a entrada e o repasse da financiadora. O saldo que o cliente deve a ela não é dinheiro da loja.</p>
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
            <option *ngFor="let a of unidadesVenda" [value]="a.id">{{ a.configuracao || 'Sem capacidade' }} · {{ a.imei }}</option>
          </select>
        </div>
        <p class="hint" *ngIf="unidadesVenda.length === 1">{{ unidadesVenda[0].configuracao || 'Sem capacidade' }} · IMEI {{ unidadesVenda[0].imei }}</p>
        <p class="hint" *ngIf="!disponiveis.length">Nenhum aparelho liberado para venda. Os que estão na assistência aparecem no estoque.</p>
        <div class="form-row">
          <div class="form-group">
            <label>Preço do aparelho</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="venda.preco" name="precoVenda" />
            <p class="hint">Este é o valor de venda cadastrado no estoque.</p>
            <p class="hint" *ngIf="aparelhoVendaSelecionado?.valorMinimoVenda">Mínimo para venda: {{ dinheiro(aparelhoVendaSelecionado?.valorMinimoVenda) }}.</p>
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
          <button type="button" class="secundario" (click)="modo = null">Cancelar</button>
        </div>
      </form>

      <form class="painel" *ngIf="modo === 'troca'" (ngSubmit)="salvarTroca()" (keydown.enter)="bloquearEnterDaBusca($event)">
        <h3>Troca — entra um ou mais aparelhos e sai outro</h3>
        <p class="hint" *ngIf="troca.forma === 'avista' || troca.forma === 'cartao' || troca.forma === 'avista_cartao'">
          O caixa registra só a diferença. Cada aparelho que entra fica no estoque pelo próprio valor avaliado.
          O desconto fica no aparelho que o cliente leva.
        </p>
        <p class="hint" *ngIf="ehFinanciada(troca.forma)">
          O preço do aparelho que sai é o valor do contrato. No caixa entra a entrada e o repasse.
          Se os aparelhos que entram valem mais, a loja devolve a diferença.
        </p>
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
            <option *ngFor="let a of unidadesTroca" [value]="a.id">{{ a.configuracao || 'Sem capacidade' }} · {{ a.imei }}</option>
          </select>
        </div>
        <p class="hint" *ngIf="unidadesTroca.length === 1">{{ unidadesTroca[0].configuracao || 'Sem capacidade' }} · IMEI {{ unidadesTroca[0].imei }}</p>
        <div class="form-row">
          <div class="form-group">
            <label>Preço do aparelho que sai</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.precoSaida" name="precoSaida" />
            <p class="hint">Este é o valor de venda cadastrado no estoque.</p>
            <p class="hint" *ngIf="aparelhoTrocaSelecionado?.valorMinimoVenda">Mínimo para venda: {{ dinheiro(aparelhoTrocaSelecionado?.valorMinimoVenda) }}.</p>
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
        <div class="juros" *ngIf="baseParcelasTroca > 0">
          <button type="button" class="secundario" (click)="jurosTrocaAberto = !jurosTrocaAberto">
            {{ jurosTrocaAberto ? 'Ocultar parcelas' : 'Calcular parcelas no cartão' }}
          </button>
          <ng-container *ngIf="jurosTrocaAberto">
            <p class="hint">Para a loja receber {{ dinheiro(baseParcelasTroca) }} no cartão, passar para o cliente:</p>
            <div class="grade-juros">
              <button type="button" *ngFor="let op of opcoesJuros(baseParcelasTroca)" (click)="opcaoJurosTroca = op" [class.ativo]="opcaoJurosTroca?.parcelas === op.parcelas">
                <strong>{{ op.parcelas }}x</strong>
                <span>{{ dinheiro(op.parcelas === 1 ? op.total : op.valorParcela) }}</span>
                <small *ngIf="op.parcelas > 1">total {{ dinheiro(op.total) }}</small>
              </button>
            </div>
            <p class="hint" *ngIf="opcaoJurosTroca as op">
              {{ op.parcelas === 1 ? dinheiro(op.total) : op.parcelas + 'x de ' + dinheiro(op.valorParcela) }}.
              Acréscimo {{ dinheiro(op.juros) }}. Taxa {{ taxa(op.taxaExibidaPct) }}.
              A loja recebe {{ dinheiro(baseParcelasTroca) }}.
            </p>
          </ng-container>
        </div>
        <div class="form-group">
          <label>Negociação do aparelho que sai</label>
          <select [(ngModel)]="troca.forma" name="formaTroca">
            <option value="avista">À vista na loja</option>
            <option value="cartao">Cartão de crédito</option>
            <option value="avista_cartao">À vista + cartão</option>
            <option value="payjoy">Payjoy</option>
            <option value="paymobi">Paymobi</option>
            <option value="crefaz">Crefaz</option>
            <option value="outra">Outra financiadora</option>
          </select>
        </div>
        <div class="form-group" *ngIf="ehFinanciada(troca.forma)">
          <label>Acréscimo para a financiadora</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="troca.acrescimo" name="acrescimoTroca" />
          <p class="hint">Sobe o valor do contrato até {{ dinheiro(teto(troca.precoSaida, acrescimoMaxPct)) }} ({{ acrescimoMaxPct }}%) para a financiadora calcular uma entrada menor.</p>
          <p class="campo-aviso" *ngIf="acrescimoEstoura(troca.precoSaida, troca.acrescimo)">O acréscimo passa do limite.</p>
        </div>
        <div class="form-group" *ngIf="troca.forma === 'outra'">
          <label>Nome da financiadora</label>
          <input [(ngModel)]="troca.financiadoraNome" name="nomeFinTroca" />
        </div>
        <div class="form-row" *ngIf="troca.forma === 'avista_cartao'">
          <div class="form-group">
            <label>À vista</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.entrada" name="avistaTroca" />
          </div>
          <div class="form-group">
            <label>No cartão</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.repasse" name="cartaoTroca" />
          </div>
        </div>
        <div class="form-row" *ngIf="ehFinanciada(troca.forma)">
          <div class="form-group">
            <label>Entrada na loja</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.entrada" name="entradaTroca" />
          </div>
          <div class="form-group" *ngIf="troca.forma !== 'paymobi'">
            <label>Repasse da financiadora</label>
            <input type="number" min="0" step="0.01" [(ngModel)]="troca.repasse" name="repasseTroca" />
          </div>
        </div>
        <div class="diferenca" *ngIf="(troca.forma === 'avista' || troca.forma === 'cartao') && diferencaTroca !== null">
          <ng-container *ngIf="diferencaTroca > 0">Cliente paga {{ dinheiro(diferencaTroca) }}. Esse valor é o faturamento da troca.<ng-container *ngIf="troca.forma === 'cartao'"> Entra no cartão.</ng-container></ng-container>
          <ng-container *ngIf="diferencaTroca < 0">A loja devolve {{ dinheiro(-diferencaTroca) }}. Não entra faturamento.</ng-container>
          <ng-container *ngIf="diferencaTroca === 0">Troca sem dinheiro. Nada entra no faturamento.</ng-container>
        </div>
        <div class="diferenca" *ngIf="troca.forma === 'avista_cartao' && diferencaTroca !== null">
          <ng-container *ngIf="diferencaTroca > 0">O cliente paga {{ dinheiro(diferencaTroca) }}. À vista e cartão precisam somar esse valor. Entra {{ dinheiro(caixaTroca) }}.</ng-container>
          <ng-container *ngIf="diferencaTroca <= 0">Nesta troca a loja não recebe. Use à vista.</ng-container>
        </div>
        <div class="diferenca" *ngIf="ehFinanciada(troca.forma)">
          Entra no caixa agora: {{ dinheiro(caixaTroca) }}.
          <ng-container *ngIf="diferencaTroca !== null && diferencaTroca < 0"> A loja ainda devolve {{ dinheiro(-diferencaTroca) }}.</ng-container>
          O saldo do cliente com a financiadora não entra no caixa.
        </div>
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
            <h4>Aparelho que entra<span *ngIf="entradasTroca.length > 1"> {{ i + 1 }}</span></h4>
            <button type="button" class="secundario" *ngIf="entradasTroca.length > 1" (click)="removerEntradaTroca(f)">Remover</button>
          </div>
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
              <input [ngModel]="f.dados.imei" (ngModelChange)="onImeiFicha($event, f)" [name]="'imeiTroca' + f.id" inputmode="numeric" />
              <span class="campo-aviso" *ngIf="alertaImeiDe(f) as alerta">{{ alerta }}</span>
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
            <div class="form-group">
              <label>Peça trocada</label>
              <input [(ngModel)]="f.dados.pecaTrocada" [name]="'pecaTrocadaTroca' + f.id" placeholder="Ex.: bateria, tela" />
            </div>
            <label class="check-label" *ngIf="f.dados.pecaTrocada.trim()">
              <input type="checkbox" [(ngModel)]="f.dados.mensagemPecaTrocada" [name]="'mensagemPecaTroca' + f.id" />
              Aparece mensagem
            </label>
          </div>
          <label class="check-label">
            <input type="checkbox" [(ngModel)]="f.dados.passaPorAssistencia" [name]="'assistenciaTroca' + f.id" />
            Este aparelho passa pela assistência antes de vender
          </label>
          <p class="hint" *ngIf="f.dados.passaPorAssistencia">Ele fica no estoque, mas não entra na venda nem na troca até a assistência liberar.</p>
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
          <div class="form-group">
            <label>Fotos e vídeos deste aparelho</label>
            <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm,video/*" multiple (change)="onMidiaFicha($event, f)" />
            <p class="hint">Até 12 fotos e 3 vídeos. Os vídeos entram com o áudio da gravação. Fotos até 8 MB, vídeos até 40 MB.</p>
            <p class="hint" *ngIf="textoMidiaDe(f) as texto">{{ texto }}. Sobe junto com o cadastro.</p>
            <button type="button" class="secundario" (click)="abrirQrFicha(f)">QR code — câmera do celular</button>
            <div class="qr-box" *ngIf="f.qrAberto">
              <p class="hint">Escaneie com o celular. Dá para tirar fotos ou gravar vídeos com áudio.</p>
              <img *ngIf="f.qrDataUrl" [src]="f.qrDataUrl" alt="QR code das fotos e vídeos" class="qr" />
              <p class="hint" *ngIf="f.fotosSessao.length">{{ textoMidiaRecebidaDe(f) }}</p>
            </div>
          </div>
        </div>
        <div class="acoes">
          <button type="button" class="secundario" (click)="adicionarEntradaTroca()">Adicionar outro aparelho</button>
        </div>
        <div class="acoes">
          <button type="submit" [disabled]="salvando">{{ salvando ? 'Salvando…' : 'Registrar troca' }}</button>
          <button type="button" class="secundario" (click)="cancelar()">Cancelar</button>
        </div>
      </form>

      <h3>Estoque</h3>
      <p class="hint" *ngIf="!carregando && estoque.length === 0">Nenhum celular no estoque da loja.</p>
      <div class="busca-estoque" *ngIf="estoque.length">
        <div class="form-group">
          <label>Marca</label>
          <select [ngModel]="buscaMarca" (ngModelChange)="onBuscaMarca($event)" name="buscaMarca">
            <option value="">Todas</option>
            <option *ngFor="let m of marcasBusca" [value]="m">{{ m }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Modelo</label>
          <input [(ngModel)]="buscaModelo" name="buscaModelo" placeholder="Digite o modelo" />
        </div>
        <div class="form-group">
          <label>Valor de</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="buscaValorDe" name="buscaValorDe" />
        </div>
        <div class="form-group">
          <label>Valor até</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="buscaValorAte" name="buscaValorAte" />
        </div>
        <div class="form-group">
          <label>Forma de pagamento</label>
          <select [(ngModel)]="buscaForma" name="buscaForma">
            <option value="">Todas</option>
            <option *ngFor="let f of formasBusca" [value]="f.id">{{ f.nome }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select [(ngModel)]="buscaEstado" name="buscaEstado">
            <option value="">Novo e usado</option>
            <option value="novo">Novo</option>
            <option value="usado">Usado</option>
          </select>
        </div>
      </div>
      <p class="hint" *ngIf="estoque.length && !estoqueFiltrado.length">Nenhum aparelho com esses filtros.</p>
      <ng-container *ngFor="let g of estoquePorMarca">
        <h3 class="marca-estoque">{{ g.marca }} <span *ngIf="g.disponiveis">{{ textoDisponiveis(g.disponiveis) }}</span></h3>
        <div class="grade-estoque">
        <article class="card-aparelho" *ngFor="let a of g.itens" [class.aberta]="fichaId === a.id" (click)="alternarFicha(a.id)">
          <img *ngIf="capaDe(a) as foto" class="capa" [src]="foto" alt="" />
          <div class="capa vazia" *ngIf="!capaDe(a)">Sem foto</div>
          <div class="corpo">
            <strong>{{ a.marca }} {{ a.modelo }}</strong>
            <div class="sub">{{ a.configuracao }}<span *ngIf="a.cor"> · {{ a.cor }}</span></div>
            <div class="sub">IMEI {{ a.imei }}</div>
            <dl>
              <div>
                <dt>Valor</dt>
                <dd>{{ a.valorVenda ? dinheiro(a.valorVenda) : '—' }}</dd>
              </div>
              <div *ngIf="a.valorMinimoVenda">
                <dt>Mínimo</dt>
                <dd>{{ dinheiro(a.valorMinimoVenda) }}</dd>
              </div>
              <div>
                <dt>Forma de pagamento</dt>
                <dd>{{ rotuloFormaAparelho(a) }}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{{ rotuloCondicao(a.condicao) }}</dd>
              </div>
            </dl>
            <div class="sub">
              {{ rotuloSituacao(a.status) }}
              <span *ngIf="a.osEntradaNumero"> · OS {{ a.osEntradaNumero }}</span>
            </div>
            <button
              *ngIf="a.status === 'em_assistencia'"
              type="button"
              class="secundario"
              (click)="$event.stopPropagation(); liberar(a)"
            >Liberar para venda</button>
            <p class="sub" *ngIf="financeiro">Peças {{ dinheiro(a.custoPecas) }} · mão de obra {{ dinheiro(a.custoMaoDeObra) }}</p>
          </div>
          <div class="ficha-card" *ngIf="fichaId === a.id" (click)="$event.stopPropagation()">
            <p *ngIf="a.observacoes">{{ a.observacoes }}</p>
            <p class="sub" *ngIf="a.saudeBateria != null">Bateria {{ a.saudeBateria }}%</p>
            <p class="sub" *ngIf="a.bateriaPerfeita === true">Bateria em perfeitas condições.</p>
            <p class="sub" *ngIf="a.bateriaPerfeita === false">Bateria fora das perfeitas condições.</p>
            <p class="sub" *ngIf="a.pecaTrocada">Peça trocada: {{ a.pecaTrocada }}<span *ngIf="a.mensagemPecaTrocada"> · aparece mensagem</span></p>
            <p class="sub" *ngIf="a.testesNaOs">Testes feitos na OS {{ a.osEntradaNumero || 'vinculada' }}.</p>
            <p class="sub" *ngIf="a.testes?.length">{{ testesResumo(a) }}</p>
            <p class="sub" *ngIf="financeiro && a.custosOs?.length">
              Ordens de serviço:
              <span *ngFor="let c of a.custosOs">
                {{ c.numero || ('OS ' + c.osId) }} — peças {{ dinheiro(c.pecas) }}, mão de obra {{ dinheiro(c.maoDeObra) }}
              </span>
            </p>
            <div class="fotos" *ngIf="a.fotos?.length">
              <div class="foto-escolha" *ngFor="let f of a.fotos" [class.marcada]="fotoMarcada(f)">
                <input type="checkbox" [checked]="fotoMarcada(f)" (change)="alternarFoto(f)" [attr.aria-label]="'Selecionar para o WhatsApp'" />
                <video *ngIf="ehVideo(f)" [src]="f.url" controls playsinline preload="metadata"></video>
                <img *ngIf="!ehVideo(f)" [src]="f.url" alt="Foto do aparelho" (click)="alternarFoto(f)" />
              </div>
            </div>
            <button
              type="button"
              class="secundario"
              *ngIf="a.fotos?.length"
              [disabled]="enviandoWhatsapp || !temFotoMarcada(a)"
              (click)="enviarWhatsapp(a)"
            >{{ enviandoWhatsapp ? 'Enviando…' : 'Enviar fotos selecionadas no WhatsApp' }}</button>
          </div>
        </article>
        </div>
      </ng-container>

      <h3 class="secao" *ngIf="financeiro && custosAssistencia.length">Custo de assistência por aparelho</h3>
      <p class="hint" *ngIf="financeiro && custosAssistencia.length">
        Quando o IMEI entra numa ordem de serviço, entra só o custo da peça.
        O valor cobrado do cliente não vira custo do aparelho.
      </p>
      <table class="data-grid" *ngIf="financeiro && custosAssistencia.length">
        <thead>
          <tr>
            <th>Aparelho</th>
            <th>IMEI</th>
            <th>Vendedor</th>
            <th>Peças</th>
            <th>Mão de obra</th>
            <th>Total</th>
            <th>Ordens</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of custosAssistencia">
            <td>{{ nomeAparelho(a) }}</td>
            <td>{{ a.imei }}</td>
            <td>{{ a.vendedorEntradaNome || '—' }}</td>
            <td>{{ dinheiro(a.custoPecas) }}</td>
            <td>{{ dinheiro(a.custoMaoDeObra) }}</td>
            <td>{{ dinheiro(custoOperacao(a)) }}</td>
            <td>{{ ordensDe(a) }}</td>
          </tr>
        </tbody>
      </table>

      <h3 class="secao" *ngIf="!financeiro">Movimento</h3>
      <h3 class="secao" *ngIf="financeiro">Dinheiro do movimento</h3>
      <p class="hint" *ngIf="!financeiro && isAdmin">
        O percentual do desconto na assistência continua em
        <a routerLink="/configuracoes/bling">Configurações → Bling</a>.
        Vendas antigas já importadas do Bling seguem valendo na consulta de desconto.
      </p>
      <table class="data-grid" *ngIf="operacoes.length">
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
              <div class="sub" *ngIf="!op.financiadoraNome && op.formaNegociacao && op.formaNegociacao !== 'avista'">{{ rotuloForma(op.formaNegociacao) }}</div>
            </td>
            <td>
              {{ op.clienteNome || op.fornecedorNome || '—' }}
              <div class="sub" *ngIf="op.clienteCpf">{{ formatarDoc(op.clienteCpf) }}</div>
            </td>
            <td>{{ op.entradaResumo || '—' }}</td>
            <td>{{ op.saidaResumo || '—' }}</td>
            <td *ngIf="financeiro">
              {{ dinheiro(op.dinheiroRecebido) }}
              <div class="sub" *ngIf="op.financiadoraNome">
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
              <span class="sub" *ngIf="op.status === 'estornada'">Desfeita</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <app-novo-cliente-modal
      *ngIf="modalCliente"
      (clienteCriado)="onClienteCriado($event)"
      (fecharModal)="modalCliente = false"
    />
  `,
  styles: [`
    .hint { color: #64748b; font-size: 13px; margin: 0 0 14px; max-width: 820px; line-height: 1.45; }
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
    .acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .acoes button.ativo { outline: 2px solid #0d0d0d; }
    .secundario { background: #fff; color: #0d0d0d; border: 1px solid #cbd5e1; }
    .secundario:hover { background: #f8fafc; color: #0d0d0d; }
    .painel {
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 0 0 22px;
      background: #fff; max-width: 920px;
    }
    .painel .form-row { flex-wrap: wrap; }
    .painel .form-row .form-group { flex: 1 1 160px; min-width: 160px; }
    .valores-venda .form-group { flex: 1 1 220px; max-width: 320px; }
    .iphone-ficha { max-width: 420px; }
    .painel h3, .painel h4 { margin: 0 0 8px; font-size: 15px; }
    .grow { flex: 1; min-width: 220px; }
    .diferenca {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 8px;
      background: #f0fdf4; border: 1px solid #86efac; color: #166534; font-size: 13px;
    }
    .prejuizo { color: #9a3412; font-size: 13px; margin: 6px 0 0; }
    .secao { margin-top: 28px; }
    .sub { color: #64748b; font-size: 11px; }
    tr.estornada { color: #94a3b8; }
    tr.clicavel { cursor: pointer; }
    tr.ficha td { background: #f8fafc; font-size: 13px; }
    select:disabled { opacity: 0.65; }
    .testes { display: flex; flex-wrap: wrap; gap: 8px 14px; }
    .testes label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .busca-estoque { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 14px; }
    .busca-estoque .form-group { min-width: 140px; }
    .marca-estoque { margin: 18px 0 8px; font-size: 16px; }
    .marca-estoque span { margin-left: 8px; color: #64748b; font-size: 13px; font-weight: 500; }
    .grade-estoque { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 8px; }
    .card-aparelho { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; cursor: pointer; }
    .card-aparelho.aberta { outline: 2px solid #0f172a; }
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
    .entrada-troca { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px 4px; margin: 0 0 12px; }
    .entrada-troca-topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .entrada-troca-topo h4 { margin: 0 0 10px; }
    .qr-box { margin-top: 10px; }
    .qr { width: 180px; height: 180px; background: #fff; border-radius: 8px; }
    h3 { font-size: 15px; margin: 8px 0 10px; }
  `],
})
export class AparelhosLojaPage implements OnInit, OnDestroy {
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
  compra = { valorPago: null as number | null, fornecedorNome: '' };
  venda = { aparelhoId: '', marca: '', modelo: '', cor: '', preco: null as number | null, desconto: null as number | null, acrescimo: null as number | null, observacoes: '', ...negociacaoVazia() };
  troca = { aparelhoSaidaId: '', marca: '', modelo: '', cor: '', precoSaida: null as number | null, desconto: null as number | null, acrescimo: null as number | null, ...negociacaoVazia() };
  jurosCfg = carregarCalculoJurosConfig();
  jurosVendaAberto = false;
  jurosTrocaAberto = false;
  opcaoJurosVenda: OpcaoParcela | null = null;
  opcaoJurosTroca: OpcaoParcela | null = null;
  fichaId: string | null = null;
  fotosMarcadas = new Set<string>();
  enviandoWhatsapp = false;
  financeiro = false;
  fotos: File[] = [];
  videos: File[] = [];
  testes = this.testesVazios();
  qrAberto = false;
  qrDataUrl = '';
  sessaoToken = '';
  fotosSessao: { id: string; url: string; tipo?: string }[] = [];
  osConsulta: OsAbertaConsulta | null = null;
  osBuscando = false;
  private buscaOs?: ReturnType<typeof setTimeout>;
  private pollFotos?: ReturnType<typeof setInterval>;

  constructor(
    private api: AparelhoLojaService,
    private aparelhos: AparelhosService,
    private route: ActivatedRoute,
    private router: Router,
    private appAuth: AppAuthService,
  ) {}

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
    const modelo = this.normalizar(this.buscaModelo);
    const de = this.numeroBusca(this.buscaValorDe);
    const ate = this.numeroBusca(this.buscaValorAte);
    return this.estoque.filter(a => {
      if (this.buscaMarca && !this.igual(a.marca, this.buscaMarca)) return false;
      if (modelo && !this.normalizar(`${a.modelo} ${a.configuracao} ${a.cor}`).includes(modelo)) return false;
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
    return this.opcoesDe('marca', () => true);
  }

  get modelosVenda(): string[] {
    return this.opcoesDe('modelo', a => this.igual(a.marca, this.venda.marca));
  }

  get coresVenda(): { cor: string; qtd: number }[] {
    return this.coresDe(a => this.igual(a.marca, this.venda.marca) && this.igual(a.modelo, this.venda.modelo));
  }

  get unidadesVenda(): AparelhoLojaItem[] {
    return this.unidadesDe(this.venda.marca, this.venda.modelo, this.venda.cor);
  }

  get aparelhoVendaSelecionado(): AparelhoLojaItem | null {
    return this.unidadeDaLista(this.venda.aparelhoId, this.unidadesVenda);
  }

  get aparelhoTrocaSelecionado(): AparelhoLojaItem | null {
    return this.unidadeDaLista(this.troca.aparelhoSaidaId, this.unidadesTroca);
  }

  get modelosTroca(): string[] {
    return this.opcoesDe('modelo', a => this.igual(a.marca, this.troca.marca));
  }

  get coresTroca(): { cor: string; qtd: number }[] {
    return this.coresDe(a => this.igual(a.marca, this.troca.marca) && this.igual(a.modelo, this.troca.modelo));
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

  get caixaVenda(): number {
    return this.caixaAgora(this.venda);
  }

  get caixaTroca(): number {
    return this.caixaAgora(this.troca);
  }

  ngOnInit(): void {
    this.financeiro = this.route.snapshot.data['financeiro'] === true;
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
    this.troca = { aparelhoSaidaId: '', marca: '', modelo: '', cor: '', precoSaida: null, desconto: null, acrescimo: null, ...negociacaoVazia() };
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
    if (a.pecaTrocada?.trim()) linhas.push(a.mensagemPecaTrocada ? `Peça trocada: ${a.pecaTrocada.trim()} · aparece mensagem` : `Peça trocada: ${a.pecaTrocada.trim()}`);
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

  abrirQr(): void {
    this.qrAberto = true;
    if (this.sessaoToken) {
      this.iniciarPoll();
      return;
    }
    this.api.criarSessaoFotos().subscribe({
      next: async sessao => {
        this.sessaoToken = sessao.token;
        this.qrDataUrl = await QRCode.toDataURL(sessao.url, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
        this.iniciarPoll();
      },
      error: (err: { error?: { erro?: string } }) => {
        this.qrAberto = false;
        avisarErroUsuario(err?.error?.erro || 'Não foi possível gerar o QR.');
      },
    });
  }

  cancelar(): void {
    this.modo = null;
    this.fecharQr();
  }

  onBuscaMarca(marca: string): void {
    this.buscaMarca = marca;
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
    const achada = this.formasBusca.find(f => f.id === (forma || ''));
    return achada?.nome || '—';
  }

  capaDe(a: AparelhoLojaItem): string {
    return (a.fotos ?? []).find(f => !this.ehVideo(f))?.url || '';
  }

  alternarFicha(id?: string): void {
    if (!id) return;
    this.fichaId = this.fichaId === id ? null : id;
    this.fotosMarcadas = new Set();
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

  custoOperacao(resumo: { custoPecas?: number; custoMaoDeObra?: number }): number {
    return (Number(resumo.custoPecas) || 0) + (Number(resumo.custoMaoDeObra) || 0);
  }

  ordensDe(a: AparelhoLojaItem): string {
    const lista = a.custosOs ?? [];
    if (!lista.length) return '—';
    return lista.map(c => c.numero || ('OS ' + c.osId)).join(', ');
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

  dinheiro(valor?: number | null): string {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    this.enviar(
      this.api.comprar({
        aparelho,
        valorPago: valor,
        clienteId: this.cliente?.id,
        fornecedorNome: this.compra.fornecedorNome.trim(),
        observacoes: this.entrada.observacoes,
        sessaoToken: this.sessaoToken || undefined,
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
    const rascunho = item ? this.rascunhoVenda(item, preco, this.venda) : null;
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
    const imeis = prontos.map(p => p.aparelho.imei);
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
    if (!this.validarNegociacao(this.troca, this.troca.forma === 'avista_cartao' ? this.diferencaTroca : null)) return;
    const complemento = prontos
      .map(p => `Aparelho dado na troca: ${p.aparelho.marca} ${p.aparelho.modelo} ${p.aparelho.configuracao}, IMEI ${p.aparelho.imei}, avaliado em R$ ${moedaContrato(p.avaliado)}. ${this.estadoDoAparelho(p.aparelho)}`)
      .join(' ');
    const rascunho = saida ? this.rascunhoVenda(saida, preco, this.troca, complemento) : null;
    const soma = prontos.reduce((total, p) => total + p.avaliado, 0);
    this.enviarComMidias(
      this.api.trocar({
        aparelhoSaidaId: this.troca.aparelhoSaidaId,
        precoSaida: preco,
        precoTabela: Number(this.troca.precoSaida),
        desconto: this.centavos(this.troca.desconto),
        acrescimo: this.ehFinanciada(this.troca.forma) ? this.centavos(this.troca.acrescimo) : 0,
        entradas: prontos.map(p => ({
          aparelho: p.aparelho,
          valorAvaliado: p.avaliado,
          sessaoToken: p.ficha.sessaoToken || undefined,
        })),
        valorAvaliado: Math.round(soma * 100) / 100,
        ...this.corpoNegociacao(this.troca),
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
      },
      enderecoChave: 'comprador_endereco',
      endereco: pessoa?.endereco,
      formaPagamento: negociacao.forma === 'cartao'
        ? 'Cartão de crédito'
        : negociacao.forma === 'avista_cartao'
          ? 'À vista + cartão'
          : negociacao.forma === 'avista' ? 'avista' : negociacao.forma,
      financiadoraNome: negociacao.forma === 'outra' ? negociacao.financiadoraNome.trim() : '',
      entrada: aVistaOuCartao ? '' : moedaContrato(entrada),
      repasse: aVistaOuCartao || !(repasse > 0) ? '' : moedaContrato(repasse),
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
    pecaTrocada?: string;
    mensagemPecaTrocada?: boolean;
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
    if (dados.pecaTrocada?.trim()) {
      partes.push(dados.mensagemPecaTrocada
        ? `peça trocada: ${dados.pecaTrocada.trim()}, aparece mensagem`
        : `peça trocada: ${dados.pecaTrocada.trim()}`);
    }
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
    if (apenasDigitos(ficha.dados.imei).length !== 15) {
      avisarErroUsuario(`O IMEI${qual} precisa ter 15 dígitos.`);
      return null;
    }
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
    const pecaTrocada = iphone ? ficha.dados.pecaTrocada.trim() : '';
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
      imei: ficha.dados.imei,
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
      saudeBateria: ficha.dados.saudeBateria,
      bateriaPerfeita: iphone ? ficha.dados.bateriaPerfeita === 'sim' : null,
      pecaTrocada,
      mensagemPecaTrocada: !!pecaTrocada && ficha.dados.mensagemPecaTrocada,
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
    if (apenasDigitos(this.entrada.imei).length !== 15) {
      avisarErroUsuario('O IMEI precisa ter 15 dígitos.');
      return null;
    }
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
    const pecaTrocada = this.ehIphone ? this.entrada.pecaTrocada.trim() : '';
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
      imei: this.entrada.imei,
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
      saudeBateria: this.entrada.saudeBateria,
      bateriaPerfeita: this.ehIphone ? this.entrada.bateriaPerfeita === 'sim' : null,
      pecaTrocada,
      mensagemPecaTrocada: !!pecaTrocada && this.entrada.mensagemPecaTrocada,
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
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível carregar o estoque de aparelhos.';
      },
    });
  }

  private concluir(painel: AparelhoLojaPainel, sucesso: string): void {
    this.painel = painel;
    this.salvando = false;
    this.modo = null;
    this.fotos = [];
    this.videos = [];
    this.fecharQr();
    avisarSucessoUsuario(sucesso);
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
        next: sessao => { if (this.sessaoToken === token) this.fotosSessao = sessao.fotos ?? []; },
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
    this.qrDataUrl = '';
    this.sessaoToken = '';
    this.fotosSessao = [];
    for (const ficha of this.entradasTroca) {
      ficha.qrAberto = false;
      ficha.qrDataUrl = '';
      ficha.sessaoToken = '';
      ficha.fotosSessao = [];
    }
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
      saudeBateria: null as number | null,
      bateriaPerfeita: '' as '' | 'sim' | 'nao',
      pecaTrocada: '',
      mensagemPecaTrocada: false,
      passaPorAssistencia: false,
      osNumero: '',
      valorVenda: null as number | null,
      valorMinimoVenda: null as number | null,
    };
  }
}
