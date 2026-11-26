import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NAVIGATION } from './core/navigation';
import { ShellComponent } from './layout/shell/shell.component';
import { NotFoundComponent } from './shared/not-found.component';

const featureRoutes: Routes = [
  { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule) },
  { path: 'catalogue', loadChildren: () => import('./features/catalogue/catalogue.module').then(m => m.CatalogueModule) },
  { path: 'books', loadChildren: () => import('./features/books/books.module').then(m => m.BooksModule) },
  { path: 'members', loadChildren: () => import('./features/members/members.module').then(m => m.MembersModule) },
  { path: 'circulation', loadChildren: () => import('./features/circulation/circulation.module').then(m => m.CirculationModule) },
  { path: 'reservations', loadChildren: () => import('./features/reservations/reservations.module').then(m => m.ReservationsModule) },
  { path: 'overdue', loadChildren: () => import('./features/overdue/overdue.module').then(m => m.OverdueModule) },
  { path: 'reports', loadChildren: () => import('./features/reports/reports.module').then(m => m.ReportsModule) },
  { path: 'settings', loadChildren: () => import('./features/settings/settings.module').then(m => m.SettingsModule) }
];

const routes: Routes = [{
  path: '',
  component: ShellComponent,
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ...featureRoutes.map(route => ({
      ...route,
      data: { breadcrumb: NAVIGATION.find(item => item.path === route.path)?.label }
    })),
    { path: '**', component: NotFoundComponent, data: { breadcrumb: 'Page not found' } }
  ]
}];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
