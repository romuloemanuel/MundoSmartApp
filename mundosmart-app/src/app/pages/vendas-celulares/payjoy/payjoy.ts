import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vendas-payjoy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Vendas Payjoy</h2>
      </div>
      <p class="hint">
        As vendas Payjoy da loja entram nesta tela. A lista ainda está em preparação.
      </p>
    </div>
  `,
  styles: [`
    .hint { color: #64748b; font-size: 13px; margin: 0; max-width: 640px; line-height: 1.45; }
  `],
})
export class VendasPayjoyPage {}
