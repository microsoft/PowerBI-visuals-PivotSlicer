import 'script-loader!powerbi-visuals-utils-typeutils/lib/index';

import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { stringify, isCountingCooccurrences, isOutboundLinks, isInboundLinks, splitKey, buildColumnTarget, mapOfMapsToL2Keys, addKeysToSet } from './utils';
import { IChartData, IActiveNode, INode, DataView, DataFormat, IChartState } from './interfaces';

/**
 * Manages filtering of linked visuals for PivotSlicerChart
 */
export class FilterManager {

  // Private members

  // The currently active selections
  private activeSelections: Set<ISelectionId> = null;

  // The currently applied filter
  private activeFilter: IBasicFilter = null;

  // Selections pending after a cleared filter
  public pendingSelections: Set<ISelectionId> = null;

  /**
   * Constructor
   */
  public constructor(private host: IVisualHost) {
  }

  /**
   * Applies selections from state
   */
  public applySelectionsFromState(pbiCols: powerbi.DataViewMetadataColumn[], state: IChartState, chartData: IChartData) {
    const explicitLinks = chartData.dataFormat === DataFormat.EXPLICIT_LINKS;
    const implicitLinks = chartData.dataFormat === DataFormat.IMPLICIT_LINKS;

    const { pinnedNodes, activeNode, view } = state;
    const { keyToNode, columns, objectToNodeTypesToSelections } = chartData;

    const activeNodes =
      pinnedNodes
        .filter(p => p.selected)
        .concat(activeNode ? [activeNode] : []);

    const selectedNodes =
      activeNodes
        .map(n => keyToNode.get(n.key));

    const sourceValueCol = columns.get('NODE');
    const sourceKeyCol = columns.get('FILTER_KEY');

    let filterColIdx: number;
    const selectionIds = new Set<ISelectionId>();
    let filter: IBasicFilter = null;

    const countingCooccurrences = isCountingCooccurrences(view);
    const outboundLinks = isOutboundLinks(view);
    const inboundLinks = isInboundLinks(view);

    // We're not counting coocurrences
    if (!countingCooccurrences) {
      const destValueCol = columns.get('LINKED_NODE');
      const destKeyCol = columns.get('LINKED_FILTER_KEY');
      if (explicitLinks) {
        filterColIdx = sourceValueCol;
        if (outboundLinks) {
          filterColIdx = sourceKeyCol >= 0 ? sourceKeyCol : sourceValueCol;
        } else if (inboundLinks) {
          filterColIdx = destKeyCol >= 0 ? destKeyCol : destValueCol;
        }
      } else {
        const hasMultipleCategories = selectedNodes.some((cv) => cv.nodeFamily.length > 1);
        if (hasMultipleCategories) {
          selectedNodes.forEach(node => {
            node.selectionIds.forEach(id => selectionIds.add(id));
          });
        } else {
          filterColIdx = (sourceKeyCol === -1)
            ? sourceValueCol
            : sourceKeyCol;
        }
      }

      // Do we even have a filterable column
      if (filterColIdx >= 0) {

        // Gets the correct filter value for the given pin based on the filter column
        const getFilterValue = (pin: IActiveNode) => {
          return (filterColIdx === sourceKeyCol || (explicitLinks && filterColIdx === destKeyCol)) ?
            keyToNode.get(pin.key).filterKey : splitKey(pin.key)[1];
        };

        // Map the pinned nodes & selected nodes to their filter value
        const values = activeNodes.map(pin => getFilterValue(pin));

        // We have some values to filter, then filter it
        if (values.length > 0) {
          // We really only need the table from this guy
          const { table } = buildColumnTarget(pbiCols[sourceValueCol]);

          filter = {
            $schema: 'http://powerbi.com/product/schema#basic',
            target: {
              table,
              column: pbiCols[filterColIdx].displayName
            },
            filterType: 1,
            operator: 'In',
            values
          };
        }
      }
    } else {

      let links = new Set<string>();
      if (explicitLinks) {

        // Gets the appropriate set of weights for the given node depending on whether or not
        // the user is viewing outbound links or inbound ones
        const getWeights = (node: INode) => outboundLinks
          ? node.linkedNodeTypeToOutboundKeysAndWeights
          : node.linkedNodeTypeToInboundKeysAndWeights;

        const getIds = (node: INode) => outboundLinks
          ? node.outboundSelectionIds
          : node.inboundSelectionIds;

        const initialLinks = (selectedNodes.length > 0)
          ? mapOfMapsToL2Keys(getWeights(selectedNodes[0]))
          : new Set<string>();

        links = selectedNodes.reduce((pv, cv) => addKeysToSet(pv, getWeights(cv)), initialLinks);

        selectedNodes.forEach(n => {
          links.forEach(link => {
            selectionIds.add(getIds(n).get(link));
          });
        });
      }
      else if (implicitLinks && selectedNodes.length > 0) {
        links = new Set<string>(selectedNodes[0].linkingObjects);
        selectedNodes.forEach((cv) => {
          links.forEach(doc => {
            if (!cv.linkingObjects.has(doc)) {
              links.delete(doc);
            }
          });
        });

        // Add both mutual docs and links to the selection ids
        links.forEach(link => {
          selectedNodes.forEach(att => {
            objectToNodeTypesToSelections
              .get(link)
              .get(att.nodeKey)
              .forEach((id) => {
                selectionIds.add(id);
              });
          });
        });
      }
    }
    const passIds = (filter === null)
      ? selectionIds
      : null;

    this.applySelections(passIds, filter);
  }

