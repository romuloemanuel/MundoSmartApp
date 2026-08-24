export const environment = {
  production: false,
  /** Relativo — usa proxy do ng serve (funciona em localhost e IP da rede) */
  apiUrl: '/api',
  /** Vazio = mesma origem; proxy encaminha /uploads para a API */
  filesUrl: '',
  /**
   * URL do app na rede local para QR de intake (só desenvolvimento; campo editável na UI).
   * Em produção use a variável de ambiente da API: Intake__AppBaseUrl.
   */
  intakeAppUrl: 'http://192.168.0.35:4200',
  /** Autenticação ligada (modo produção local — parear com Auth:Enabled=true na API). */
  authEnabled: true,
  /** Limites de nível de estoque (sincronizado com appsettings Estoque__* na API) */
  estoque: {
    limiteLaranja: 3,
    limiteAmarelo: 5,
  },
  /**
   * Prefill da tela Configurações → Bling (só ng serve / environment.ts).
   * Sem Client Secret — o secret fica em appsettings.Development.json (gitignored).
   */
  bling: {
    clientId: '728c66cc1011016019658641be6bc663fda8c446',
    redirectUri: 'http://localhost:4200/auth/callback',
    consultaProdutosHabilitada: true,
  },
};