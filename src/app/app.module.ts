import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { LibraryApiErrorInterceptor } from './services/library-api-error.interceptor';
import { LibraryApiState } from './services/library-api-state.service';
import { LayoutModule } from './layout/layout.module';
import { CirculationCoordinator, initializeCirculation } from './services/circulation-coordinator.service';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, BrowserAnimationsModule, HttpClientModule, LayoutModule, AppRoutingModule],
  providers: [LibraryApiState,
    { provide: HTTP_INTERCEPTORS, useClass: LibraryApiErrorInterceptor, multi: true },
    { provide: APP_INITIALIZER, multi: true, useFactory: initializeCirculation, deps: [CirculationCoordinator] }],
  bootstrap: [AppComponent]
})
export class AppModule {}
