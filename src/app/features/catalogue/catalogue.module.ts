import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { BookUiModule } from '../../shared/books/book-ui.module';
import { CataloguePageComponent } from './catalogue-page.component';

@NgModule({
  declarations: [CataloguePageComponent],
  imports: [CommonModule, SharedModule, BookUiModule, MatTooltipModule,
    RouterModule.forChild([{ path: '', component: CataloguePageComponent }])]
})
export class CatalogueModule {}
