import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BlingAuthService } from '../../../services/bling-auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  imports: [CommonModule],
  templateUrl: './callback.html',
  styles: ``,
})
export class Callback implements OnInit {
  mensagem = 'Autenticando com o Bling...';
  erro = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: BlingAuthService
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.mensagem = 'Código de autorização não encontrado.';
      this.erro = true;
      return;
    }

    this.authService.exchangeCode(code).subscribe({
      next: () => {
        this.mensagem = 'Autenticado com sucesso! Redirecionando...';
        setTimeout(() => this.router.navigate(['/ordens-servico']), 1500);
      },
      error: () => {
        this.mensagem = 'Erro ao autenticar com o Bling. Tente novamente.';
        this.erro = true;
      },
    });
  }
}
