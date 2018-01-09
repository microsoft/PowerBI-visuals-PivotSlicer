/// <reference path='../node_modules/powerbi-visuals-tools/templates/visuals/.api/v1.9.0/PowerBI-visuals.d.ts' />
/// <reference path='../node_modules/powerbi-visuals-utils-typeutils/lib/index.d.ts' />
/// <reference path='../node_modules/powerbi-visuals-utils-dataviewutils/lib/index.d.ts' />
/// <reference path='../node_modules/powerbi-models/dist/models-noexports.d.ts' />
import 'script-loader!powerbi-visuals-utils-typeutils/lib/index';
import 'script-loader!powerbi-visuals-utils-dataviewutils/lib/index';
import 'script-loader!powerbi-models/dist/models.min';

require('es6-set/implement');
require('es6-map/implement');
if (!Array.from) {
  console.log('installing Array.from shim');
  Array.from = require('array-from');
}
