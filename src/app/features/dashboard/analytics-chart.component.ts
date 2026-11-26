import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, ChartData, ChartOptions,
  DoughnutController, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip
} from 'chart.js';
import { AnalyticsChart } from '../../models/analytics';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController,
  Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

type ChartKind = AnalyticsChart['kind'];
const colors = ['#0d746a', '#223e61', '#3b607e', '#48a69a', '#845d31', '#537e93', '#636d93', '#386552', '#995b46', '#788532'];
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

@Component({
  selector: 'app-analytics-chart',
  templateUrl: './analytics-chart.component.html'
})
export class AnalyticsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data!: AnalyticsChart;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<ChartKind>;

  get hasData(): boolean {
    return !!this.data?.series.some(item => item.values.some(value => value > 0));
  }

  ngAfterViewInit(): void { this.render(); }
  ngOnChanges(): void { this.render(); }
  ngOnDestroy(): void { this.chart?.destroy(); }

  private render(): void {
    if (!this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }
    const context = this.canvas?.nativeElement.getContext('2d');
    if (!context) {
      return;
    }
    const { kind, currency } = this.data;
    const data: ChartData<ChartKind> = {
      labels: [...this.data.labels],
      datasets: this.data.series.map((item, index) => ({
        label: item.label, data: item.values.map(value => currency ? value / 100 : value),
        backgroundColor: kind === 'doughnut' ? colors : colors[index], borderColor: kind === 'doughnut' ? '#fff' : colors[index],
        borderWidth: kind === 'line' ? 2 : 1, tension: .22, pointRadius: this.data.labels.length > 14 ? 1 : 3
      }))
    };
    const options: ChartOptions<ChartKind> = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: kind === 'line' ? 'index' : 'nearest', intersect: kind !== 'line' },
      plugins: {
        legend: { display: kind === 'doughnut' || this.data.series.length > 1, position: 'bottom',
          labels: { color: '#23394c', boxWidth: 10, boxHeight: 10 } },
        tooltip: { callbacks: currency ? { label: item => item.dataset.label + ': ' + inr.format(Number(item.raw)) } : {} }
      },
      scales: kind === 'doughnut' ? undefined : {
        x: { ticks: { maxTicksLimit: 9, maxRotation: 0 } },
        y: { beginAtZero: true, ticks: currency ? { callback: value => inr.format(Number(value)) } : { precision: 0 } }
      }
    };
    if (this.chart && 'type' in this.chart.config && this.chart.config.type === kind) {
      this.chart.data = data;
      this.chart.options = options;
      this.chart.update('none');
      return;
    }
    this.chart?.destroy();
    this.chart = new Chart<ChartKind>(context, { type: kind, data, options });
  }
}
