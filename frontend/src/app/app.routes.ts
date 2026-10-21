import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { Calendar } from './features/calendar/calendar';
import { Overview } from './features/overview/overview';
import { Projects } from './features/projects/projects';
import { Shell } from './layout/shell/shell';
import { Login } from './features/auth/login/login';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: Overview },
      { path: 'projects', component: Projects },
      { path: 'calendar', component: Calendar },
      { path: '**', redirectTo: 'overview' },
    ],
  },
];
