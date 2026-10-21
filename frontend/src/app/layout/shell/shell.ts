import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  RouterLink,
  RouterOutlet,
  Router,
} from '@angular/router';
import { Auth } from '../../core/services/auth';

type NavigationTab = 'overview' | 'projects' | 'calendar';

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly activeTab = signal<NavigationTab>(this.initialTab());

  navigateTo(event: MouseEvent, tab: NavigationTab): void {
    event.preventDefault();
    this.activeTab.set(tab);
    void this.router.navigate(['/projects'], { fragment: tab });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  private initialTab(): NavigationTab {
    const fragment = this.router.parseUrl(this.router.url).fragment;
    return fragment === 'projects' || fragment === 'calendar'
      ? fragment
      : 'overview';
  }
}
