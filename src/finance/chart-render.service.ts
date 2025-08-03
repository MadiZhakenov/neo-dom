// src\finance\chart-render.service.ts

import { Injectable } from '@nestjs/common';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

@Injectable()
export class ChartRenderService {
  private readonly width = 800;
  private readonly height = 400;
  private readonly chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: this.width,
    height: this.height,
    backgroundColour: 'white',
  });
  async renderBalanceChart(labels: string[], amounts: number[]): Promise<Buffer> {
    const configuration = {
      type: 'bar' as const,
      data: {
        labels,
        datasets: [
          {
            label: 'Баланс',
            data: amounts,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration, 'image/png');
  }
}
