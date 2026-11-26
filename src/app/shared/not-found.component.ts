import { Component } from '@angular/core';

@Component({
  selector: 'app-not-found',
  template: `
    <app-page-heading title="Page not found"
      description="The address may be incomplete or the page may have moved."></app-page-heading>
    <section class="surface empty-state">
      <span class="feature-icon"><mat-icon>explore_off</mat-icon></span>
      <h2>Find your way back</h2>
      <a mat-flat-button color="primary" routerLink="/dashboard">Go to Dashboard</a>
    </section>
  `
})
export class NotFoundComponent {}
