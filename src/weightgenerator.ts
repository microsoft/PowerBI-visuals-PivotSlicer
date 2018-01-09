import {
  IChartData,
  INode,
  IAllWeights,
  IWeight,
  DataFormat,
  IChartState,
  DataView,
  IActiveNode,
} from './interfaces';
import {
  sumMapOfMaps,
  splitKey,
  mapOfMapsToL2Keys,
  addKeysToSet,
  getPinColor,
  isAttribute,
  buildColumnTarget
} from './utils';
import { StyleConstants } from './styleconstants';
import { VisualSettings } from './settings';

/**
 * Generates node weights based on the selected nodes and approaches to node listing/counting
 */
export default class WeightGenerator {

  /**
   * Performs the high-level steps of generating weights for items and categories and ranking
   * them accordingly
   */
  public getWeights(
    settings: VisualSettings,
    chartState: IChartState,
    chartData: IChartData,
    selectedNodes: INode[],
    countingCooccurrences: boolean,
    outboundLinks: boolean,
    showRelated: boolean,
    nodeColors: Map<string, string>): IAllWeights {
    const attributeColors = new Map<string, string>();
    chartData.attributeSequence.forEach((attribute, index) => {
      const color = getPinColor(
        settings.configuration.bookmarkColor,
        StyleConstants.ATTRIBUTE_SATURATION,
        settings.configuration.bookmarkLightness,
        StyleConstants.ATTRIBUTE_HUE_DELTA,
        -index
      );
      attributeColors.set(attribute, color);
    });

    const familyInfo = this.processNodeFamilies(chartData.dataFormat, outboundLinks, selectedNodes);
    const allWeights: IAllWeights = {
      sectionOrder: [],
      sectionWeights: new Map<string, IWeight>(),
      sectionMaxItemWeights: new Map<string, number>(),
      maxSectionWeight: 0,
      nodeTypeToItemWeights: new Map<string, IWeight[]>(),
      selectedItemWeights: [],
      ...(familyInfo),
    };

    // TODO: Try to make these not mutate objects, make them pure functions
    this.generateItemAndCategoryWeights(chartState, chartData, outboundLinks, allWeights,
      selectedNodes, countingCooccurrences, showRelated, attributeColors, nodeColors);
    this.generateSelectedWeights(chartState, chartData, outboundLinks, allWeights,
      selectedNodes, countingCooccurrences, nodeColors);


    const sectionOrder = this.sortItemsAndCategories(
      allWeights.nodeTypeToItemWeights,
      allWeights.sectionWeights,
      isAttribute(chartState.view),
      settings.configuration.sectionOrder);

    return {
      ...allWeights,
      sectionOrder,
    };
  }

  /**
   * Calls the appropriate weight-generating function based on the specified approaches to
   * listing and counting, as well as the number of selected nodes
   */
  private generateItemAndCategoryWeights(
    chartState: IChartState,
    chartData: IChartData,
    outboundLinks: boolean,
    allWeights: IAllWeights,
    selectedNodes: INode[],
    countingCooccurrences: boolean,
    showRelated: boolean,
    attributeColors: Map<string, string>,
    nodeColors: Map<string, string>): void {
    if (chartData.attributeSequence.length > 0 && isAttribute(chartState.view)) {
      this.generateWeightsForTopAttributes(chartState, chartData, allWeights, attributeColors);
    }
    else if (
      selectedNodes.length === 0
      || chartData.dataFormat === DataFormat.RANKED_LABELS
      || chartData.dataFormat === DataFormat.RANKED_VALUES
      || !showRelated
    ) {
      this.generateWeightsForTopOccurrences(
        chartData, outboundLinks, allWeights, selectedNodes, nodeColors);
    }
    else {
      if (countingCooccurrences) {
        this.generateWeightsForRelatedCooccurrences(
          chartData, outboundLinks, allWeights, selectedNodes, nodeColors);
      }
      else {
        this.generateWeightsForRelatedOccurrences(chartData, outboundLinks, allWeights,
          selectedNodes, nodeColors);
      }
    }
  }

