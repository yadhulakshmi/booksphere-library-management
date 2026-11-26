import { LayoutModule as CdkLayoutModule } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { DataStatusComponent } from './data-status.component';
import { ShellComponent } from './shell/shell.component';

@NgModule({
  declarations: [ShellComponent, DataStatusComponent],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    CdkLayoutModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatMenuModule,
    MatSidenavModule,
    SharedModule
  ]
})
export class LayoutModule {}
