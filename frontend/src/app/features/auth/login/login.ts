import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  email = '';
  password = '';

  submit(): void {
    if (!this.email.trim() || !this.password) {
      this.errorMessage.set('Enter your email and password.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        void this.router.navigateByUrl('/overview');
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.apiError(error));
      },
    });
  }

  private apiError(error: unknown): string {
    if (
      error instanceof HttpErrorResponse &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'error' in error.error &&
      typeof error.error.error === 'string'
    ) {
      return error.error.error;
    }
    return 'Could not sign in. Check that the ManageIt API and account database are available.';
  }
}