  /**
   * Lists nodes related to selections through cooccurrence with all selections
   */
  private generateWeightsForRelatedCooccurrences(
    chartData: IChartData,
    outboundLinks: boolean,
    allWeights: IAllWeights,
    selectedNodes: INode[],
    nodeColors: Map<string, string>): void {
    if (selectedNodes.length === 0) {
      return;
    }
    const explicitLinks = chartData.dataFormat === DataFormat.EXPLICIT_LINKS;
    const implicitLinks = chartData.dataFormat === DataFormat.IMPLICIT_LINKS;
    const toReduce = (outboundLinks)
      ? selectedNodes[0].linkedNodeTypeToOutboundKeysAndWeights
      : selectedNodes[0].linkedNodeTypeToInboundKeysAndWeights;
    const initialLinks = (explicitLinks)
      ? mapOfMapsToL2Keys(toReduce)
      : new Set<string>();
    const mutualLinks = (explicitLinks)
      ? selectedNodes.reduce((pv, cv) => {
        const toReduceNext = (outboundLinks)
          ? cv.linkedNodeTypeToOutboundKeysAndWeights
          : cv.linkedNodeTypeToInboundKeysAndWeights;
        return addKeysToSet(pv, toReduceNext);
      }, initialLinks)
      : new Set<string>();
    const selectedNodeColors = new Map<string, string>();
    const selectedNodeWeights = new Map<string, number>();
    selectedNodes.forEach(node => {
      selectedNodeColors.set(node.nodeKey, nodeColors.get(node.nodeKey));
      selectedNodeWeights.set(node.nodeKey, 0);
    });
    const selectedMutualDocs = selectedNodes.reduce((pv, cv) => {
      return new Set<string>(Array.from(pv).filter(
        x => cv.linkingObjects.has(x)));
    }, selectedNodes[0].linkingObjects);
    const selectedNodeToCategoryWeight = new Map<INode, number>();
    selectedNodes.forEach(n => {
      selectedNodeToCategoryWeight.set(n, 0);
    });
    Array.from(chartData.nodeTypeToNodes.keys()).forEach(nodeType => {
      allWeights.sectionMaxItemWeights.set(nodeType, 0);
      const nodeTypeWeight: IWeight = {
        targetKey: nodeType,
        weight: 0,
        displayLabel: '',
        components: selectedNodeWeights,
        colors: selectedNodeColors
      };
      const nodeTypeNodes = chartData.nodeTypeToNodes.get(nodeType);
      nodeTypeNodes.forEach(typeNode => {
        if (!allWeights.nodeTypeToItemWeights.has(nodeType)) {
          allWeights.nodeTypeToItemWeights.set(nodeType, []);
        }
        if (implicitLinks) {
          if (!selectedNodes.includes(typeNode)) {
            const targetMutualDocs = new Set<string>(Array.from(selectedMutualDocs)
              .filter(x => typeNode.linkingObjects.has(x)));
            const count = targetMutualDocs.size;
            if (count > 0) {
              nodeTypeWeight.weight += count;
              const targetWeight: IWeight = {
                targetKey: typeNode.nodeKey,
                weight: count,
                displayLabel: '',
                components: selectedNodeWeights,
                colors: selectedNodeColors
              };
              if (count > allWeights.sectionMaxItemWeights.get(nodeType)) {
                allWeights.sectionMaxItemWeights.set(nodeType, count);
              }
              allWeights.nodeTypeToItemWeights.get(nodeType).push(targetWeight);
            }
          }
        }
        else if (explicitLinks) {
          if (mutualLinks.has(typeNode.nodeKey)) {
            const targetWeight: IWeight = {
              targetKey: typeNode.nodeKey,
              weight: 0,
              displayLabel: '',
              components: new Map<string, number>(),
              colors: new Map<string, string>()
            };
            selectedNodes.forEach(countingNode => {
              const cont = (outboundLinks)
                ? countingNode.linkedNodeTypeToOutboundKeysAndWeights
                  .get(nodeType).get(typeNode.nodeKey)
                : countingNode.linkedNodeTypeToInboundKeysAndWeights
                  .get(nodeType).get(typeNode.nodeKey);
              targetWeight.weight += cont;
              targetWeight.components.set(countingNode.nodeKey, cont);
              const selectedNodeColor = nodeColors.get(countingNode.nodeKey);
              targetWeight.colors.set(countingNode.nodeKey, selectedNodeColor);
              selectedNodeToCategoryWeight.set(countingNode,
                selectedNodeToCategoryWeight.get(countingNode) + cont);
            });
            if (targetWeight.weight > 0) {
              if (targetWeight.weight >
                allWeights.sectionMaxItemWeights.get(nodeType)) {
                allWeights.sectionMaxItemWeights.set(nodeType,
                  targetWeight.weight);
              }
              allWeights.nodeTypeToItemWeights.get(nodeType).push(targetWeight);
            }
          }
        }
        else {
        }
      });
      selectedNodes.forEach(node => {
        const nodeCont = selectedNodeToCategoryWeight.get(node);
        nodeTypeWeight.weight += nodeCont;
        nodeTypeWeight.components.set(node.nodeKey, nodeCont);
        nodeTypeWeight.colors.set(node.nodeKey, selectedNodeColors.get(node.nodeKey));
      });
      if (nodeTypeWeight.weight > 0) {
        allWeights.sectionWeights.set(nodeType, nodeTypeWeight);
        if (nodeTypeWeight.weight > allWeights.maxSectionWeight) {
          allWeights.maxSectionWeight = nodeTypeWeight.weight;
        }
      }
    });
  }

