import * as React from 'react';
import { BarSegments } from './barsegments';
import { ISectionProps } from '../interfaces';
import { StyleConstants } from '../styleconstants';
import { AttributeWeight } from './attributeWeight';

/**
 * The header defining a list of items with the same type or attribute
 */
export const SectionHeader: React.SFC<ISectionProps> = (props) => (
  <div
    key={`${props.section}-${props.count}-CategorySection`}
    onClick={(e) => {
      e.stopPropagation();
      if (props.handleSectionHeaderSelected) {
        props.handleSectionHeaderSelected();
      }
    }}
    id={props.section}
    style={{
      padding: StyleConstants.ITEM_PADDING,
      display: 'flex',
      flexDirection: 'row',
      fontSize: props.fontSize + 'pt',
      color: props.fontColor,
      backgroundColor: props.backgroundColor,
      fontFamily: 'roboto-regular-condensed'
    }}
  >
    <div
      style={{
        fontSize: props.fontSize + 'pt',
        color: props.fontColor,
        backgroundColor: props.backgroundColor,
        flexShrink: 1,
        flexGrow: 1,
        fontFamily: 'roboto-regular-condensed'
      }}
    >
      {`${props.section} (${props.count}) `}
      <span
        style={{fontFamily: 'FontAwesome'}}
        className={(props.isExpanded)
          ? StyleConstants.SECTION_EXPANDED
          : StyleConstants.SECTION_COLLAPSED}
      />
    </div>
    {(!props.showWeights && props.barSegments !== null)
      ? <BarSegments {...props.barSegments} />
      : (props.showWeights && props.attributeProps !== null)
        ? <AttributeWeight {...props.attributeProps} />
        : ''
    }
  </div>
);