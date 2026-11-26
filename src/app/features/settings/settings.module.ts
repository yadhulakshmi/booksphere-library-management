import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { SettingsPageComponent } from './settings-page.component';

@NgModule({
  declarations: [SettingsPageComponent],
  imports: [CommonModule, SharedModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSnackBarModule, RouterModule.forChild([{ path: '', component: SettingsPageComponent }])]
})
export class SettingsModule {}
