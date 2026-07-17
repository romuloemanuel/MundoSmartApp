import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Layout exclusivo para fluxos mobile (QR do celular) — sem menu lateral nem topbar. */
@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: `<div class="mobile-shell"><router-outlet /></div>`,
  styles: [`
    /* html/body usam overflow:hidden; o scroll precisa ocorrer neste host. */
    :host {
      display: block;
      height: 100%;
      max-height: 100dvh;
      max-height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
      background: #0b1220;
    }
    .mobile-shell {
      min-height: 100%;
      background: #0b1220;
    }
  `],
})
export class MobileShell {}
