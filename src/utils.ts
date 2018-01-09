import { INode, DataView, DataFormat } from './interfaces';
import { StyleConstants } from './styleconstants';

/**
 * Converts a hex representation of a color in the form #RRGGBB to hue (h), saturation (s), and
 * lightness (l) components in the ranges [0,1]
 */
export function convertHexColorToHSL(hex: string): { h: number, s: number, l: number } {
  // # optional followed by three case-insensitive pairs of 0-9, A-F
  const regex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
  const matches = regex.exec(hex);
  const r = parseInt(matches[1], 16) / 255;
  const g = parseInt(matches[2], 16) / 255;
  const b = parseInt(matches[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const t = min + max;
  const h = (d === 0) ? 0 : t / 2;
  const s = (d === 0) ? 0 : t / 2;
  const l = t / 2;
  if (d === 0) {
    return { h, s, l };
  }
  else {
    const s2 = (l > 0.5) ? d / (2 - t) : d / t;
    const h2 = (max === r)
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : (max === g)
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
    return { h: h2, s: s2, l };
  }
}

/**
 * Construct a pin color given a baseColor and lightness from settings.styling and the index of
 * pin in the pins list
 */
export function getPinColor(baseColor: string, saturation: number, lightness: number, step: number, index: number): string {
  const baseHue = Math.round(360 * convertHexColorToHSL(baseColor)['h']);
  const lev = Math.min(Math.max(20, lightness), 80) + '%';
  return `hsl(${(baseHue + (step * index)) % 360},${saturation}%,${lev})`;
}

/**
 * Construct a toggle pin gray from settings.styling.lightness
 */
export function getTogglePinGray(lightness: number): string {
  return `hsl(0,0%,${lightness}%)`;
}

/**
 * Ensures the input string val is defined, non-null, and non-empty
 */
export function isNonEmptyString(val: string): boolean {
  return val !== undefined && val !== null && val !== '';
}

/**
 * Adds a value to the values of a given Map key, adding the key to the Map if not present
 */
export function addSingleLink<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  if (!map.has(key)) {
    map.set(key, new Set<V>());
  }
  map.get(key).add(value);
}

/**
 * Adds a value to the values of a two nested Map keys, adding the keys to the Maps if either
 * is not present
 */
export function addDoubleLink<K1, K2, V>(map: Map<K1, Map<K2, Set<V>>>,
  firstKey: K1, secondKey: K2, value: V): void {
  if (!map.has(firstKey)) {
    map.set(firstKey, new Map<K2, Set<V>>());
  }
  if (!map.get(firstKey).has(secondKey)) {
    map.get(firstKey).set(secondKey, new Set<V>());
  }
  map.get(firstKey).get(secondKey).add(value);
}

/**
 * Sums a map of maps
 */
export function sumMapOfMaps(mapOfMaps: Map<string, Map<string, number>>): number {
  return Array.from(mapOfMaps.keys()).map(att => {
    return sumMap(mapOfMaps.get(att));
  }).reduce((pv, cv) => pv + cv, 0);
}

/**
 * Sums a map
 */
export function sumMap(map: Map<string, number>): number {
  const sum = (map !== undefined)
    ? Array.from(map.keys()).reduce((pv, cv) => pv + map.get(cv), 0)
    : 0;
  return sum;
}

/**
 * Intersects a set with the keys of mapped maps
 */
export function addKeysToSet(set: Set<string>, map: Map<string, Map<string, number>>): Set<string> {
  const ownLinks = Array.from(map.values()).map(x => Array.from(x.keys()))
    .reduce((pv2, cv2) => new Set<string>([...Array.from(pv2), ...cv2]),
      new Set<string>());
  return new Set<string>(Array.from(set).filter(
    x => ownLinks.has(x)));
}

/**
 * Creates a set from the keys of mapped maps
 */
export function mapOfMapsToL2Keys(toReduce: Map<string, Map<string, number>>): Set<string> {
  return Array.from(toReduce.values()).map(x => Array.from(x.keys()))
    .reduce((pv, cv) => new Set<string>([...Array.from(pv), ...cv]),
      new Set<string>());
}

/**
 * Creates a key by joining the elements of the input array
 */
export function createKey(arr: string[]): string {
  return arr.join('=#=#=');
}

/**
 * Splits a key back into its original array
 */
export function splitKey(arrStr: string): string[] {
  return arrStr.split('=#=#=');
}

/**
 * Creates a display label in the form '<item> [<item type>]'
 */
export function getDisplayLabel(nodeKey: string, chars: number) {
  const parts = splitKey(nodeKey);
  const ab = parts[0].substr(0, Math.min(chars, parts[0].length));
  return `${parts[1]} [${ab}]`;
}

/**
 * Tests for deep object equality on attribute values
 */
export function deepCompare(a, b) {
  if (a === null || b === null) {
    return false;
  }
  for (const x in a) {
    if (a.hasOwnProperty(x) !== b.hasOwnProperty(x)) {
      return false;
    }
    if (typeof (a[x]) === 'object') {
      if (!deepCompare(a[x], b[x])) {
        return false;
      }
    }
    else if (a[x] !== b[x]) {
      return false;
    }
  }
  for (const x in b) {
    if (typeof (a[x]) === 'undefined') {
      return false;
    }
  }
  return true;
}

/**
 * Whether the data view is showing co-occurrences
 */
export function isCountingCooccurrences(dataView: DataView): boolean {
  return (
    dataView === DataView.COOCCURRENCE
    || dataView === DataView.IN_COOCCURRENCE
    || dataView === DataView.OUT_COOCCURRENCE
  );
}

/**
 * Whether the data view is showing outbound links
 */
export function isOutboundLinks(dataView: DataView): boolean {
  return dataView === DataView.OUT_OCCURRENCE || dataView === DataView.OUT_COOCCURRENCE;
}

/**
 * Whether the data view is showing outbound links
 */
export function isInboundLinks(dataView: DataView): boolean {
  return dataView === DataView.IN_OCCURRENCE || dataView === DataView.IN_COOCCURRENCE;
}

/**
 * Whether the data view is showing implicit links
 */
export function isImplicitLinks(dataView: DataView): boolean {
  return dataView === DataView.OCCURRENCE || dataView === DataView.COOCCURRENCE;
}

/**
 * Whether the data view is showing attributes
 */
export function isAttribute(mode: DataView): boolean {
  return mode === DataView.RANKED_ATTRIBUTES ||
    mode === DataView.IMPLICIT_ATTRIBUTES ||
    mode === DataView.EXPLICIT_ATTRIBUTES;
}

/**
 * Returns the array of possible data views given the data format and attributes
 */
export function supportedDataViews(
  dataFormat: DataFormat,
  hasAttributes: boolean,
  allowPinning: boolean
): DataView[] {
  const supportedViews: DataView[] =
    (dataFormat === DataFormat.RANKED_LABELS || dataFormat === DataFormat.RANKED_VALUES)
      ? [DataView.ITEM_TYPES]
      : (dataFormat === DataFormat.IMPLICIT_LINKS)
        ? [DataView.OCCURRENCE]
        : (dataFormat === DataFormat.EXPLICIT_LINKS)
          ? [
            DataView.OUT_OCCURRENCE,
            DataView.IN_OCCURRENCE
          ]
          : [];
    if (allowPinning) {
      if (dataFormat === DataFormat.IMPLICIT_LINKS) {
        supportedViews.push(DataView.COOCCURRENCE);
      }
      else if (dataFormat === DataFormat.EXPLICIT_LINKS) {
        supportedViews.push(DataView.OUT_COOCCURRENCE);
        supportedViews.push(DataView.IN_COOCCURRENCE);
      }
    }
    if (hasAttributes) {
      if (dataFormat === DataFormat.EXPLICIT_LINKS) {
        supportedViews.push(DataView.EXPLICIT_ATTRIBUTES);
      }
      else if (dataFormat === DataFormat.IMPLICIT_LINKS) {
        supportedViews.push(DataView.IMPLICIT_ATTRIBUTES);
      }
      else {
        supportedViews.push(DataView.RANKED_ATTRIBUTES);
      }
    }
  return supportedViews;
}

/**
 * Returns the array of possible data views given the data format and attributes
 */
export function getDataViewOptions(
  dataFormat: DataFormat,
  hasAttributes: boolean,
  allowPinning: boolean
): string[] {
  let options: string[] = supportedDataViews(dataFormat, hasAttributes, allowPinning);
  if (hasAttributes) {
    // Filter out any extra "Attribute" data views and add a single Attribute option
    options = options.filter(n => n.indexOf("ATTRIBUTES") < 0);
    options.push(StyleConstants.ATTRIBUTES_LABEL);
  }
  return options;
}

/**
 * Custom JSON stringify function that correctly serializes ES6 Maps
 */
export function stringify(obj) {
  return (obj instanceof Map)
    ? JSON.stringify(serializeMap(obj), stringifyReplacer)
    : JSON.stringify(obj, stringifyReplacer);
}

/**
 * Custom replacer function to serialize ES6 Maps
 */
function stringifyReplacer(name, value) {
  return (value instanceof Map)
    ? serializeMap(value)
    : value;
}

/**
 * Serializes ES6 Map to JSON
 */
function serializeMap(map: Map<any, any>) {
  const obj = Object.create(null);
  for (const [k, v] of Array.from(map.entries())) {
    if (v instanceof Map) {
      obj[k.toString()] = serializeMap(v);
    } else {
      obj[k.toString()] = v;
    }
  }
  return obj;
}

/**
 * Taken from Essex-PowerBI-Base
 * Builds a filter column target for use with the AdvancedFilter API
 * @param source The column to create a filter target for
 */
export function buildColumnTarget(
  source: powerbi.DataViewMetadataColumn
): any {
  'use strict';
  if (source) {
    const categoryExpr: any =
      source && source.expr ? (source.expr as any) : null;

    // A lot of this code is based on timeline: https://github.com/Microsoft/powerbi-visuals-timeline/blob/master/src/visual.ts#L950-L958
    // but some extra checks have been added to catch edge cases.
    // I'm not sure when this case happens, but I believe it is an hierarchy, but I took this from PowerBI-visuals-timeline
    const argArg = categoryExpr && categoryExpr.arg && categoryExpr.arg.arg;

    // This gets the table name from the hierarchy
    const argEntity = argArg && argArg.entity;

    // This gets the column off of the hierarchy
    const argProp = argArg && argArg.property;

    const {
      // This one will differ from source.displayName when the user creates a "hierarchy"
      // and then drags one of the columns to the visual, but sometimes the arg from above is there too
      // who knows
      level,

      // This one will differ from source.displayName when the user renames the
      // column explicitly bound to a specific visual...NOT at the global level
      // just for each visual on their fields pane, they can rename the field there.
      ref
    } =
      categoryExpr || ({} as any);

    // The table off of the expression that represents the field
    const exprSourceEntity =
      categoryExpr && categoryExpr.source && categoryExpr.source.entity;

    // ?
    const queryName = source.queryName.substring(
      0,
      source.queryName.indexOf('.')
    );

    const table = argEntity || exprSourceEntity || queryName;
    const column = argProp || ref || level || source.displayName;

    // source.queryName contains wrong table name in case when table was renamed! source.expr.source.entity contains correct table name.
    // source.displayName contains wrong column name in case when Hierarchy mode of showing date was chosen
    return {
      table,
      column
    };
  }
}

/**
 * Calculates the DataView from the given format
 * @param format The data format
 * @param hasAttributes If we have attributes
 */
export function calculateViewFromFormat(format: DataFormat, hasAttributes: boolean) {
  if (format === DataFormat.RANKED_LABELS && hasAttributes) {
    return DataView.RANKED_ATTRIBUTES;
  } else if (format === DataFormat.RANKED_VALUES) {
    return DataView.RANKED_ATTRIBUTES;
  } else if (format === DataFormat.IMPLICIT_LINKS) {
    return DataView.COOCCURRENCE;
  } else if (format === DataFormat.EXPLICIT_LINKS) {
    return DataView.OUT_OCCURRENCE;
  } else {
    return DataView.ITEM_TYPES;
  }
}