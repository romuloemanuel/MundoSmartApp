import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BlingAuthService } from '../../../services/bling-auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  imports: [CommonModule],
  templateUrl: './callback.html',
  styles: `
    .auth-callback { max-width: 480px; margin: 48px auto; padding: 24px; text-align: center; }
    .erro { color: #b91c1c; }
    .hint { margin-top: 16px; font-size: 13px; color: #64748b; text-align: left; line-height: 1.45; }
    .acoes { margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    button {
      border: none; background: #2563eb; color: #fff; font-weight: 700;
      padding: 10px 16px; border-radius: 8px; cursor: pointer;
    }
  `,
})
export class Callback implements OnInit {
  mensagem = 'Autenticando com o Bling...';
  erro = false;
  detalhe = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: BlingAuthService,
  ) {}

  ngOnInit(): void {
    // Preferência: URL real do browser (evita perder ?code= em alguns reloads).
    const url = new URL(window.location.href);
    const code =
      url.searchParams.get('code')
      ?? this.route.snapshot.queryParamMap.get('code');
    const erroBling =
      url.searchParams.get('error')
      ?? this.route.snapshot.queryParamMap.get('error');
    const erroDesc =
      url.searchParams.get('error_description')
      ?? this.route.snapshot.queryParamMap.get('error_description');

    if (erroBling) {
      this.erro = true;
      this.mensagem = 'O Bling recusou a autorização.';
      this.detalhe = `${erroBling}${erroDesc ? `: ${decodeURIComponent(erroDesc)}` : ''}`;
      return;
    }

    if (!code) {
      this.erro = true;
      this.mensagem = 'Código de autorização não encontrado.';
      this.detalhe =
        'O Bling precisa redirecionar para exatamente http://localhost:4200/auth/callback?code=... ' +
        'No portal do app Bling, o «Link de redirecionamento» deve ser exatamente: ' +
        'http://localhost:4200/auth/callback (sem barra no final). ' +
        'Depois clique de novo em «Conectar Bling (capinhas)» — não abra /auth/callback manualmente.';
      return;
    }

    this.authService.exchangeCode(code).subscribe({
      next: () => {
        this.mensagem = 'Bling conectado! Redirecionando...';
        setTimeout(() => void this.router.navigate(['/consulta-produtos']), 800);
      },
      error: (err) => {
        this.erro = true;
        this.mensagem = 'Erro ao trocar o código por token no Bling.';
        this.detalhe =
          err?.error?.message
          || err?.error?.erro
          || err?.message
          || 'Verifique Client ID/Secret e o redirect URI no portal Bling.';
      },
    });
  }

  reconectar(): void {
    this.authService.getAuthorizationUrl().subscribe(({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    });
  }

  voltar(): void {
    void this.router.navigate(['/consulta-produtos']);
  }
}
