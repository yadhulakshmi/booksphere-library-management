import { Injectable } from '@angular/core';
import { NAVIGATION } from '../core/navigation';
import { NavigationItem } from '../models/navigation-item';

@Injectable({ providedIn: 'root' })
export class NavigationSearchService {
  findPages(query: string): readonly NavigationItem[] {
    const words = query.toLowerCase().trim().split(/\s+/);
    return NAVIGATION.filter(item => words.every(word =>
      item.label.toLowerCase().includes(word) || item.path.includes(word)
    ));
  }
}
