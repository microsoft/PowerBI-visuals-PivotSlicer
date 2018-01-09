import autobind from 'autobind-decorator';
import {
  IChartState,
  DataView,
  DataFormat,
  IAllWeights,
  IActiveNode,
  IChartData,
} from './interfaces';
import WeightGenerator from './weightgenerator';
import {
  deepCompare,
  getPinColor,
  isCountingCooccurrences,
  isOutboundLinks,
  stringify,
  getDataViewOptions
} from './utils';
import { StyleConstants } from './styleconstants';
import { VisualSettings } from './settings';

export type StateListener = (state: IChartState) => any;

/**
 * Manages state and event handling for PivotSlicerChart
 */
export class StateManager {

  // Private properties

  private history: string[];
  private historyIndex: number;
  private weightGenerator: WeightGenerator;

  private currentState: IChartState;
  private settings: VisualSettings;
  private chartData: IChartData;

  // TODO: Janky
  private onResetScroll: () => any;
  private onSaveState: StateListener;
  private onUpdateState: StateListener;

  // Public members

  public allWeights: IAllWeights;

  /**
   * Constructor
   */
  public constructor(
    initialState: IChartState,
    onSaveState: StateListener,
    onUpdateState: StateListener,
    onResetScroll: () => any
  ) {
    this.weightGenerator = new WeightGenerator();
    this.history = [];
    this.history.push(stringify(initialState));
    this.historyIndex = 0;
    this.onSaveState = onSaveState;
    this.onUpdateState = onUpdateState;
    this.onResetScroll = onResetScroll;
  }

  /**
   * Resets state on changes to data bindings
   */
  public reset(state: IChartState): void {
    this.history = [];
    this.history.push(stringify(state));
    this.historyIndex = 0;
    if (this.settings) {
      this.generateWeightsAndApplySelections(this.chartData, this.settings, state);
      this.onUpdateState(state);
    }
  }

  /**
   * Reverts to the previously created history state
   */
   @autobind
   public handleHistoryUndo(): void {
    let updatedState;
    while (this.canUndo()) {
      const currentString = this.history[this.historyIndex];
      this.historyIndex -= 1;
      const newState: IChartState = JSON.parse(this.history[this.historyIndex]);
      this.retainPins(this.currentState, newState);
      updatedState = this.updateLoadedState(this.chartData, newState);
      const newString = stringify(updatedState);
      if (currentString === newString) {
        this.history = this.history.splice(this.historyIndex);
        continue;
      }
      else {
        break;
      }
    }
    this.history[this.historyIndex] = stringify(updatedState);
    this.generateWeightsAndApplySelections(this.chartData, this.settings, updatedState);

    this.currentState = updatedState;
    this.onUpdateState(updatedState);
  }

  /**
   * Reverts to the previously undone history state
   */
   @autobind
   public handleHistoryRedo(): void {
    if (this.canRedo()) {
      this.historyIndex += 1;
      const newState: IChartState = JSON.parse(this.history[this.historyIndex]);
      this.retainPins(this.currentState, newState);
      const updatedState = this.updateLoadedState(this.chartData, newState);
      this.generateWeightsAndApplySelections(this.chartData, this.settings, updatedState);
      this.currentState = updatedState;
      this.onUpdateState(updatedState);
    }
  }

  /**
   * Whether there is a history stack of prior states
   */
   @autobind
   public canUndo(): boolean {
    return this.history.length > 0 && this.historyIndex > 0 && this.historyIndex < this.history.length;
  }

  /**
   * Whether there are undone states in the history stack
   */
   @autobind
   public canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Called on selection of a section header
   */
   @autobind
   public handleSectionSelection(section: string): void {
    if (section) {
      const mode = this.currentState.selectedSection;
      const newState = this.mergeChanges(this.currentState, { selectedSection: mode === 'All' ? section : 'All' });
      this.setCurrentStateAndSave(newState);
      this.resetScroll();
      this.onUpdateState(newState);
    }
  }