  /**
   * Applies selections from either the selection ids or filter generated by weight generator
   */
  public applySelections(
    selectionIdsToApply: Set<ISelectionId>,
    filterToApply: IBasicFilter,
  ): void {
    if (selectionIdsToApply !== null) {
      if (this.activeFilter !== null) {
        this.pendingSelections = selectionIdsToApply;
        this.sendFilterToHost(filterToApply);
      }
      else {
        this.sendSelectionsToHost(selectionIdsToApply);
      }
    }
    else {
      this.sendFilterToHost(filterToApply);
    }
  }

  /**
   * Apply any pending selections following removal of a filter
   */
  public applyPendingSelections(): void {
    if (this.pendingSelections !== null) {
      this.sendSelectionsToHost(this.pendingSelections);
      this.pendingSelections = null;
    }
  }

  /**
   * Sends the given filter to the host
   * @param filter The filter to send to the host
   */
  private sendFilterToHost(filter?: IBasicFilter) {
    // != important here
    if (filter != this.activeFilter) {
      const areFiltersEqual = stringify(filter || {}) === stringify(this.activeFilter || {});
      if (!areFiltersEqual) {
        let action = powerbi.FilterAction.remove;

        // Do we actually have filter values, then merge em.
        if (filter && filter.values && filter.values.length > 0) {
          action = powerbi.FilterAction.merge;
        }

        this.activeFilter = filter;
        this.host.applyJsonFilter(filter, 'general', 'filter', action);
      }
    }
  }

  /**
   * Sends the selected ids to the host
   * @param ids The ids to send
   */
  private sendSelectionsToHost(ids?: Set<ISelectionId>) {
    const oldSel = this.activeSelections;
    const newSel = ids;

    // Our selections have changed
    if (!areSetsEqual(oldSel, newSel)) {
      const selectionManager = this.host.createSelectionManager();

      // Update our set of active selections
      this.activeSelections = newSel;

      // We already had a previous selection, clear the selectionManager to start from scratch
      if (oldSel && oldSel.size > 0) {
        selectionManager.clear();
      }

      // Our new selection has something, so select it
      if (newSel && newSel.size) {
        selectionManager.select(Array.from(newSel), true);
      }
      selectionManager.applySelectionFilter();
    }
  }
}

/**
 * Determines if two sets are equal
 * @param set1 The first set to compare
 * @param set2 The second set to compare
 */
function areSetsEqual(set1: Set<any>, set2: Set<any>) {
  // The two equals is important here (null == undefined)
  if (set1 == set2) {
    return true;

  // One of these is undefined, they are not equal
  // Or their sizes differ
  } else if ((!set1 || !set2) || set1.size !== set2.size) {
    return false;
  } else {
    return Array.from(set1).every(n => set2.has(n));
  }
}