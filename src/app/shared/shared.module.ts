import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { NotFoundComponent } from './not-found.component';
import { PageHeadingComponent } from './page-heading.component';

@NgModule({
  declarations: [PageHeadingComponent, NotFoundComponent],
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  exports: [PageHeadingComponent, NotFoundComponent, MatIconModule]
})
export class SharedModule {}
