import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthResponse, User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly tokenStorageKey = 'manageit_token';
  private readonly userStorageKey = 'manageit_user';

  private readonly currentUserSignal = signal<User | null>(this.readStoredUser());
  readonly currentUser = this.currentUserSignal.asReadonly();

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((response) => this.storeAuthResponse(response)));
  }

  fetchCurrentUser(): Observable<{ user: User }> {
    return this.http
      .get<{ user: User }>('/api/auth/me')
      .pipe(tap(({ user }) => this.storeUser(user)));
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  logout(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
    this.currentUserSignal.set(null);
  }

  private storeAuthResponse(response: AuthResponse): void {
    localStorage.setItem(this.tokenStorageKey, response.token);
    this.storeUser(response.user);
  }

  private storeUser(user: User): void {
    localStorage.setItem(this.userStorageKey, JSON.stringify(user));
    this.currentUserSignal.set(user);
  }

  private readStoredUser(): User | null {
    const value = localStorage.getItem(this.userStorageKey);
    if (!value) return null;
    try {
      const user: unknown = JSON.parse(value);
      if (
        typeof user === 'object' &&
        user !== null &&
        'id' in user &&
        typeof user.id === 'string' &&
        'name' in user &&
        typeof user.name === 'string' &&
        'email' in user &&
        typeof user.email === 'string'
      ) {
        return { id: user.id, name: user.name, email: user.email };
      }
      throw new Error('Stored user profile is invalid.');
    } catch (error: unknown) {
      console.error('Could not restore the saved ManageIt user profile:', error);
      localStorage.removeItem(this.userStorageKey);
      return null;
    }
  }
}