  /**
   * Lists nodes related to selections through cooccurrence with any selection
   */
  private generateWeightsForRelatedOccurrences(
    chartData: IChartData,
    outboundLinks: boolean,
    allWeights: IAllWeights,
    selectedNodes: INode[],
    nodeColors: Map<string, string>): void {
    const explicitLinks = chartData.dataFormat === DataFormat.EXPLICIT_LINKS;
    const implicitLinks = chartData.dataFormat === DataFormat.IMPLICIT_LINKS;
    const allNodeTypes = new Set<string>();
    if (implicitLinks) {
      selectedNodes.forEach(node => {
        Array.from(node.linkedNodeTypeToNodesAndObjects.keys()).forEach(t => allNodeTypes.add(t));
      });
    }
    else if (explicitLinks) {
      if (outboundLinks) {
        selectedNodes.forEach(node => {
          Array.from(node.linkedNodeTypeToOutboundKeysAndWeights.keys())
            .forEach(t => allNodeTypes.add(t));
        });
      }
      else {
        selectedNodes.forEach(node => {
          Array.from(node.linkedNodeTypeToInboundKeysAndWeights.keys())
            .forEach(
              t => allNodeTypes.add(t));
        });
      }
    }
    else {
    }
    allNodeTypes.forEach(nodeType => {
      allWeights.sectionMaxItemWeights.set(nodeType, 0);
      const nodeTypeWeight: IWeight = {
        targetKey: nodeType,
        weight: 0,
        displayLabel: '',
        components: new Map<string, number>(),
        colors: new Map<string, string>()
      };
      const selectedNodeToNodeTypeWeight = new Map<INode, number>();
      const selectedNodeColors = new Map<string, string>();
      const nodeTypeTargets: string[] = [];
      selectedNodes.forEach(node => {
        selectedNodeToNodeTypeWeight.set(node, 0);
        const selectedNodeColor = nodeColors.get(node.nodeKey);
        selectedNodeColors.set(node.nodeKey, selectedNodeColor);
      });
      selectedNodes.forEach(node => {
        if (implicitLinks) {
          if (node.linkedNodeTypeToNodesAndObjects.has(nodeType)) {
            const targets = node.linkedNodeTypeToNodesAndObjects.get(nodeType);
            Array.from(targets.keys()).forEach(target => {
              if (!nodeTypeTargets.includes(target.nodeKey)) {
                nodeTypeTargets.push(target.nodeKey);
                const targetWeight: IWeight = {
                  targetKey: target.nodeKey,
                  weight: 0,
                  displayLabel: '',
                  components: new Map<string, number>(),
                  colors: new Map<string, string>()
                };
                selectedNodes.forEach(countingNode => {
                  if (countingNode.linkedNodeTypeToNodesAndObjects.has(nodeType)) {
                    if (countingNode.linkedNodeTypeToNodesAndObjects
                      .get(nodeType).has(target)) {
                      const nodeSum = countingNode
                        .linkedNodeTypeToNodesAndObjects.get(nodeType)
                        .get(target).size;
                      targetWeight.weight += nodeSum;
                      targetWeight.components.set(countingNode.nodeKey, nodeSum);
                      targetWeight.colors.set(
                        countingNode.nodeKey, selectedNodeColors.get(countingNode.nodeKey));
                      selectedNodeToNodeTypeWeight.set(countingNode,
                        selectedNodeToNodeTypeWeight.get(countingNode) + nodeSum);
                    }
                  }
                });
                if (targetWeight.weight > 0) {
                  if (targetWeight.weight >
                    allWeights.sectionMaxItemWeights.get(nodeType)) {
                    allWeights.sectionMaxItemWeights.set(nodeType,
                      targetWeight.weight);
                  }
                  if (!allWeights.nodeTypeToItemWeights.has(nodeType)) {
                    allWeights.nodeTypeToItemWeights.set(nodeType, []);
                  }
                  allWeights.nodeTypeToItemWeights.get(nodeType).push(targetWeight);
                }
              }
            });
          }
        }
        else if (explicitLinks) {
          const attributeToKeysAndWeights = (outboundLinks)
            ? node.linkedNodeTypeToOutboundKeysAndWeights
            : node.linkedNodeTypeToInboundKeysAndWeights;
          if (attributeToKeysAndWeights.has(nodeType)) {
            const targets = attributeToKeysAndWeights.get(nodeType);
            Array.from(targets.keys()).forEach(target => {
              if (!nodeTypeTargets.includes(target)) {
                nodeTypeTargets.push(target);
                const targetWeight: IWeight = {
                  targetKey: target,
                  weight: 0,
                  displayLabel: '',
                  components: new Map<string, number>(),
                  colors: new Map<string, string>()
                };
                selectedNodes.forEach(countingNode => {
                  const countingNodeMap = (outboundLinks)
                    ? countingNode.linkedNodeTypeToOutboundKeysAndWeights
                    : countingNode.linkedNodeTypeToInboundKeysAndWeights;
                  if (countingNodeMap.has(nodeType)) {
                    if (countingNodeMap.get(nodeType).has(target)) {
                      const nodeSum = countingNodeMap.get(nodeType).get(target);
                      targetWeight.weight += nodeSum;
                      targetWeight.components.set(countingNode.nodeKey, nodeSum);
                      targetWeight.colors.set(
                        countingNode.nodeKey, selectedNodeColors.get(countingNode.nodeKey));
                      selectedNodeToNodeTypeWeight.set(countingNode,
                        selectedNodeToNodeTypeWeight.get(countingNode) + nodeSum);
                    }
                  }
                });
                if (targetWeight.weight > 0) {
                  if (targetWeight.weight >
                    allWeights.sectionMaxItemWeights.get(nodeType)) {
                    allWeights.sectionMaxItemWeights.set(nodeType, targetWeight.weight);
                  }
                  if (!allWeights.nodeTypeToItemWeights.has(nodeType)) {
                    allWeights.nodeTypeToItemWeights.set(nodeType, []);
                  }
                  allWeights.nodeTypeToItemWeights.get(nodeType).push(targetWeight);
                }
              }
            });
          }
        }
      });
      selectedNodes.forEach(node => {
        const nodeCont = selectedNodeToNodeTypeWeight.get(node);
        nodeTypeWeight.weight += nodeCont;
        nodeTypeWeight.components.set(node.nodeKey, nodeCont);
        nodeTypeWeight.colors.set(node.nodeKey, selectedNodeColors.get(node.nodeKey));
      });
      if (nodeTypeWeight.weight > 0) {
        allWeights.sectionWeights.set(nodeType, nodeTypeWeight);
        if (nodeTypeWeight.weight > allWeights.maxSectionWeight) {
          allWeights.maxSectionWeight = nodeTypeWeight.weight;
        }
      }
    });
  }

