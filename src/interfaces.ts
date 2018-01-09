import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import * as React from 'react';
import { VisualSettings } from './settings';

/**
 * Possible views of bound data based on combinations of bound columns and user interaction
 */
export type DataView =
  'RANKED ATTRIBUTES' |
  'IMPLICIT ATTRIBUTES' |
  'EXPLICIT ATTRIBUTES' |
  'ITEMS' |
  'LINKS' |
  'JOINT LINKS' |
  'OUT LINKS' |
  'IN LINKS' |
  'JOINT OUT LINKS' |
  'JOINT IN LINKS';

export const DataView = {
  RANKED_ATTRIBUTES: 'RANKED ATTRIBUTES' as DataView,
  IMPLICIT_ATTRIBUTES: 'IMPLICIT ATTRIBUTES' as DataView,
  EXPLICIT_ATTRIBUTES: 'EXPLICIT ATTRIBUTES' as DataView,
  ITEM_TYPES: 'ITEMS' as DataView,
  OCCURRENCE: 'LINKS' as DataView,
  COOCCURRENCE: 'JOINT LINKS' as DataView,
  OUT_OCCURRENCE: 'OUT LINKS' as DataView,
  IN_OCCURRENCE: 'IN LINKS' as DataView,
  OUT_COOCCURRENCE: 'JOINT OUT LINKS' as DataView,
  IN_COOCCURRENCE: 'JOINT IN LINKS' as DataView
};

/**
 * Possible formats of bound data based on different combinations of bound columns
 */
export const enum DataFormat {
  UNKNOWN = 'Unknown',
  RANKED_LABELS = 'Ranked Labels',
  RANKED_VALUES = 'Ranked Values',
  IMPLICIT_LINKS = 'Implicit Links',
  EXPLICIT_LINKS = 'Explicit Links'
}

/**
 * React props for PivotSlicerChart
 */
export interface IChartProps {
  chartData: IChartData;
  settings: VisualSettings;
  host: IVisualHost;
  loaded: boolean;
  state: IChartState;
  needsStateRefresh: boolean;
  onStateChanged?: (state: IChartState) => any;
}

/**
 * Node pivot data structure constructured from powerbi dataview
 */
export interface IChartData {
  // Describes the kind of data format based on bound columns
  dataFormat: DataFormat;
  // Describes the names of bound attributes
  attributeSequence: string[];
  // Maps node key (a combination of data roles in the form
  // '<NODE_TYPE>-<NODE>') to node object
  keyToNode: Map<string, INode>;
  // Maps node type (value of NODE_TYPE data role) to node set
  nodeTypeToNodes: Map<string, Set<INode>>;
  // Maps linking object id (value of NODE_LINKER data role) to Map of node keys to row
  // selection ids. Used for constructing intersection/cooccurrence filters
  objectToNodeTypesToSelections: Map<string, Map<string, Set<ISelectionId>>>;
  // Mapping from field name to column index
  columns: Map<string, number>;
}

/**
 * Representation of a tabular attribute (NODE data role) of a given node type
 * (NODE_TYPE data role) linked to an object (NODE_LINKER data role). All nodes
 * of a linking object receive birectional links to one another, transforming the implicit graph
 * relations in the tabular structure into explicit graph links
 */
export interface INode {
  // The type of the node (value of NODE_TYPE data role)
  nodeType: string;
  // The label of the node (value of NODE data role)
  nodeName: string;
  // The key of the node (a combination of data roles in the form
  // '<NODE_TYPE>-<NODE>')
  nodeKey: string;
  // The set of objects (values of NODE_LINKER data roles) to which this node is linked
  // directly and which create indirect links to other nodes
  linkingObjects: Set<string>;
  // The selection ids of table rows in which this node connects to its linkingObjects
  selectionIds: Set<ISelectionId>;
  // Maps linked nodes to the set of objects creating these links and organizes by node type
  linkedNodeTypeToNodesAndObjects: Map<string, Map<INode, Set<string>>>;
  // Maps nodes to the set of inbound linked nodes and organises them by node type
  linkedNodeTypeToInboundKeysAndWeights: Map<string, Map<string, number>>;
  // Maps nodes to the set of outbound linked nodes and organises them by node type
  linkedNodeTypeToOutboundKeysAndWeights: Map<string, Map<string, number>>;
  // Stores individual selection ids of direct outbound links
  outboundSelectionIds: Map<string, ISelectionId>;
  // Stores individual selection ids of direct inbound links
  inboundSelectionIds: Map<string, ISelectionId>;
  // Other nodes with same label but different node type
  nodeFamily: INode[];
  // The value on which to filter for this node if filter keys are being used
  filterKey: string;
  // The named numeric attributes of the node
  attributes: Map<string, number>;
}

/**
 * Represents a pinned node
 */
