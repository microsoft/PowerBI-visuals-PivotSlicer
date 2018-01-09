import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;

/**
 * Wrapper for configuration options in capabilities.json
 */
export class VisualSettings extends DataViewObjectsParser {
  public general: GeneralSettings = new GeneralSettings();
  public configuration: StyleSettings = new StyleSettings();
}

// Defined in webpack
declare var BUILD_VERSION;

export class GeneralSettings {
  constructor() {
    // Makes it readonly
    Object.defineProperty(this, "version", {
      get: () => BUILD_VERSION,
      set: () => {},
      enumerable: true,
    });
  }
}

/**
 * Defaults for configuration options in capabilities.json
 */
export class StyleSettings {
  public enablePinning: boolean = true;
  public showRelated: boolean = true;
  public wrapText: boolean = false;
  public bookmarkColor: string = '#01B8AA';
  public barColor: string = '#CCCCCC';
  public sectionColor: string = '#EFEFEF';
  public backgroundColor: string = '#FFFFFF';
  public fontColor: string = '#111111';
  public fontSize: number = 9;
  public barSize: number = 40;
  public bookmarkLightness: number = 75;
  public topCount: number = 5;
  public maxCount: number = 100;
  public nodeTypeLabelLength: number = 10;
  public attributeWeightDelta: number = 0.25;
  public nodeType: string = '';
  public sectionOrder: string = 'Item Values';
}