  /**
   * Called on selection of a list item corresponding to a node. If the selected item is not a
   * pin, add it as an unpinned pin (and replace any prior unpinned pin)
   */
   @autobind
   public handleItemSelection(key: string): void {
    if (key && this.chartData.keyToNode.has(key)) {
      // Make a copy, so we don't mutate
      const pinnedNodes = (this.currentState.pinnedNodes || []).slice(0);
      const togglePin = this.currentState.togglePin;
      const pinnedNode = pinnedNodes.filter(n => n.key === key)[0];
      let activeNode: IActiveNode;

      // This node is a pinned node
      if (pinnedNode) {
        pinnedNode.selected = true;
      } else {
        // If it is different than the active node, then switch to it
        if (!this.currentState.activeNode || this.currentState.activeNode.key !== key) {
          // It isn't
          activeNode = {
            key,
            selected: false,
            color: 'red'
          };
        }
        // otherwise it defaults to nothing
      }

      // Update the selected state of the toggle pin
      togglePin.selected = pinnedNodes.every(n => n.selected);

      const newState = this.mergeChanges(this.currentState, { selectedSection: 'All', pinnedNodes, togglePin, activeNode });

      this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
      this.setCurrentStateAndSave(newState);
      this.resetScroll();
      this.onUpdateState(newState);
    }
  }

  /**
   * Called on selection of a selected item, toggling selection off
   */
   @autobind
   public handleSelectedItemSelection(key: string): void {
    if (key && this.chartData.keyToNode.has(key)) {
      // Make a copy, so we don't mutate
      const pinnedNodes = (this.currentState.pinnedNodes || []).slice(0);
      const togglePin = this.currentState.togglePin;
      const pinnedNode = pinnedNodes.filter(n => n.key === key)[0];

      if (pinnedNode) {
        // If we clicked on an already selected item, and it was a pinned node, then deselect it
        pinnedNode.selected = !pinnedNode.selected;
      }

      // Update the selected state of the toggle pin
      togglePin.selected = pinnedNodes.every(n => n.selected);

      const newState = this.mergeChanges(this.currentState, { selectedSection: 'All', pinnedNodes, togglePin, activeNode: null });
      this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
      this.setCurrentStateAndSave(newState);

      this.onUpdateState(newState);
    }
  }

  /**
   * Called when a pin is clicked on
   */
   @autobind
   public handlePinClick(key: string): void {
    // Make a copy, so we don't mutate
    const pinnedNodes = (this.currentState.pinnedNodes || []).slice(0);
    const togglePin = this.currentState.togglePin;
    const isTogglePin = key === StyleConstants.TOGGLE_ALL_LABEL;
    const matchingNodes = pinnedNodes.filter(n => isTogglePin || n.key === key);

    // Toggle the selected state of the matching nodes
    matchingNodes.forEach(n => {
      n.selected = isTogglePin ? !togglePin.selected : !n.selected;
    });

    // The toggle pin was clicked on, so toggle it's selected value
    if (isTogglePin) {
      togglePin.selected = !togglePin.selected;
    } else {
      togglePin.selected = pinnedNodes.every(n => n.selected);
    }

    const newState = this.mergeChanges(this.currentState, { selectedSection: 'All', pinnedNodes, togglePin });
    this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
    this.setCurrentStateAndSave(newState);
    this.resetScroll();

    this.onUpdateState(newState);
  }

  /**
   * Called on selection of a list item's pin icon, toggling its pin status
   */
   @autobind
   public handleItemPinSelection(key: string): void {
    if (key && this.chartData.keyToNode.has(key)) {
      const pinnedNodes = (this.currentState.pinnedNodes || []).slice(0);
      const togglePin = this.currentState.togglePin;
      const pinnedNode = pinnedNodes.filter(n => n.key === key)[0];
      let activeNode = this.currentState.activeNode;
      // This node has already been pinned
      if (pinnedNode) {

        // It is, so remove it from pinned nodes
        pinnedNodes.splice(pinnedNodes.indexOf(pinnedNode), 1);
      }
      else if (activeNode && activeNode.key === key) {
        // It is the active node, so pin it selected and remove the active node
        pinnedNodes.push({
          key,
          selected: true,

          // This gets set later
          color: '',
        });
        activeNode = null;
      }
      else {

        // It is a listed node, so pin but don't select
        pinnedNodes.push({
          key,
          selected: false,

          // This gets set later
          color: '',
        });
      }

      // Update the selected state of the toggle pin
      togglePin.selected = pinnedNodes.every(n => n.selected);

      const newState = this.mergeChanges(this.currentState, { pinnedNodes, activeNode, togglePin });
      this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
      this.setCurrentStateAndSave(newState);

      this.onUpdateState(newState);
    }
  }