  /**
   * Lists top nodes by descending occurrence frequency, showing counts of links from selected
   * nodes
   */
  private generateWeightsForTopOccurrences(
    chartData: IChartData,
    outboundLinks: boolean,
    allWeights: IAllWeights,
    selectedNodes: INode[],
    nodeColors: Map<string, string>): void {
    const explicitLinks = chartData.dataFormat === DataFormat.EXPLICIT_LINKS;
    const implicitLinks = chartData.dataFormat === DataFormat.IMPLICIT_LINKS;
    const selectedNodeColors = new Map<string, string>();
    selectedNodes.forEach(node => {
      const selectedNodeColor = nodeColors.get(node.nodeKey);
      selectedNodeColors.set(node.nodeKey, selectedNodeColor);
    });
    Array.from(chartData.nodeTypeToNodes.keys()).forEach(nodeType => {
      allWeights.sectionMaxItemWeights.set(nodeType, 0);
      const nodes = chartData.nodeTypeToNodes.get(nodeType);
      nodes.forEach(node => {
        if (!allWeights.nodeTypeToItemWeights.has(nodeType)) {
          allWeights.nodeTypeToItemWeights.set(nodeType, []);
        }
        const weight = calculateNodeWeight(node, chartData.dataFormat, outboundLinks);
        const itemWeight: IWeight = {
          targetKey: node.nodeKey,
          weight: weight,
          displayLabel: '',
          components: new Map<string, number>(),
          colors: new Map<string, string>()
        };
        if (selectedNodes.includes(node)) {
          itemWeight.components.set(node.nodeKey, weight);
          itemWeight.colors.set(node.nodeKey, selectedNodeColors.get(node.nodeKey));
        }
        if (
          chartData.dataFormat === DataFormat.RANKED_LABELS
          || chartData.dataFormat === DataFormat.RANKED_VALUES
          || weight > 0
        ) {
          if (itemWeight.weight > allWeights.sectionMaxItemWeights.get(nodeType)) {
            allWeights.sectionMaxItemWeights.set(nodeType, itemWeight.weight);
          }
          allWeights.nodeTypeToItemWeights.get(nodeType).push(itemWeight);
        }
      });
    });
    Array.from(allWeights.nodeTypeToItemWeights.keys()).forEach(nodeType => {
      const nodeTypeSum = allWeights.nodeTypeToItemWeights.get(nodeType).reduce(
        (pv, cv) => pv + cv.weight, 0);
      const nodeTypeWeight: IWeight = {
        targetKey: nodeType,
        weight: nodeTypeSum,
        displayLabel: '',
        components: new Map<string, number>(),
        colors: new Map<string, string>()
      };
      allWeights.sectionWeights.set(nodeType, nodeTypeWeight);
      if (nodeTypeWeight.weight > allWeights.maxSectionWeight) {
        allWeights.maxSectionWeight = nodeTypeWeight.weight;
      }
    });
  }

