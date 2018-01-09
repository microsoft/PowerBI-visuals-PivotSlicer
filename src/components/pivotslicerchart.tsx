import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  DataView,
  IChartProps,
  IChartState,
  IListElements,
  ISelectedHeaderProps,
  IRelatedHeaderProps,
  IBarSegment,
  ISectionProps,
  IWeight,
  IItemProps,
  INode,
  DataFormat,
  IBarSegmentsProps,
  IActiveNode,
  IChartData,
} from '../interfaces';
import { StyleConstants } from '../styleconstants';
import { StateManager } from '../statemanager';
import { instructions } from './instructions';
import { SelectedHeader } from './selectedheader';
import { RelatedHeader } from './relatedheader';
import { SectionHeader } from './sectionheader';
import { Item } from './item';
import { NodePin } from './nodepin';
import {
  getTogglePinGray,
  splitKey,
  getDisplayLabel,
  isCountingCooccurrences,
  isImplicitLinks,
  isAttribute,
  getDataViewOptions,
} from '../utils';
import { VisualSettings } from '../settings';

/**
 * Core Pivot Slicer visual
 */
export class PivotSlicerChart extends React.Component<IChartProps, IChartState> {

  // Private properties

  private stateManager: StateManager;
  private defaultState: IChartState = {
    selectedSection: 'All',
    activeNode: null,
    pinnedNodes: [],
    togglePin: {
      key: StyleConstants.TOGGLE_ALL_LABEL,
      color: getTogglePinGray(this.props.settings.configuration.bookmarkLightness),
      selected: false,
    },
    view: DataView.ITEM_TYPES,
    attributeWeights: {}
  };

  /**
   * Constructor
   */
  public constructor(props: IChartProps) {
    super(props);
    this.state = this.defaultState;
    this.stateManager = new StateManager(this.defaultState, (state: IChartState) => {
      if (this.props.onStateChanged) {
        this.props.onStateChanged(state);
      }
    }, this.onStateManagerStateUpdated.bind(this), () => {
      // TODO: Janky
      ReactDOM.findDOMNode(this.refs['listRef']).scrollTop = 0;
    });
  }

  // Public methods for React lifecycle management

  /**
   * Some selections need to be applied in two stages: first removing an applied filter
   * before applying a new one. Also sets state accordingly when props change.
   */
  public componentWillReceiveProps(nextProps: IChartProps) {
    // Add in default props if state is missing anything
    const state = {
      ...this.defaultState,
      ...nextProps.state
    };
    if (nextProps.needsStateRefresh) {
      this.stateManager.reset(state);
    }
    this.stateManager.loadState(nextProps.settings, nextProps.chartData, state);
  }

