import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-heading',
  template: `
    <header class="page-heading">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>
  `
})
export class PageHeadingComponent {
  @Input() title = '';
  @Input() description = '';
}