  /**
   * Lists top nodes by descending occurrence frequency, showing counts of links from selected
   * nodes
   */
  private generateWeightsForTopAttributes(
    chartState: IChartState,
    chartData: IChartData,
    allWeights: IAllWeights,
    attributeColors: Map<string, string>): void {
    if (chartData.attributeSequence.length > 0) {
      const maxAtts = new Map<string, number>();
      const minAtts = new Map<string, number>();
      chartData.attributeSequence.forEach(att => {
        const atts = Array.from(chartData.keyToNode.values()).map(v => {
          return (v.attributes.has(att))
            ? v.attributes.get(att)
            : null;
        });
        const min = atts.reduce((pv, cv) => {
          return (cv !== null)
            ? Math.min(pv, cv)
            : pv;
        }, Number.POSITIVE_INFINITY);
        minAtts.set(att, min);
        const max = atts.reduce((pv, cv) => {
          return (cv !== null)
            ? Math.max(pv, cv)
            : pv;
        }, Number.NEGATIVE_INFINITY);
        maxAtts.set(att, max);
      });
      Array.from(chartData.keyToNode.values()).forEach(node => {
        Array.from(node.attributes.keys()).forEach(attribute => {
          if (!allWeights.sectionMaxItemWeights.has(attribute)) {
            allWeights.sectionMaxItemWeights.set(attribute, 0);
          }
          if (!allWeights.nodeTypeToItemWeights.has(attribute)) {
            allWeights.nodeTypeToItemWeights.set(attribute, []);
          }
          const multiplier = (attribute === StyleConstants.COMBINED_ATTRIBUTES_LABEL)
            ? 1
            : chartState.attributeWeights[attribute];
          const displayWeight = (multiplier === 0)
            ? 0
            : node.attributes.get(attribute);
          const maxAtt = maxAtts.get(attribute);
          const minAtt = minAtts.get(attribute);
          const prop = (multiplier < 0)
            ? (maxAtt - displayWeight) / (maxAtt - minAtt)
            : 1 - ((maxAtt - displayWeight) / (maxAtt - minAtt));
          const weight = (isNaN(prop))
            ? 1
            : prop;
          const displayWeightLabel = (
            Math.round(displayWeight) - displayWeight === 0
            || (Math.abs(Math.round(displayWeight)
              - displayWeight)) / displayWeight < 0.01
          ) ? Math.round(displayWeight)
            : (displayWeight < 1)
              ? displayWeight.toPrecision(2)
              : displayWeight.toFixed(2);
          const overallLabel = (multiplier === 0)
            ? '-'
            : `${displayWeightLabel} (${weight.toFixed(2)})`;
          const itemWeight: IWeight = {
            targetKey: node.nodeKey,
            weight: weight,
            displayLabel: overallLabel,
            components: new Map<string, number>(),
            colors: new Map<string, string>()
          };
          itemWeight.components.set(attribute, weight);
          itemWeight.colors.set(attribute, attributeColors.get(attribute));
          if (weight > allWeights.sectionMaxItemWeights.get(attribute)) {
            allWeights.sectionMaxItemWeights.set(attribute, weight);
          }
          allWeights.nodeTypeToItemWeights.get(attribute).push(itemWeight);
        });
      });
      if (chartData.attributeSequence.length > 1) {
        allWeights.sectionMaxItemWeights.set(StyleConstants.COMBINED_ATTRIBUTES_LABEL, 0);
        allWeights.nodeTypeToItemWeights.set(StyleConstants.COMBINED_ATTRIBUTES_LABEL, []);
        Array.from(chartData.keyToNode.values()).forEach(node => {
          const weight: IWeight = {
            targetKey: node.nodeKey,
            weight: 0,
            displayLabel: '',
            components: new Map<string, number>(),
            colors: new Map<string, string>()
          };
          Array.from(node.attributes.keys()).forEach(attribute => {
            const multiplier = chartState.attributeWeights[attribute];
            const itemWeights = allWeights.nodeTypeToItemWeights.get(attribute);
            const value = allWeights.nodeTypeToItemWeights.get(attribute)
              .filter(w => w.targetKey === node.nodeKey)[0];
            const delta = Math.abs(multiplier) * value.weight;
            weight.weight += delta;
            weight.components.set(attribute, delta);
            weight.colors.set(attribute, attributeColors.get(attribute));
          });
          if (weight.weight > allWeights.sectionMaxItemWeights.get(
            StyleConstants.COMBINED_ATTRIBUTES_LABEL)) {
            allWeights.sectionMaxItemWeights.set(
              StyleConstants.COMBINED_ATTRIBUTES_LABEL, weight.weight);
          }
          allWeights.nodeTypeToItemWeights.get(
            StyleConstants.COMBINED_ATTRIBUTES_LABEL).push(weight);
        });
      }
    }
    Array.from(allWeights.nodeTypeToItemWeights.keys()).forEach(nodeType => {
      const nodeTypeSum = allWeights.nodeTypeToItemWeights.get(nodeType).reduce(
        (pv, cv) => pv + cv.weight, 0);
      const nodeTypeWeight: IWeight = {
        targetKey: nodeType,
        weight: nodeTypeSum,
        displayLabel: '',
        components: new Map<string, number>(),
        colors: new Map<string, string>()
      };
      allWeights.sectionWeights.set(nodeType, nodeTypeWeight);
      if (nodeTypeWeight.weight > allWeights.maxSectionWeight) {
        allWeights.maxSectionWeight = nodeTypeWeight.weight;
      }
    });
  }

