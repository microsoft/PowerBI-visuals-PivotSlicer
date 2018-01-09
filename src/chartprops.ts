import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import { PivotSlicerChart } from './components/pivotslicerchart';
import {
  IChartProps,
  IChartData,
  INode,
  DataFormat,
  IChartState
} from './interfaces';
import { VisualSettings } from './settings';
import {
  isNonEmptyString,
  createKey,
  addDoubleLink,
  addSingleLink,
  splitKey,
  supportedDataViews,
} from './utils';
import { StyleConstants } from './styleconstants';

/**
 * React props for PivotSlicerChart constructed from a powerbi dataview
 */
export class ChartProps implements IChartProps {

  // Public members

  /**
   * The chart data constuctured from the powerbi dataview
   */
  public chartData: IChartData;

  /**
   * Whether required columns are bound
   */
  public loaded: boolean;

  /**
   * The current chart state
   */
  public state: IChartState;

  /**
   * Whether the state needs refreshing due to data rebinding
   */
  public needsStateRefresh: boolean;

  /**
   * Constructor
   */
  public constructor(
    public host: IVisualHost,
    public settings: VisualSettings,
    public onStateChanged: (state: IChartState) => any
  ) {
    this.loaded = false;
    this.chartData = {
      dataFormat: DataFormat.UNKNOWN,
      attributeSequence: [],
      keyToNode: new Map<string, INode>(),
      nodeTypeToNodes: new Map<string, Set<INode>>(),
      objectToNodeTypesToSelections:
        new Map<string, Map<string, Set<ISelectionId>>>(),
      columns: new Map<string, number>()
    };
  }

  /**
   * Converts a dataview into chart data
   */
  public loadDataView(
    dataView: powerbi.DataView,
    host: IVisualHost,
    settings: VisualSettings,
    state: IChartState,
  ): void {
    this.settings = settings;
    this.chartData = {
      dataFormat: DataFormat.UNKNOWN,
      attributeSequence: [],
      keyToNode: new Map<string, INode>(),
      nodeTypeToNodes: new Map<string, Set<INode>>(),
      objectToNodeTypesToSelections:
        new Map<string, Map<string, Set<ISelectionId>>>(),
        columns: new Map<string, number>()
    };
    const { enablePinning } = settings.configuration;
    const selectionIds: ISelectionId[] =
      this.createSelectionIds(dataView, host);
    // Get names of bound columns
    const cols = dataView.categorical.categories.map(n => n.source);
    const nodeCol = this.getColumnIndex(cols, 'NODE');
    this.chartData.columns.set('NODE', nodeCol);
    const nodeTypeCol = this.getColumnIndex(cols, 'NODE_TYPE');
    this.chartData.columns.set('NODE_TYPE', nodeTypeCol);
    const objectCol = this.getColumnIndex(cols, 'NODE_LINKER');
    this.chartData.columns.set('NODE_LINKER', objectCol);
    const linkedNodeCol = this.getColumnIndex(cols, 'LINKED_NODE');
    this.chartData.columns.set('LINKED_NODE', linkedNodeCol);
    const linkedNodeTypeCol = this.getColumnIndex(cols, 'LINKED_NODE_TYPE');
    this.chartData.columns.set('LINKED_NODE_TYPE', linkedNodeTypeCol);
    const weightCol = this.getColumnIndex(cols, 'LINK_WEIGHT');
    this.chartData.columns.set('LINK_WEIGHT', weightCol);
    const filterCol = this.getColumnIndex(cols, 'FILTER_KEY');
    this.chartData.columns.set('FILTER_KEY', filterCol);
    const linkedFilterCol = this.getColumnIndex(cols, 'LINKED_FILTER_KEY');
    this.chartData.columns.set('LINKED_FILTER_KEY', linkedFilterCol);
    const attributeCols = this.getColumnIndexMap(cols, 'NODE_ATTRIBUTES');
    this.chartData.attributeSequence = this.getColumnNameSequence(cols, 'NODE_ATTRIBUTES');
    this.chartData.attributeSequence.sort();
    const rankedLabelsMet = nodeCol !== -1;
    const rankedValuesMet = attributeCols.size > 0;
    const implicitLinksMet = objectCol !== -1;
    const explicitLinksMet = linkedNodeCol !== -1;
    if (rankedLabelsMet && implicitLinksMet && !explicitLinksMet) {
      this.loaded = true;
      this.chartData.dataFormat = DataFormat.IMPLICIT_LINKS;
      this.loadDataInImplicitLinksMode(
        dataView, selectionIds, nodeTypeCol, nodeCol, objectCol, filterCol, attributeCols);
    }
    else if (rankedLabelsMet && explicitLinksMet && !implicitLinksMet) {
      this.loaded = true;
      this.chartData.dataFormat = DataFormat.EXPLICIT_LINKS;
      this.loadDataInExplicitLinksMode(dataView, selectionIds, nodeTypeCol, nodeCol,
        linkedNodeTypeCol, linkedNodeCol, weightCol, filterCol, attributeCols);
    }
    else if (rankedLabelsMet) {
      this.loaded = true;
      this.chartData.dataFormat = (rankedValuesMet)
        ? DataFormat.RANKED_VALUES
        : DataFormat.RANKED_LABELS;
      this.loadDataInRankedListsMode(dataView, selectionIds, nodeTypeCol, nodeCol, filterCol,
        attributeCols);
    }
    else {
      this.loaded = false;
    }

    const supported = supportedDataViews(
      this.chartData.dataFormat,
      attributeCols.size > 0,
      enablePinning
    );

    this.needsStateRefresh = false;

    // If the view that is trying to be loaded isn't supported, then refresh the state
    if (state as any !== {} && supported.length > 0 && !supported.includes(state.view)) {
      this.needsStateRefresh = true;
      state.view = supported[0];
    }

    this.state = state;
  }