  /**
   * Saves state, generates elements to render, and renders them in the top-level JSX template
   */
  public render(): JSX.Element {
    if (this.props.loaded) {
      const {
        pinElements,
        selectedHeaderElement,
        selectedElements,
        sectionElement,
        listElements,
        relatedOrSimilarHeaderElement
      } = this.renderElements();
      const {
        backgroundColor,
        fontColor,
        fontSize,
        barColor
      } = this.props.settings.configuration;
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: backgroundColor,
            color: fontColor,
            fontSize: fontSize + 'pt'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexFlow: 'row',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              flexShrink: 0,
              flexGrow: 0,
              backgroundColor: backgroundColor,
              color: fontColor,
              fontSize: fontSize + 'pt'
            }}
          >
            {pinElements}
          </div>
          <div
            style={{
              border: '1px solid' + barColor,
              overflowY: 'scroll',
              height: '99%',
              width: '99%',
              display: 'flex',
              flexDirection: 'column',
            }}>
            <div
              style={{
                flexShrink: 0,
                flexGrow: 0,
                backgroundColor: backgroundColor,
                color: fontSize,
                fontSize: fontSize + 'pt',
                width: '100%'
              }}
            >
              {selectedHeaderElement}
            </div>
            <div
              style={{
                flexShrink: 0,
                flexGrow: 0,
                maxHeight: StyleConstants.MAX_SELECTIONS_HEIGHT,
                backgroundColor: backgroundColor,
                color: fontColor,
                fontSize: fontSize + 'pt',
                width: '100%',
                overflowY: 'scroll',
                borderBottom: '1px solid' + barColor,
              }}
            >
              {selectedElements}
            </div>
            <div
              style={{
                flexShrink: 0,
                flexGrow: 0,
                backgroundColor: backgroundColor,
                color: fontColor,
                fontSize: fontSize + 'pt',
                width: '100%'
              }}
            >
              {relatedOrSimilarHeaderElement}
              {sectionElement}
            </div>
            <div
              style={{
                flexGrow: 1,
                backgroundColor: backgroundColor,
                color: fontColor,
                fontSize: fontSize + 'pt',
                overflowY: 'scroll'
              }}
              ref='listRef'
            >
              {listElements}
            </div>
          </div>
        </div>
      );
    }
    else {
      return instructions;
    }
  }

  /**
   * Listener for when the state manager updates the state
   * @param state The updated state
   */
  private onStateManagerStateUpdated(state: IChartState) {
    this.setState(state);
  }

  // Private helper methods to support component rendering

  /**
   * Generates elements to render
   */
  private renderElements(): IListElements {
    const sectionElements = new Map<string, JSX.Element>();
    const listElements: JSX.Element[] = [];
    const {
      backgroundColor,
      fontColor,
      fontSize,
      barColor,
      sectionColor,
      barSize,
      showRelated,
      nodeType,
      topCount,
      maxCount,
      nodeTypeLabelLength,
      enablePinning,
      wrapText
    } = this.props.settings.configuration;
    const headerFontSize = Math.round(fontSize * StyleConstants.HEADER_FONT_SIZE_MULTIPLIER);
    const sectionFontSize = Math.round(fontSize * StyleConstants.SECTION_FONT_SIZE_MULTIPLIER);
    // Generate pinElements
    const pinElements = this.renderPins();
    // Generate selectionsElements
    let selectedNodes = this.state.pinnedNodes.filter(p => p.selected).map(p => {
      return this.props.chartData.keyToNode.get(p.key);
    });
    if (this.state.activeNode) {
      selectedNodes.push(this.props.chartData.keyToNode.get(this.state.activeNode.key));
    }
    selectedNodes = selectedNodes.filter(x => x !== undefined);

    const maxSectionWeight = this.stateManager.allWeights.maxSectionWeight;
    const selectedSection = this.stateManager.allWeights.sectionOrder.includes(this.state.selectedSection)
      ? this.state.selectedSection
      : 'All';
    const barWidth = (
      this.props.chartData.dataFormat === DataFormat.RANKED_LABELS
      || this.state.view === DataView.ITEM_TYPES)
      ? 0
      : Math.max(0, Math.min(barSize, StyleConstants.MAX_BAR_WIDTH)
    );
    const headerBarWidth = (
      this.props.chartData.dataFormat === DataFormat.RANKED_LABELS)
      ? 0
      : Math.max(0, Math.min(barSize, StyleConstants.MAX_BAR_WIDTH)
    );
    const selectedHeaderProps: ISelectedHeaderProps = {
      fontColor,
      fontSize: headerFontSize,
      key: 'SelectedHeader',
      backgroundColor: barColor,
      barWidth: headerBarWidth,
      showTop: selectedNodes.length === 0,
      showLabel: this.props.chartData.attributeSequence.length > 0
        || this.props.chartData.dataFormat === DataFormat.IMPLICIT_LINKS
        || this.props.chartData.dataFormat === DataFormat.EXPLICIT_LINKS,
      handleUndoButton: this.stateManager.handleHistoryUndo,
      handleRedoButton: this.stateManager.handleHistoryRedo,
      showUndoButton: this.stateManager.canUndo(),
      showRedoButton: this.stateManager.canRedo(),
      dataViewOptions: {
        fontColor,
        fontSize: headerFontSize,
        selectedOption: (isAttribute(this.state.view))
          ? StyleConstants.ATTRIBUTES_LABEL
          : this.state.view,
        options: getDataViewOptions(
          this.props.chartData.dataFormat,
          this.props.chartData.attributeSequence.length > 0,
          enablePinning
        ),
        backgroundColor: barColor,
        handleDataViewOptionChange: this.stateManager.handleDataViewOptionChange
      },
    };
    const selectedHeaderElement = <SelectedHeader {...selectedHeaderProps} />;
    const selectedElements = this.renderSelections(selectedNodes, barWidth);
    const relatedHeaderProps: IRelatedHeaderProps = {
      fontColor,
      barWidth,
      fontSize: headerFontSize,
      key: 'RelatedHeader',
      title: (
        !showRelated
        || this.state.view === DataView.RANKED_ATTRIBUTES
        || this.state.view === DataView.IMPLICIT_ATTRIBUTES
        || this.state.view === DataView.EXPLICIT_ATTRIBUTES
        || this.props.chartData.dataFormat === DataFormat.RANKED_LABELS
        || this.props.chartData.dataFormat === DataFormat.RANKED_VALUES
      )
        ? StyleConstants.TOP_LABEL
        : StyleConstants.RELATED_LABEL,
      backgroundColor: barColor,
    };
    if (selectedNodes.length > 0 && selectedSection === 'All') {
      listElements.push(<RelatedHeader {...relatedHeaderProps} />);
    }
    // Generate listElements (and sectionElement if a section is selected)
    const isHorizontalSplit = isCountingCooccurrences(this.state.view)
      && isImplicitLinks(this.state.view);
    this.stateManager.allWeights.sectionOrder.forEach(section => {
      if (selectedSection === 'All' || selectedSection === section) {
        const sectionWeight = this.stateManager.allWeights.sectionWeights.get(section);
        const barSegments: IBarSegmentsProps = (isAttribute(this.state.view))
          ? null
          : {
            section,
            fontColor,
            barWidth,
            isHorizontalSplit,
            fontSize: sectionFontSize,
            node: '',
            weight: sectionWeight.weight,
            displayLabel: '',
            maxWeight: maxSectionWeight,
            // handleItemSelected: this.stateManager.handleItemSelection,
            handleItemSelected: () => {},
            segments: this.generateBarSegments(
              sectionWeight, maxSectionWeight, barColor),
            backgroundColor: barColor
          };
        const itemWeights = this.stateManager.allWeights.nodeTypeToItemWeights.get(section);
        const showWeights =
          isAttribute(this.state.view)
          && section !== StyleConstants.COMBINED_ATTRIBUTES_LABEL
          && selectedSection === 'All'
          && Object.keys(this.state.attributeWeights).length > 1;
        const attributeWeight = (showWeights && this.state.attributeWeights[section]) || 0;
        const canExpand = itemWeights.length < topCount;
        const sectionProps: ISectionProps = {
          section,
          fontColor,
          maxSectionWeight,
          showWeights,
          barSegments,
          fontSize: sectionFontSize,
          key: section + '-ListedNoteTypeProps',
          sectionWeight: sectionWeight.weight,
          count: itemWeights.length,
          handleSectionHeaderSelected: () => this.stateManager.handleSectionSelection(section),
          backgroundColor: sectionColor,
          isExpanded: section === selectedSection,
          attributeProps: {
            section,
            attributeWeight,
            fontColor,
            fontSize: sectionFontSize,
            handleAttributeOptionChanged: this.stateManager.handleAttributeWeightChange,
          }
        };
        if (itemWeights.length > 0) {
          // Return separate sectionElement if a section is selected, else embed
          // in listElements
          const sectionElement = <SectionHeader {...sectionProps} />;
          sectionElements.set(section, sectionElement);
          if (section !== selectedSection) {
            listElements.push(sectionElement);
          }
          const maxItemWeight = this.stateManager.allWeights.sectionMaxItemWeights.get(section);
          const limit = (
            selectedSection !== 'All'
            || this.stateManager.allWeights.sectionOrder.length === 1
          ) ? maxCount
            : topCount;
          Array.from({ length: limit }, (e, i) => i + 1).forEach(i => {
            if (i < itemWeights.length + 1) {
              const itemWeight = itemWeights[i - 1];
              const itemNodes = this.state.pinnedNodes.filter(
                p => p.key === itemWeight.targetKey
              );
              const {
                itemPinColor,
                pinFilled
              } = this.generateItemColors(itemNodes, barColor);
              const itemBarSegments: IBarSegment[] =
                this.generateBarSegments(itemWeight, maxItemWeight, barColor);
              const nodeLabel = (
                this.props.chartData.nodeTypeToNodes.size > 1 && isAttribute(this.state.view)
              ) ? getDisplayLabel(
                  itemWeight.targetKey,
                  nodeTypeLabelLength)
                : splitKey(itemWeight.targetKey)[1];
              const itemProps: IItemProps = {
                nodeLabel,
                pinFilled,
                enablePinning,
                backgroundColor,
                fontColor,
                fontSize,
                wrapText,
                rank: i,
                key: `${section}-${itemWeight.targetKey}-ListedValueProps`,
                pinColor: itemPinColor,
                itemSelected: false,
                handleItemSelected: () => this.stateManager.handleItemSelection(itemWeight.targetKey),
                handlePinIconSelected: () => this.stateManager.handleItemPinSelection(itemWeight.targetKey),
                barSegments: {
                  fontColor,
                  fontSize,
                  section,
                  barWidth,
                  displayLabel: itemWeight.displayLabel,
                  backgroundColor: barColor,
                  isHorizontalSplit: isHorizontalSplit,
                  node: itemWeight.targetKey,
                  weight: itemWeight.weight,
                  maxWeight: maxItemWeight,
                  segments: itemBarSegments,
                  handleItemSelected: () => this.stateManager.handleItemSelection(itemWeight.targetKey)
                }
              };
              listElements.push(
                <Item {...itemProps} />
              );
            }
          });
        }
      }
    });
    // Generate sections and list elements for families of selected nodes
    const similarHeaderProps: IRelatedHeaderProps = {
      fontColor,
      barWidth,
      key: 'SimilarHeader',
      title: StyleConstants.SIMILAR_LABEL,
      backgroundColor: barColor,
      fontSize: headerFontSize
    };
    if (this.stateManager.allWeights.nodeFamilyOrder.length > 0) {
      if (
        selectedSection === 'All'
        || Array.from(this.props.chartData.nodeTypeToNodes.keys()).includes(selectedSection)
      ) {
        listElements.push(<RelatedHeader {...similarHeaderProps} />);
      }
      const maxNodeFamilyCategoryWeight = this.stateManager.allWeights.nodeFamilyCategoryWeights
        .get(this.stateManager.allWeights.nodeFamilyOrder[0]);
      this.stateManager.allWeights.nodeFamilyOrder.forEach(selected => {
        const count = this.stateManager.allWeights.nodeFamilyItemWeights.get(selected).length;
        const canExpand = count < topCount;
        const sectionWeight = this.stateManager.allWeights.nodeFamilyCategoryWeights.get(selected);
        const sectionProps: ISectionProps = {
          sectionWeight,
          fontColor,
          fontSize: sectionFontSize,
          count,
          key: selected + '-SimilarNodeTypeProps',
          section: selected,
          maxSectionWeight: maxNodeFamilyCategoryWeight,
          handleSectionHeaderSelected: () => this.stateManager.handleSectionSelection(selected),
          backgroundColor: sectionColor,
          showWeights: false,
          attributeProps: null,
          isExpanded: selected === selectedSection,
          barSegments: {
            fontColor,
            fontSize,
            isHorizontalSplit,
            barWidth,
            node: '',
            section: '',
            weight: sectionWeight,
            displayLabel: '',
            maxWeight: maxSectionWeight,
            handleItemSelected: () => {},
            backgroundColor: barColor,
            segments: [{
              color: barColor,
              weight: sectionWeight,
              maxWeight: maxNodeFamilyCategoryWeight
            }]
          }
        };
        listElements.push(
          <SectionHeader {...sectionProps} />
        );
        const maxItemWeight = this.stateManager.allWeights.nodeFamilyItemWeights.get(selected)[0].weight;
        this.stateManager.allWeights.nodeFamilyItemWeights.get(selected).forEach((itemWeight, index) => {
          const node = this.props.chartData.keyToNode.get(itemWeight.targetKey);
          const itemNodes = this.state.pinnedNodes.filter(
            p => p.key === itemWeight.targetKey);
          const {
            itemPinColor,
            itemBarColor,
            pinFilled
          } = this.generateItemColors(itemNodes, barColor);
          const itemProps: IItemProps = {
            pinFilled,
            enablePinning,
            backgroundColor,
            fontColor,
            fontSize,
            wrapText,
            key: itemWeight.targetKey + '-SimilarNodeProps',
            nodeLabel: getDisplayLabel(node.nodeKey, nodeTypeLabelLength),
            rank: index + 1,
            pinColor: itemPinColor,
            itemSelected: false,
            handleItemSelected: () => this.stateManager.handleItemSelection(itemWeight.targetKey),
            handlePinIconSelected: () => this.stateManager.handleItemPinSelection(itemWeight.targetKey),
            barSegments: {
              fontColor,
              fontSize,
              barWidth,
              isHorizontalSplit,
              backgroundColor: barColor,
              node: itemWeight.targetKey,
              section: selected,
              weight: itemWeight.weight,
              displayLabel: '',
              maxWeight: maxItemWeight,
              segments: [{
                color: itemBarColor,
                weight: itemWeight.weight,
                maxWeight: maxItemWeight
              }],
              handleItemSelected: () => this.stateManager.handleItemSelection(itemWeight.targetKey)
            }
          };
          listElements.push(
            <Item {...itemProps} />
          );
        });
      });
    }
    const relatedOrSimilarHeaderElement = (
      selectedNodes.length === 0 ||
      selectedSection === 'All'
    ) ? null
      : (Array.from(this.props.chartData.nodeTypeToNodes.keys()).indexOf(selectedSection) !== -1
        || !showRelated
        || isAttribute(this.state.view)
        || this.props.chartData.dataFormat === DataFormat.RANKED_LABELS
        || this.props.chartData.dataFormat === DataFormat.RANKED_VALUES
      )
        ? <RelatedHeader {...relatedHeaderProps} />
        : <RelatedHeader {...similarHeaderProps} />;
    return {
      pinElements,
      selectedHeaderElement,
      selectedElements,
      listElements,
      relatedOrSimilarHeaderElement,
      sectionElement: sectionElements.get(selectedSection)
    };
  }

  /**
   * Assigns colors to item pins, bars, and pin fills
   */
  private generateItemColors(itemNodes: IActiveNode[], barColor: string) {
    if (itemNodes.length > 0) {
      return {
        itemPinColor: itemNodes[0].color,
        itemBarColor: (itemNodes[0].selected)
          ? itemNodes[0].color
          : barColor,
        pinFilled: true
      };
    }
    else {
      return {
        itemPinColor: barColor,
        itemBarColor: barColor,
        pinFilled: false
      };
    }
  }

  /**
   * Generates segments for item and section bars
   */
  private generateBarSegments(
    weight: IWeight, maxWeight: number, barColor: string): IBarSegment[] {
    if (weight.components.size > 0) {
      return Array.from(weight.components.keys()).map(
        (component, pos) => {
          return {
            maxWeight,
            color: weight.colors.get(component),
            weight: weight.components.get(component),
          };
        });
    }
    else {
      return [{
        maxWeight,
        color: barColor,
        weight: weight.weight
      }];
    }
  }

  /**
   * Generates selectionsElements to render
   */
  private renderSelections(
    selectedNodes: INode[],
    barWidth: number
  ): JSX.Element[] {
    const selectionsElements: JSX.Element[] = [];
    if (selectedNodes.length > 0) {
      const isHorizontalSplit = isCountingCooccurrences(this.state.view) &&
        isImplicitLinks(this.state.view);
      const {
        backgroundColor,
        fontColor,
        fontSize,
        barColor,
        nodeTypeLabelLength,
        enablePinning,
        wrapText
      } = this.props.settings.configuration;
      const maxSelectedItemWeight = this.stateManager.allWeights.selectedItemWeights[0].weight;
      this.stateManager.allWeights.selectedItemWeights.forEach((weight, index) => {
        const itemNodes = this.state.pinnedNodes.filter(
          p => p.key === weight.targetKey);
        const { itemPinColor, itemBarColor, pinFilled } =
          this.generateItemColors(itemNodes, barColor);
        const nodeParts = splitKey(weight.targetKey);
        const node = this.props.chartData.keyToNode.get(weight.targetKey);
        const itemBarSegments: IBarSegment[] =
          this.generateBarSegments(weight, maxSelectedItemWeight, barColor);
        const nodeLabel = (
          this.props.chartData.nodeTypeToNodes.size > 1
        ) ? getDisplayLabel(node.nodeKey, nodeTypeLabelLength)
          : node.nodeName;
        const selectedNodeProps: IItemProps = {
          nodeLabel,
          pinFilled,
          enablePinning,
          backgroundColor,
          fontColor,
          fontSize,
          wrapText,
          key: weight.targetKey + '-SelectedValueProps',
          rank: index + 1,
          pinColor: itemPinColor,
          itemSelected: true,
          handleItemSelected: () => this.stateManager.handleSelectedItemSelection(weight.targetKey),
          handlePinIconSelected: () => this.stateManager.handleItemPinSelection(weight.targetKey),
          barSegments: {
            isHorizontalSplit,
            barWidth,
            fontColor,
            fontSize,
            displayLabel: weight.displayLabel,
            backgroundColor: barColor,
            node: weight.targetKey,
            section: '',
            weight: weight.weight,
            maxWeight: maxSelectedItemWeight,
            segments: itemBarSegments,
            handleItemSelected: () => this.stateManager.handleItemSelection(weight.targetKey)
          }
        };
        selectionsElements.push(
          <Item {...selectedNodeProps} />
        );
      });
    }
    return selectionsElements;
  }

  /**
   * Generates pinElements to render
   */
  private renderPins(): JSX.Element[] {
    const { nodeTypeLabelLength, fontColor, fontSize } = this.props.settings.configuration;
    const { handlePinClick, handlePinClear } = this.stateManager;
    const nodes = this.state.pinnedNodes.slice(0);
    if (nodes.length > 1) {
      nodes.push(this.state.togglePin);
    }
    return nodes.map(node => {
      const label = node.key === StyleConstants.TOGGLE_ALL_LABEL ? 'All' : getDisplayLabel(node.key, nodeTypeLabelLength);
      return (
        <NodePin
          {...node}
          id={node.key}
          label={label}
          fontColor={fontColor}
          fontSize={fontSize + ''}
          onClick={() => handlePinClick(node.key)}
          onClear={() => handlePinClear(node.key)}
        />
      );
    });
  }
}