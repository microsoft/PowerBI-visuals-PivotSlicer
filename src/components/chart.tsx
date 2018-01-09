import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IChartProps } from '../interfaces';
import { PivotSlicerChart } from './pivotslicerchart';

/**
 * React wrapper for PivotSlicerChart
 */
export class Chart {

  public constructor(private element: HTMLElement) {
  }

  public render(chartProps: IChartProps) {
    return ReactDOM.render(
      <PivotSlicerChart {...chartProps} />,
      this.element,
    );
  }
}