  // Private helper methods

  /**
   * Create links between nodes based on connections to common objects
   */
  private loadDataInImplicitLinksMode(
    dataView: powerbi.DataView,
    selectionIds: ISelectionId[],
    nodeTypeCol: number,
    nodeCol: number,
    objectCol: number,
    filterCol: number,
    attributeCols: Map<string, number>
  ): void {
    const keysToSelectionIds =
      new Map<string, Set<ISelectionId>>();
    const objectsToKeys = new Map<string, Set<string>>();
    const nodesToTypes = new Map<string, Set<string>>();
    const keysToFilterKeys = new Map<string, string>();
    const cats = dataView.categorical.categories;
    // Iterate over rows to build up links between attributes, linking objects, and
    // selection ids
    cats[0].values.forEach((val, index) => {
      const row = cats.map(n => n.values[index]);
      const nodeName = this.getStringValue(row, nodeCol, '');
      const object = this.getStringValue(row, objectCol, '');
      if (nodeName !== '' && object !== '') {
        const nodeType = this.getStringValue(
          row, nodeTypeCol, StyleConstants.DEFAULT_TYPE_LABEL);
        const selectionId = selectionIds[index];
        const filterKey = this.getStringValue(row, filterCol, '');
        const nodeKey = createKey([nodeType, nodeName]);
        addDoubleLink(
          this.chartData.objectToNodeTypesToSelections, object, nodeKey, selectionId);
        addSingleLink(keysToSelectionIds, nodeKey, selectionId);
        addSingleLink(objectsToKeys, object, nodeKey);
        addSingleLink(nodesToTypes, nodeName, nodeType);
        keysToFilterKeys.set(nodeKey, filterKey);
        const node = filterKey !== ''
          ? this.createOrUpdateNode(nodeKey, nodeType, nodeName, filterKey,
              keysToSelectionIds.get(nodeKey)
            )
          : this.createOrUpdateNode(nodeKey, nodeType, nodeName, '',
              keysToSelectionIds.get(nodeKey)
            );
        node.linkingObjects.add(object);
        this.addAttributes(this.chartData.keyToNode.get(nodeKey), row, attributeCols);
      }
    });
    // Add links between all attributes applied to the same linking objects
    if (this.settings.configuration.showRelated) {
      Array.from(objectsToKeys.keys()).forEach(object => {
        const keys = objectsToKeys.get(object);
        keys.forEach(key1 => {
          keys.forEach(key2 => {
            if (key1 !== key2) {
              const selectionIds = keysToSelectionIds.get(key1);
              this.createImplicitLink(key1, key2, object, selectionIds, keysToFilterKeys.get(key1));
            }
          });
        });
      });
    }
    // Create node families from nodes with same value but different categories
    Array.from(nodesToTypes.keys()).forEach(value => {
      const cats = nodesToTypes.get(value);
      const nodeList = Array.from(cats).map(cat => {
        const key = createKey([cat, value]);
        if (this.chartData.keyToNode.has(key)) {
          return this.chartData.keyToNode.get(key);
        }
        return null;
      }).filter(x => x !== null).sort((a, b) => {
        const d = b.linkingObjects.size - a.linkingObjects.size;
        if (d === 0) {
          return (a.nodeName < b.nodeName) ? -1 : 1;
        }
        return d;
      });
      nodeList.forEach(node => {
        node.nodeFamily = nodeList;
      });
    });
  }

