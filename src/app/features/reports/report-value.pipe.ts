import { Pipe, PipeTransform } from '@angular/core';
import { ReportFormat, ReportValue } from '../../models/report';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const count = new Intl.NumberFormat('en-IN');
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

@Pipe({ name: 'reportValue' })
export class ReportValuePipe implements PipeTransform {
  transform(value: ReportValue | undefined, format: ReportFormat = 'text'): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    switch (format) {
      case 'money': return money.format(Number(value) / 100);
      case 'count': return count.format(Number(value));
      case 'date': return day.format(new Date(value + 'T00:00:00Z'));
      default: return String(value);
    }
  }
}