  /**
   * Called on selection of the icon of a pin, removing its pin status
   */
   @autobind
   public handlePinClear(key: string): void {
    let pinnedNodes = (this.currentState.pinnedNodes || []).slice(0);
    const isTogglePin = key === StyleConstants.TOGGLE_ALL_LABEL;

    // The ALL pin was clicked on, so clear all the pinned nodes
    if (isTogglePin) {
      pinnedNodes = [];
    } else {
      const pinnedNode = pinnedNodes.filter(n => n.key === key)[0];

      // This node has already been pinned
      if (pinnedNode) {
        // Alright, remove it
        pinnedNodes.splice(pinnedNodes.indexOf(pinnedNode), 1);
      }
    }

    const newState = this.mergeChanges(this.currentState, { selectedSection: 'All', pinnedNodes });
    this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
    this.setCurrentStateAndSave(newState);
    this.resetScroll();

    this.onUpdateState(newState);
  }

  /**
   * Called on selection of the counting button, switching between counting occurrences and
   * cooccurrences
   */
   @autobind
   public handleDataViewOptionChange(viewOption: string): void {
    const options = getDataViewOptions(
      this.chartData.dataFormat,
      this.chartData.attributeSequence.length > 0,
      this.settings.configuration.enablePinning
    );
    const viewLabel = options[(options.indexOf(viewOption) + 1) % options.length];
    const format = this.chartData.dataFormat;
    const view = (
      viewLabel === StyleConstants.ATTRIBUTES_LABEL && (format === DataFormat.RANKED_VALUES || format === DataFormat.RANKED_LABELS)
    ) ? DataView.RANKED_ATTRIBUTES
      : (viewLabel === StyleConstants.ATTRIBUTES_LABEL && format === DataFormat.IMPLICIT_LINKS)
        ? DataView.IMPLICIT_ATTRIBUTES
        : (viewLabel === StyleConstants.ATTRIBUTES_LABEL && format === DataFormat.EXPLICIT_LINKS)
          ? DataView.EXPLICIT_ATTRIBUTES
          : viewLabel;
    this.resetScroll();
    const newState = this.mergeChanges(this.currentState, { selectedSection: 'All', view });
    this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
    this.setCurrentStateAndSave(newState);
    this.onUpdateState(newState);
  }

  /**
   * Allows attribute weights to be incremented/decremented by StyleConstants.WEIGHT_DELTA
   */
   @autobind
   public handleAttributeWeightChange(attribute: string, increase: boolean): void {
    const delta = this.settings.configuration.attributeWeightDelta * (increase ? 1 : -1);
    const newState = this.mergeChanges(this.currentState, {});
    const prevWeight = newState.attributeWeights[attribute];
    newState.attributeWeights[attribute] = (prevWeight === undefined ? 1 : prevWeight) + delta;
    this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
    this.setCurrentStateAndSave(newState);
    this.onUpdateState(newState);
  }

  /**
   * Loads the given state
   * @param chartData The current chart data
   * @param state The state to load
   */
  public loadState(settings: VisualSettings, chartData: IChartData, state: IChartState) {
    this.chartData = chartData;
    this.settings = settings;

    state = state || {} as any;
    const newState = this.updateLoadedState(chartData, state);
    this.generateWeightsAndApplySelections(this.chartData, this.settings, newState);
    this.setCurrentStateAndSave(newState, false);
    this.onUpdateState(newState);
  }

  /**
   * Computes all weights to render given the current chart data, settings, and selection state
   * @param chartData The current chart data
   * @param settings The current settings
   * @param state The current state
   */
  public generateWeightsAndApplySelections(
    chartData: IChartData,
    settings: VisualSettings,
    state: IChartState,
  ): void {
    this.setPinColors(settings, chartData, state);

    const { pinnedNodes, activeNode, view } = state;

    const keyToNode = chartData.keyToNode;
    const activeNodes = pinnedNodes.filter(p => p.selected);

    if (activeNode) {
      activeNodes.push(activeNode);
    }
    const selectedNodes = activeNodes.map(n => keyToNode.get(n.key)).filter(x => x !== undefined);

    const nodeColors = new Map<string, string>();
    activeNodes.forEach(n => {
      nodeColors.set(n.key, n.color);
    });

    this.allWeights = this.weightGenerator.getWeights(
      settings,
      state,
      chartData,
      selectedNodes,
      isCountingCooccurrences(view),
      isOutboundLinks(view),
      settings.configuration.showRelated,
      nodeColors
    );
  }

