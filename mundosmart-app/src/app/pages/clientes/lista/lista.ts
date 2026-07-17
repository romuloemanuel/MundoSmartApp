import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService } from '../../../services/clientes';
import { BlingContato } from '../../../models/bling.models';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginationState } from '../../../utils/grid-pagination.state';

@Component({
  selector: 'app-clientes-lista',
  imports: [CommonModule, FormsModule, GridPaginator, GridAcao],
  templateUrl: './lista.html',
  styles: ``,
})
export class ClientesLista implements OnInit {
  clientes: BlingContato[] = [];
  busca = '';
  carregando = false;
  erro = '';
  readonly grid = new GridPaginationState();

  constructor(private service: ClientesService, private router: Router) {}

  ngOnInit(): void {
    this.carregar();
  }

  get clientesPaginados(): BlingContato[] {
    return this.grid.paginate(this.clientes);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listar(this.busca || undefined).subscribe({
      next: (dados) => {
        this.clientes = dados;
        this.grid.reset();
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar clientes.';
        this.carregando = false;
      },
    });
  }

  novo(): void {
    this.router.navigate(['/clientes/novo']);
  }

  editar(id: number): void {
    this.router.navigate(['/clientes', id]);
  }
}