  /**
   * Create links between nodes based on explicit specification of source and target nodes
   */
  private loadDataInExplicitLinksMode(
    dataView: powerbi.DataView,
    selectionIds: ISelectionId[],
    nodeTypeCol: number,
    nodeCol: number,
    linkedNodeTypeCol: number,
    linkedNodeCol: number,
    weightCol: number,
    filterCol: number,
    attributeCols: Map<string, number>
  ): void {
    const keysToSelectionIds =
      new Map<string, Set<ISelectionId>>();
    const nodesToTypes = new Map<string, Set<string>>();
    const cats = dataView.categorical.categories;
    // Iterate over rows to build up links between attributes, linking objects, and
    // selection ids
    cats[0].values.forEach((val, index) => {
      const row = cats.map(n => n.values[index]);
      const fromNodeName = this.getStringValue(row, nodeCol, '');
      const toNodeName = this.getStringValue(row, linkedNodeCol, '');
      if (fromNodeName !== '' && toNodeName !== '') {
        const fromNodeType = this.getStringValue(
          row, nodeTypeCol, StyleConstants.DEFAULT_TYPE_LABEL);
        const toNodeType = this.getStringValue(
          row, linkedNodeTypeCol, StyleConstants.DEFAULT_TYPE_LABEL);
        const weight: number = this.getNumberValue(row, weightCol, 1);
        const selectionId = selectionIds[index];
        const filterKey = this.getStringValue(row, filterCol, '');
        const fromKey = createKey([fromNodeType, fromNodeName]);
        const toKey = createKey([toNodeType, toNodeName]);
        addSingleLink(keysToSelectionIds, fromKey, selectionId);
        addSingleLink(nodesToTypes, fromNodeName, fromNodeType);
        addSingleLink(nodesToTypes, toNodeName, toNodeType);
        const fromNode = this.createOrUpdateNode(fromKey, fromNodeType, fromNodeName, filterKey,
          keysToSelectionIds.get(fromKey)
        );
        fromNode.outboundSelectionIds.set(toKey, selectionId);
        const toNode = this.createOrUpdateNode(toKey, toNodeType, toNodeName);
        toNode.inboundSelectionIds.set(fromKey, selectionId);
        if (!Array.from(fromNode.linkedNodeTypeToOutboundKeysAndWeights.keys()).includes(toNodeType)) {
          fromNode.linkedNodeTypeToOutboundKeysAndWeights.set(
            toNodeType, new Map<string, number>());
        }
        if (!Array.from(toNode.linkedNodeTypeToInboundKeysAndWeights.keys()).includes(fromNodeType)) {
          toNode.linkedNodeTypeToInboundKeysAndWeights.set(
            fromNodeType, new Map<string, number>());
        }
        fromNode.linkedNodeTypeToOutboundKeysAndWeights.get(toNodeType).set(toKey, weight);
        toNode.linkedNodeTypeToInboundKeysAndWeights.get(fromNodeType).set(fromKey, weight);
        this.addAttributes(fromNode, row, attributeCols);
      }
    });
  }

  /**
   * Create a simple list of unlinked nodes
   */
  private loadDataInRankedListsMode(
    dataView: powerbi.DataView,
    selectionIds: ISelectionId[],
    nodeTypeCol: number,
    nodeCol: number,
    filterCol: number,
    attributeCols: Map<string, number>
  ): void {
    const keysToSelectionIds =
      new Map<string, Set<ISelectionId>>();
    const nodesToTypes = new Map<string, Set<string>>();
    const cats = dataView.categorical.categories;
    // Iterate over rows to build up links between attributes, linking objects, and
    // selection ids
    cats[0].values.forEach((val, index) => {
      const row = cats.map(n => n.values[index]);
      const nodeName = this.getStringValue(row, nodeCol, '');
      if (nodeName !== '') {
        const nodeType = this.getStringValue(
          row, nodeTypeCol, StyleConstants.DEFAULT_TYPE_LABEL);
        const selectionId = selectionIds[index];
        const filterKey = this.getStringValue(row, filterCol, '');
        const nodeKey = createKey([nodeType, nodeName]);
        addSingleLink(keysToSelectionIds, nodeKey, selectionId);
        addSingleLink(nodesToTypes, nodeName, nodeType);
        const node = this.createOrUpdateNode(nodeKey, nodeType, nodeName, filterKey,
          keysToSelectionIds.get(nodeKey)
        );
        this.addAttributes(node, row, attributeCols);
      }
    });
  }

  /**
   * Add the attributes from supplied attribute columns to the node
   */
  private addAttributes(
    node: INode,
    row: any[],
    attributeCols: Map<string, number>
  ): void {
    attributeCols.forEach(
      (value, key) => node.attributes.set(key, this.getNumberValue(row, value, 0)));
  }