  /**
   * Sorts items and categories in descending count order
   */
  private sortItemsAndCategories(
    nodeTypeToItemWeights: Map<string, IWeight[]>,
    sectionWeights: Map<string, IWeight>,
    isAttributes: boolean,
    orderSectionBy: string) {

    // Sort the item weights
    nodeTypeToItemWeights.forEach((val, nodeType, map) => {
      val = val.sort((a, b) => {
        const d = b.weight - a.weight;
        if (d === 0) {
          return (a.targetKey < b.targetKey) ? -1 : 1;
        }
        return d;
      });
      map.set(nodeType, val);
    });

    return Array.from(sectionWeights.entries()).sort((a, b) => {
      const [aKey, aWeight] = a;
      const [bKey, bWeight] = b;
      if (isAttributes) {
        if (aKey === StyleConstants.COMBINED_ATTRIBUTES_LABEL) {
          return -1;
        } else if (bKey === StyleConstants.COMBINED_ATTRIBUTES_LABEL) {
          return 1;
        }
      } else {
        if (orderSectionBy === 'Item Values') {
          return bWeight.weight - aWeight.weight;
        } else if (orderSectionBy === 'Item Counts') {
          return nodeTypeToItemWeights.get(bKey).length -
            nodeTypeToItemWeights.get(aKey).length;
        } else if (orderSectionBy === 'Section Names (Z-A, 9-0)') {
          return aKey < bKey ? 1 : -1;
        }
        return aKey < bKey ? -1 : 1;
      }
    }).map(n => n[0]);
  }

