export const environment = {
  environmentName: 'prd',
  production: true,
  apiUrl: '/api',
  filesUrl: '',
  /** Site público do QR de fotos. O domínio automático do painel não abre no celular. */
  intakeAppUrl: 'https://gestaosmart.mundosmartoficial.com.br',
  authEnabled: true,
  /**
   * IDs Bling do cadastro Mundo Smart em produção.
   * A linha roxa também identifica pelo nome "Mundo Smart".
   */
  contatoIdsLojaMundoSmart: [] as number[],
  estoque: {
    limiteLaranja: 3,
    limiteAmarelo: 5,
  },
  bling: {
    clientId: '',
    redirectUri: '',
    consultaProdutosHabilitada: false,
  },
};