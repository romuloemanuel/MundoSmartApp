import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorAlertModal } from './components/error-alert-modal/error-alert-modal';
import { ToastAlertComponent } from './components/toast-alert/toast-alert';
import { bindUserFeedback, UserFeedbackService } from './services/user-feedback.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ErrorAlertModal, ToastAlertComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    // Habilita avisarErroUsuario() em pages/modals sem inject em cada arquivo.
    bindUserFeedback(inject(UserFeedbackService));
  }
}
