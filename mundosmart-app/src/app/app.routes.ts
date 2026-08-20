import { Routes } from '@angular/router';
import { AppShell } from './layouts/app-shell/app-shell';
import { MobileShell } from './layouts/mobile-shell/mobile-shell';
import { Callback } from './pages/auth/callback/callback';
import { ClientesLista } from './pages/clientes/lista/lista';
import { ClientesForm } from './pages/clientes/form/form';
import { OrdensServicoLista } from './pages/ordens-servico/lista/lista';
import { OrdensServicoForm } from './pages/ordens-servico/form/form';
import { OrcamentosLista } from './pages/orcamentos/lista/lista';
import { OrcamentosForm } from './pages/orcamentos/form/form';
import { ModelosLista } from './pages/modelos/lista/lista';
import { ModelosForm } from './pages/modelos/form/form';
import { TecnicosLista } from './pages/tecnicos/lista/lista';
import { PecasLista } from './pages/pecas/lista/lista';
import { PecasForm } from './pages/pecas/form/form';
import { OsIntakeMobile } from './pages/ordens-servico/intake/intake';
import { OsHistoricoPage } from './pages/ordens-servico/historico/historico';
import { HistoricoAlteracoesPage } from './pages/historico-alteracoes/historico-alteracoes';
import { EstoquePage } from './pages/estoque/estoque';
import { LotesRetornoPage } from './pages/estoque/lotes-retorno/lotes-retorno';
import { AnaliseRetornoPage } from './pages/estoque/analise-retorno/analise-retorno';
import { LotesVencendoPage } from './pages/estoque/lotes-vencendo/lotes-vencendo';
import { ComissoesPage } from './pages/comissoes/comissoes';
import { LoginPage } from './pages/login/login';
import { AlterarSenhaPage } from './pages/conta/alterar-senha';
import { UsuariosLista } from './pages/usuarios/lista';
import { CategoriasPecaLista } from './pages/categorias-peca/lista/lista';
import { adminGuard, authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginPage,
  },
  {
    path: 'intake',
    component: MobileShell,
    children: [
      { path: ':token', component: OsIntakeMobile },
    ],
  },
  {
    path: 'painel-tv',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/ordens-servico/painel-tv/painel-tv').then(m => m.OrdensServicoPainelTv),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'ordens-servico', pathMatch: 'full' },
      { path: 'auth/callback', component: Callback },
      { path: 'conta/senha', component: AlterarSenhaPage },
      { path: 'usuarios', canActivate: [adminGuard], component: UsuariosLista },
      { path: 'clientes', component: ClientesLista },
      { path: 'clientes/novo', component: ClientesForm },
      { path: 'clientes/:id', component: ClientesForm },
      { path: 'modelos', component: ModelosLista },
      { path: 'modelos/novo', component: ModelosForm },
      { path: 'modelos/:id', component: ModelosForm },
      { path: 'tecnicos', canActivate: [adminGuard], component: TecnicosLista },
      { path: 'pecas', component: PecasLista },
      { path: 'pecas/novo', component: PecasForm },
      { path: 'pecas/:id', component: PecasForm },
      { path: 'categorias-peca', component: CategoriasPecaLista },
      /**
       * Rotas de OS aninhadas: evita que `ordens-servico` (prefix) ou `:id`
       * capturem `de-orcamento` / `nova`.
       */
      {
        path: 'ordens-servico',
        children: [
          { path: '', pathMatch: 'full', component: OrdensServicoLista },
          { path: 'nova', component: OrdensServicoForm },
          {
            path: 'de-orcamento/:orcamentoId',
            component: OrdensServicoForm,
            data: { deOrcamento: true },
          },
          { path: ':id/historico', component: OsHistoricoPage },
          { path: ':id/editar', component: OrdensServicoForm, data: { somenteLeitura: false } },
          { path: ':id', component: OrdensServicoForm, data: { somenteLeitura: true } },
        ],
      },
      { path: 'historico-alteracoes', canActivate: [adminGuard], component: HistoricoAlteracoesPage },
      { path: 'comissoes', canActivate: [adminGuard], component: ComissoesPage },
      { path: 'orcamentos', component: OrcamentosLista },
      { path: 'orcamentos/novo', component: OrcamentosForm },
      { path: 'orcamentos/:id', component: OrcamentosForm },
      {
        path: 'consulta-produtos',
        loadComponent: () =>
          import('./pages/consulta-produtos/consulta-produtos').then(m => m.ConsultaProdutosPage),
      },
      {
        path: 'calculo-juros',
        loadComponent: () =>
          import('./pages/calculo-juros/calculo-juros').then(m => m.CalculoJurosPage),
      },
      { path: 'estoque', component: EstoquePage },
      { path: 'estoque/lotes-retorno', component: LotesRetornoPage },
      { path: 'estoque/analise-retorno', component: AnaliseRetornoPage },
      { path: 'estoque/lotes-vencendo', component: LotesVencendoPage },
      {
        path: 'configuracoes/impressao-os',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/configuracoes/impressao-os/impressao-os').then(m => m.ConfigImpressaoOsPage),
      },
      {
        path: 'configuracoes/acrescimo-estoque',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/configuracoes/acrescimo-estoque/acrescimo-estoque').then(m => m.ConfigAcrescimoEstoquePage),
      },
    ],
  },
];
