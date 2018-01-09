// PowerBI Imports
import 'script-loader!powerbi-visuals-utils-typeutils/lib/index';
import 'script-loader!powerbi-visuals-utils-dataviewutils/lib/index';
import 'script-loader!powerbi-visuals-utils-interactivityutils/lib/index';
import 'script-loader!powerbi-models/dist/models.min';

// Shims
require('es6-set/implement');
require('es6-map/implement');
if (!Array.from) {
  Array.from = require('array-from');
}

// Imports
import DataView = powerbi.DataView;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataViewObjects =  powerbi.extensibility.utils.dataview.DataViewObjects;
import { VisualSettings } from './settings';
import { ChartProps } from './ChartProps';
import { Chart } from './components/chart';
import { IChartState } from './interfaces';
import { FilterManager } from './filtermanager';

/**
 * The identifier for where the pinned property is within PBI objects
 */
const STATE_PROPERTY_IDENTIFIER = {
  objectName: 'general',
  propertyName: 'state'
};

/**
 * Power BI wrapper for PivotSlicerChart
 */
export class Visual implements IVisual {
  private host: IVisualHost;
  private target: HTMLElement;
  private chartProps: ChartProps;
  private chart: Chart;
  private settings: VisualSettings;
  private filterManager: FilterManager;
  private dataView: powerbi.DataView;

  public constructor(options: VisualConstructorOptions) {
    console.log('create pivot slicer');
    try {
      this.host = options.host;
      this.target = options.element;
      this.filterManager = new FilterManager(this.host);
      this.chartProps = new ChartProps(
        this.host,
        VisualSettings.getDefault() as VisualSettings,
        this.onStateChanged.bind(this),
      );
      this.chart = new Chart(this.target);
      this.chart.render(this.chartProps);
    }
    catch (err) {
      console.log(`Error@PivotSlicer::ctor`, err);
    }
  }

  public update(options: powerbi.extensibility.visual.VisualUpdateOptions) {
    try {
      this.settings = Visual.parseSettings(
        options && options.dataViews && options.dataViews[0]
      );
      if (options.type !== powerbi.VisualUpdateType.Resize) {
        const dataView = options.dataViews[0];
        const objects = dataView.metadata && dataView.metadata.objects;
        const rawState = DataViewObjects.getValue(objects, STATE_PROPERTY_IDENTIFIER, "");
        const state = rawState ? JSON.parse(rawState) : {} as IChartState;

        if (dataView && dataView.categorical) {
          this.dataView = dataView;
          this.chartProps.loadDataView(dataView, this.host, this.settings, state);
        }
        this.chart.render(this.chartProps);
      }
      this.filterManager.applyPendingSelections();
    }
    catch (e) {
      console.log('Error@PivotSlicer::update', e);
    }
  }

  private onStateChanged(state: IChartState) {
    setTimeout(() => {
      this.host.persistProperties({
        merge: [{
          objectName: STATE_PROPERTY_IDENTIFIER.objectName,
          selector: undefined,
          properties: {
            state: JSON.stringify(state),
          }
        }]
      });

      this.filterManager.applySelectionsFromState(
        this.dataView.categorical.categories.map(n => n.source),
        state,
        this.chartProps.chartData);
    }, 10);
  }

  private static parseSettings(dataView: DataView): VisualSettings {
    try {
      return VisualSettings.parse(dataView) as VisualSettings;
    }
    catch (e) {
      console.log('Error@PivotSlicer::parseSettings', e);
    }
  }

  public enumerateObjectInstances(
    options: EnumerateVisualObjectInstancesOptions
  ): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
    try {
      return VisualSettings.enumerateObjectInstances(
        this.settings || VisualSettings.getDefault(),
        options
      );
    }
    catch (e) {
      console.log('Error@PivotSlicer::enumerateObjectInstances', e);
    }
  }
}