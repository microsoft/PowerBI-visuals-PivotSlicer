import * as React from 'react';
import { IBarSegmentsProps } from '../interfaces';
import { StyleConstants } from '../styleconstants';

/**
 * Template for frequency bars used in both headings and list items. Bars are segmented and colored
 * by the associated selection, else follow settings.configuration.barColor
 */
export const BarSegments: React.SFC<IBarSegmentsProps> = props => {
  const segments = props.segments.map((segment, index) => {
    return (
      <div
        key={`${props.section}-${props.node}-${index}-BarSegments`}
        style={{
          flexBasis: props.isHorizontalSplit
            ? 100.0 / props.segments.length + '%'
            : 100.0 * segment.weight / segment.maxWeight + '%',
          flexShrink: 0,
          flexGrow: 0,
          background: props.isHorizontalSplit
            ? `linear-gradient(to right, ${props.backgroundColor}, ${segment.color} 50%)`
            : segment.color,
          color: props.fontColor,
          fontSize: props.fontSize + 'pt',
        }}
      />
    );
  });
  return (
    <div
      key={`${props.section}-${props.node}-${props.weight}-BarSegment`}
      style={{
        flexBasis: props.barWidth + '%',
        minWidth: props.barWidth + '%',
        maxWidth: props.barWidth + '%',
        flexShrink: 0,
        flexGrow: 0,
        display: 'flex',
        flexFlow: 'row',
        position: 'relative',
        zIndex: 0,
        fontSize: props.fontSize + 2 + 'pt',
      }}
    >
      <div
        style={{
          flexBasis: props.isHorizontalSplit
            ? 100.0 * props.weight / props.maxWeight + '%'
            : '100%',
          flexShrink: 0,
          flexGrow: 0,
          display: 'flex',
          flexFlow: props.isHorizontalSplit ? 'column' : 'row',
          position: 'relative',
          zIndex: 0,
        }}
      >
        {segments}
      </div>
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 1,
          paddingLeft: StyleConstants.ITEM_PADDING,
          paddingRight: StyleConstants.ITEM_PADDING,
          fontSize: props.fontSize + 'pt',
          fontColor: props.fontColor,
          backgroundColor: 'rgba(255,255,255,0)'
        }}
      >
        {(props.displayLabel !== '')
          ? props.displayLabel
          : (props.weight === undefined)
            ? ""
            : (
                Math.round(props.weight) - props.weight === 0
                || (Math.abs(Math.round(props.weight)
                    - props.weight)) / props.weight < 0.01
              )
              ? Math.round(props.weight)
              : (props.weight < 1)
                ? props.weight.toPrecision(2)
                : props.weight.toFixed(2)
        }
      </div>
    </div>
  );
};