  // Private helper methods

 /**
   * Assigns pin colors based on pin sequence and settings.styling
   */
  private setPinColors(settings: VisualSettings, chartData: IChartData, state: IChartState): void {
    const {
      bookmarkColor,
      bookmarkLightness,
    } = settings.configuration;
    state.pinnedNodes.forEach((p, i) => {
      if (chartData.keyToNode.has(p.key)) {
        p.color = getPinColor(
          bookmarkColor,
          StyleConstants.BOOKMARK_SATURATION,
          bookmarkLightness,
          StyleConstants.BOOKMARK_HUE_DELTA,
          i
        );
      }
    });

    if (state.activeNode) {
      state.activeNode.color = getPinColor(
        bookmarkColor,
        StyleConstants.BOOKMARK_SATURATION,
        bookmarkLightness,
        StyleConstants.BOOKMARK_HUE_DELTA,
        state.pinnedNodes.length
      );
    }
  }

  /**
   * Saves the current React state to Power BI through host.persistProperties and adds the
   * state to the history stack
   */
  private setCurrentStateAndSave(stateToSave: IChartState, emitEvent = true): void {
    if (this.history.length > 0 &&
      deepCompare(stateToSave, this.history[this.history.length - 1])) {
      return;
    }
    const stateString = stringify(stateToSave);
    if (this.history.length === 0) {
      this.history.push(stateString);
      this.historyIndex = 0;
    }
    else if (stateString !== this.history[this.historyIndex]) {
      this.history.push(stateString);
      this.historyIndex = this.history.length - 1;
    }
    else if (this.historyIndex < this.history.length - 1) {
      this.historyIndex += 1;
    }

    this.currentState = stateToSave;

    if (emitEvent) {
      this.onSaveState(stateToSave);
    }
  }

  /**
   * Sync loaded state with current styling and rebind event handlers
   */
  private updateLoadedState(chartData: IChartData, loadedState: IChartState): IChartState {
    const { attributeSequence = [] } = chartData;
    const {
      attributeWeights = {},
      pinnedNodes = [],
    } = (loadedState || {} as IChartState);

    const newState: IChartState = {
      ...loadedState,

      // Make sure the weights match what is currently loaded, copy over weights for the same attributes
      attributeWeights:
        attributeSequence
          .reduce((a, n) => {
            const oldVal = attributeWeights[n];
            a[n] = oldVal !== undefined ? attributeWeights[n] : 1;
            return a;
          }, {}),

      // Copy the pins that still exist in the data
      pinnedNodes: pinnedNodes.filter(p => chartData.keyToNode.has(p.key)),
      activeNode: loadedState.activeNode
    };
    return newState;
  }

  /**
   * Do not remove pins on undo as they allow accumulation of important discoveries.
   * Simply unselect them and rely on manual deletion if desired.
   */
  private retainPins(fromState: IChartState, toState: IChartState): void {
    fromState.pinnedNodes.forEach(from => {
      const hasMatch = toState.pinnedNodes.filter(to => to.key === from.key).length > 0;
      if (!hasMatch) {
        toState.pinnedNodes.push({
          ...from,
          selected: false
        });
      }
    });
    if (toState.activeNode && toState.pinnedNodes.map(x => x.key).includes(toState.activeNode.key)) {
      toState.pinnedNodes.filter(x => x.key === toState.activeNode.key)[0].selected = true;
      toState.activeNode = null;
    }
  }

  /**
   * Reset the scroll position of the item list to the top
   */
  private resetScroll(): void {
    // janky
    this.onResetScroll();
  }

  /**
   * Merges the given changes into the state, and returns a new state
   * @param state The state to merge changes into
   * @param changes The changes to merge
   */
  private mergeChanges(state: IChartState, changes): IChartState {
    const newState: IChartState = {
      ...state,
      ...changes,
    };
    return newState;
  }
}