  /**
   * Generates weights for selected items
   */
  private generateSelectedWeights(
    chartState: IChartState,
    chartData: IChartData,
    outboundLinks: boolean,
    allWeights: IAllWeights,
    selectedNodes: INode[],
    countingCooccurrences: boolean,
    nodeColors: Map<string, string>): void {
    if (selectedNodes.length > 0) {
      const { attributeSequence } = chartData;

      const attributes = isAttribute(chartState.view);
      const explicitLinks = chartData.dataFormat === DataFormat.EXPLICIT_LINKS;
      const implicitLinks = chartData.dataFormat === DataFormat.IMPLICIT_LINKS;

      const mutualDocs = (implicitLinks && countingCooccurrences)
      ? selectedNodes.reduce((pv, cv) => {
        return new Set<string>(Array.from(pv).filter(
          x => cv.linkingObjects.has(x)));
      }, selectedNodes[0].linkingObjects)
      : new Set<string>();

      const getWeights = (node: INode) => outboundLinks
        ? node.linkedNodeTypeToOutboundKeysAndWeights
        : node.linkedNodeTypeToInboundKeysAndWeights;

      const toReduce = getWeights(selectedNodes[0]);

      const initialLinks = (explicitLinks && countingCooccurrences)
        ? mapOfMapsToL2Keys(toReduce)
        : new Set<string>();

      const mutualLinks = (explicitLinks && countingCooccurrences)
        ? selectedNodes.reduce((pv, cv) => {
            return new Set<string>(Array.from(pv).filter(
              x => mapOfMapsToL2Keys(getWeights(cv)).has(x)));
          }, initialLinks)
        : new Set<string>();

      const selectedNodeColors = new Map<string, string>();
      selectedNodes.forEach(node => {
        const selectedNodeColor = nodeColors.get(node.nodeKey);
        selectedNodeColors.set(node.nodeKey, selectedNodeColor);
      });
      const selectedItemWeights = selectedNodes.map(node => {
        const weight: IWeight = {
          targetKey: node.nodeKey,
          weight: 0,
          displayLabel: '',
          components: new Map<string, number>(),
          colors: new Map<string, string>()
        };
        if (attributes) {
          if (
            chartState.selectedSection !== 'All'
            && chartState.selectedSection !== StyleConstants.COMBINED_ATTRIBUTES_LABEL
          ) {
            return allWeights.nodeTypeToItemWeights.get(chartState.selectedSection)
              .filter(x => x.targetKey === node.nodeKey)[0];
          }
          else if (attributeSequence.length === 1) {
            const attribute = Array.from(node.attributes.keys())[0];
            return allWeights.nodeTypeToItemWeights.get(attribute)
              .filter(x => x.targetKey === node.nodeKey)[0];
          }
          else if (attributeSequence.length > 1) {
            return allWeights.nodeTypeToItemWeights.get(StyleConstants.COMBINED_ATTRIBUTES_LABEL)
              .filter(x => x.targetKey === node.nodeKey)[0];
          }
          return weight;
        }
        else {
          let delta: number;
          if (implicitLinks) {
            delta = !countingCooccurrences ? node.linkingObjects.size : mutualDocs.size;
          } else if (explicitLinks) {
            if (!countingCooccurrences) {
              delta = (outboundLinks)
                ? sumMapOfMaps(node.linkedNodeTypeToOutboundKeysAndWeights)
                : sumMapOfMaps(node.linkedNodeTypeToInboundKeysAndWeights);
            } else {
              delta = Array.from(mutualLinks).reduce((pv, cv) => {
                const weights = outboundLinks ?
                  node.linkedNodeTypeToOutboundKeysAndWeights :
                  node.linkedNodeTypeToInboundKeysAndWeights;
                const parts = splitKey(cv);
                const delta =
                  weights.has(parts[0]) && weights.get(parts[0]).has(cv) ?
                    weights.get(parts[0]).get(cv) : 0;
                return pv + delta;
              }, 0);
            }
          }
          weight.weight = delta;
          weight.components.set(node.nodeKey, delta);
          weight.colors.set(node.nodeKey, selectedNodeColors.get(node.nodeKey));
        }
        return weight;
      });
      selectedItemWeights.forEach(weight => {
        const color = nodeColors.get(weight.targetKey);
        weight.colors.set(weight.targetKey, color);
        allWeights.selectedItemWeights.push(weight);
      });
      allWeights.selectedItemWeights.sort((a, b) => {
        const d = b.weight - a.weight;
        if (d === 0) {
          return (a.targetKey < b.targetKey) ? -1 : 1;
        }
        return d;
      });
    }
  }

