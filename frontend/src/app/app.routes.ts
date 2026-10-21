import { Routes } from '@angular/router';
import { Projects } from './features/projects/projects';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', component: Projects },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