  /**
   * Create a link from the source node to the target node based on a common linkingObject.
   * The set of selectionIds corresponding to the source node is used to create the source
   * node if it doesn't already exist
   */
  private createImplicitLink(
    sourceKey: string,
    targetKey: string,
    linkingObject: string,
    selectionIds: Set<ISelectionId>,
    filterKey: string
  ): void {
    const sourceParts = splitKey(sourceKey);
    const sourceName = sourceParts[0];
    const sourceVal = sourceParts[1];
    const targetParts = splitKey(targetKey);
    const targetName = targetParts[0];
    const targetVal = targetParts[1];
    if (
      isNonEmptyString(sourceName) && isNonEmptyString(sourceVal)
      && isNonEmptyString(targetVal) && isNonEmptyString(targetName)
      && isNonEmptyString(linkingObject)
    ) {
      const sourceNode: INode = this.createOrUpdateNode(sourceKey, sourceName, sourceVal,
        filterKey, selectionIds);
      const targetNode: INode = this.createOrUpdateNode(targetKey, targetName, targetVal);
      addDoubleLink(sourceNode.linkedNodeTypeToNodesAndObjects, targetName,
        targetNode, linkingObject);
    }
  }

  /**
   * Gets the index of a column with a given name
   */
  private getColumnIndex(cols, name): number {
    const matchingCols = cols.filter(c => c.roles.hasOwnProperty(name));
    const index = (cols.length > 0)
      ? cols.indexOf(matchingCols[0])
      : -1;
    return index;
  }

  /**
   * Updates an existing node with additional selection ids else creates a new node
   */
  private createOrUpdateNode(
    nodeKey: string,
    nodeType: string,
    nodeName: string,
    filterKey?: string,
    selectionIds?: Set<ISelectionId>
  ): INode {
    if (!this.chartData.keyToNode.has(nodeKey)) {
      const node: INode = {
        nodeType,
        nodeName,
        nodeKey,
        linkedNodeTypeToNodesAndObjects:
          new Map<string, Map<INode, Set<string>>>(),
        linkedNodeTypeToInboundKeysAndWeights:
          new Map<string, Map<string, number>>(),
        linkedNodeTypeToOutboundKeysAndWeights:
          new Map<string, Map<string, number>>(),
        linkingObjects: new Set<string>(),
        selectionIds: new Set<ISelectionId>(),
        outboundSelectionIds: new Map<string, ISelectionId>(),
        inboundSelectionIds: new Map<string, ISelectionId>(),
        nodeFamily: [],
        filterKey: (filterKey !== undefined)
          ? filterKey
          : '',
        attributes: new Map<string, number>()
      };
      this.chartData.keyToNode.set(nodeKey, node);
      addSingleLink(this.chartData.nodeTypeToNodes, nodeType, node);
      if (selectionIds !== undefined) {
        selectionIds.forEach(id => node.selectionIds.add(id));
      }
      return node;
    }
    else {
      const node = this.chartData.keyToNode.get(nodeKey);
      if (selectionIds !== undefined) {
        selectionIds.forEach(id => node.selectionIds.add(id));
      }
      return node;
    }
  }

  /**
   * Generates selection ids for each item
   */
  private createSelectionIds(dataView: powerbi.DataView, host: IVisualHost): ISelectionId[] {
    const cats = dataView.categorical.categories;
    const nodeColumnIdx = this.getColumnIndex(dataView.categorical.categories.map(n => n.source), 'NODE');
    const nodeCategory = cats[nodeColumnIdx];
    return nodeCategory.values.map((val, index) => {
      return host.createSelectionIdBuilder()
        .withCategory(nodeCategory, index)
        .createSelectionId();
    });
  }


  /**
   * Gets the indices of columns with a given name
   */
  private getColumnIndexMap(cols, name): Map<string, number> {
    const matchingCols = cols.filter(c => c.roles.hasOwnProperty(name));
    const columnMap = new Map<string, number>();
    matchingCols.forEach(col => columnMap.set(col.displayName, cols.indexOf(col)));
    return columnMap;
  }

  /**
   * Gets the sequence of columns with a given name
   */
  private getColumnNameSequence(cols, name): string[] {
    const matchingCols = cols.filter(c => c.roles.hasOwnProperty(name));
    const columnSeq = matchingCols.map(col => col.displayName);
    return columnSeq;
  }

  /**
   * Gets the string value from a row index else returns a default string
   */
  private getStringValue(row, index, defaultString: string): string {
    const value = (index === -1)
      ? defaultString
      : (isNonEmptyString(row[index]))
        ? row[index] + ''
        : defaultString;
    return value;
  }

  /**
   * Gets the number value from a row index else returns a default number
   */
  private getNumberValue(row, index, defaultNumber: number): number {
    const value = (index === -1 || row[index] === null)
      ? defaultNumber
      : isNaN(parseFloat(row[index].toString()))
        ? defaultNumber
        : Math.max(0, parseFloat(row[index].toString()));
    return value;
  }
}