export interface IActiveNode {
  /**
   * The key of the node
   */
  key: string;

  /**
   * The color representing the node
   */
  color: string;

  /**
   * Whether or not the pin is selected
   */
  selected: boolean;
}

/**
 * React state for PivotSlicerChart
 */
export interface IChartState {
  /**
   * The selected (i.e., expanded) section, if any, else 'All'
   */
  selectedSection: string;

  /**
   * The list of pinned nodes
   */
  pinnedNodes: IActiveNode[];

  /**
   * The current node that the user selected
   */
  activeNode: IActiveNode;

  /**
   * The ALL toggle pin
   */
  togglePin: IActiveNode;

  /**
   * The current view from all possible views given the data format
   */
  view: DataView;

  /**
   * The weight assigned to each attribute to create an aggregate value
   * * Note *
   *   This is important that it is an object, the IChartState gets serialized and deserialized
   *   Maps get changed into Objects, and so when we try to access attributeWeights later,
   *   sometimes it could be a Map and sometimes it is just an object
   *   so lets just go with object.
   */
  attributeWeights: Object;
}

/**
 * React props for the header bar above the current selections
 */
export interface ISelectedHeaderProps {
  key: string;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
  barWidth: number;
  dataViewOptions: IDataViewOptionsProps;
  showUndoButton: boolean;
  showRedoButton: boolean;
  showTop: boolean;
  showLabel: boolean;
  handleUndoButton: () => any;
  handleRedoButton: () => any;
}

/**
 * React props for the header bar above items related to the current selections
 */
export interface IRelatedHeaderProps {
  key: string;
  title: string;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
  barWidth: number;
}

/**
 * React props for the buttons used to switch between counting options
 */
export interface IDataViewOptionsProps {
  selectedOption: string;
  options: string[];
  fontColor: string;
  fontSize: number;
  backgroundColor: string;
  handleDataViewOptionChange: (option: string) => any;
}

/**
 * React props for the section headers organising item lists
 */
export interface ISectionProps {
  key: string;
  section: string;
  sectionWeight: number;
  maxSectionWeight: number;
  barSegments: IBarSegmentsProps;
  count: number;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
  isExpanded: boolean;
  showWeights: boolean;
  attributeProps: IAttributeWeightProps;
  handleSectionHeaderSelected: () => any;
}

/**
 * React props for the weight of a node attribute
 */
export interface IAttributeWeightProps {
  section: string;
  attributeWeight: number;
  fontSize: number;
  fontColor: string;
  handleAttributeOptionChanged: (section: string, increase: boolean) => any;
}

/**
 * React props for a list item corresponding to a node
 */
export interface IItemProps {
  // Necessary for react
  key: string;
  nodeLabel: string;
  rank: number;
  wrapText: boolean;
  barSegments: IBarSegmentsProps;
  pinFilled: boolean;
  pinColor: string;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
  itemSelected: boolean;
  enablePinning: boolean;
  handleItemSelected: () => void;
  handlePinIconSelected: () => void;
}

/**
 * React props for the stacked segments of a frequency bar
 */
export interface IBarSegmentsProps {
  segments: IBarSegment[];
  isHorizontalSplit: boolean;
  maxWeight: number;
  barWidth: number;
  weight: number;
  displayLabel: string;
  node: string;
  section: string;
  backgroundColor: string;
  fontColor: string;
  fontSize: number;
  handleItemSelected: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Properties of a stacked segment of a frequency bar
 */
export interface IBarSegment {
  color: string;
  weight: number;
  maxWeight: number;
}

/**
 * All JSX Elements required to render the Pivot Slicer UI, from top to bottom
 */
export interface IListElements {
  pinElements: JSX.Element[];
  selectedHeaderElement: JSX.Element;
  selectedElements: JSX.Element[];
  sectionElement: JSX.Element;
  listElements: JSX.Element[];
  relatedOrSimilarHeaderElement: JSX.Element;
}

/**
 * The weights of all nodes and section given the current selections and mode for listing and
 * counting
 */
export interface IAllWeights {
  sectionOrder: string[];
  sectionWeights: Map<string, IWeight>;
  sectionMaxItemWeights: Map<string, number>;
  maxSectionWeight: number;
  nodeTypeToItemWeights: Map<string, IWeight[]>;
  selectedItemWeights: IWeight[];
  nodeFamilyCategoryWeights: Map<string, number>;
  nodeFamilyItemWeights: Map<string, IWeight[]>;
  nodeFamilyOrder: string[];
  selectionIdsToApply?: Set<ISelectionId>;
  filterToApply?: IBasicFilter;
}

/**
 * The weight of a single section or node
 */
export interface IWeight {
  targetKey: string;
  weight: number;
  displayLabel: string;
  components: Map<string, number>;
  colors: Map<string, string>;
}
