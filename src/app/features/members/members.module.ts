import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MemberActionDialogComponent } from './member-action-dialog.component';
import { MemberEditorDialogComponent } from './member-editor-dialog.component';
import { MemberProfileModule } from './member-profile.module';
import { MembersPageComponent } from './members-page.component';

@NgModule({
  declarations: [MembersPageComponent, MemberEditorDialogComponent, MemberActionDialogComponent],
  imports: [
    CommonModule, SharedModule, MemberProfileModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatMenuModule, MatPaginatorModule, MatSelectModule, MatSnackBarModule, MatSortModule,
    MatTableModule, MatTooltipModule, RouterModule.forChild([{ path: '', component: MembersPageComponent }])
  ]
})
export class MembersModule {}
