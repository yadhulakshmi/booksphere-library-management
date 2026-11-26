import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MemberProfileDialogComponent } from './member-profile-dialog.component';

@NgModule({
  declarations: [MemberProfileDialogComponent],
  imports: [CommonModule, MatButtonModule, MatDialogModule]
})
export class MemberProfileModule {}