  /**
   * Generates and order weights for node families (same label, different categories)
   */
  private processNodeFamilies(
    dataFormat: DataFormat,
    outboundLinks: boolean,
    selectedNodes: INode[]
  ) {
    const uniqueSelected: Map<string, INode> = new Map<string, INode>();
    const nodeFamilyCategoryWeights = new Map<string, number>();
    const nodeFamilyItemWeights = new Map<string, IWeight[]>();
    const nodeFamilyOrder: string[] = [];

    selectedNodes.forEach(n => {
      uniqueSelected.set(n.nodeName, n);
    });

    // Go through each of the unique selected nodes
    uniqueSelected.forEach(selected => {
      const { nodeName, nodeFamily } = selected;

      if (nodeFamily.length > 1) {
        const weights = nodeFamily.map(n => ({
          targetKey: n.nodeKey,
          weight: calculateNodeWeight(n, dataFormat, outboundLinks),
          displayLabel: '',
          components: new Map<string, number>(),
          colors: new Map<string, string>()
        }));

        // Update the weights for the family
        nodeFamilyItemWeights.set(nodeName, weights);

        // The node type weight is just the sum of all of the individual node weights
        nodeFamilyCategoryWeights.set(nodeName, weights.reduce((pv, cv) => pv + cv.weight, 0));
        nodeFamilyOrder.push(nodeName);
      }
    });

    nodeFamilyOrder.sort((a, b) => {
      const d = nodeFamilyCategoryWeights.get(b) -
        nodeFamilyCategoryWeights.get(a);
      if (d === 0) {
        return (a < b) ? -1 : 1;
      }
      return d;
    });

    return {
      nodeFamilyCategoryWeights,
      nodeFamilyItemWeights,
      nodeFamilyOrder,
    };
  }
}

/**
 * Calculates the given nodes weight for the given data formt
 * @param format The data format
 * @param outboundLinks Whether or not outbound links are being used
 * @param node The node to get the weight for
 */
function calculateNodeWeight(node: INode, dataFormat: DataFormat, outboundLinks: boolean) {
    const explicitLinks = dataFormat === DataFormat.EXPLICIT_LINKS;
    const implicitLinks = dataFormat === DataFormat.IMPLICIT_LINKS;
    if (implicitLinks) {
      return node.linkingObjects.size;
    } else if (explicitLinks) {
      return sumMapOfMaps(outboundLinks ? node.linkedNodeTypeToOutboundKeysAndWeights : node.linkedNodeTypeToInboundKeysAndWeights);
    }
    return 0;
}