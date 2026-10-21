import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
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
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', component: Projects },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
