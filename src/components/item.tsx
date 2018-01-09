import * as React from 'react';
import { IItemProps } from '../interfaces';
import { BarSegments } from './barsegments';
import { StyleConstants } from '../styleconstants';
import { ItemPin } from './itemPin';

/**
 * Template for list items corresponding to nodes
 */
export const Item: React.SFC<IItemProps> = ({
  fontColor,
  fontSize,
  backgroundColor,
  wrapText,
  itemSelected,
  nodeLabel,
  rank,
  enablePinning,
  pinColor,
  pinFilled,
  barSegments,
  handleItemSelected = () => { },
  handlePinIconSelected,
}) => (
    <div
      onClick={(e) => {
        e.stopPropagation();
        handleItemSelected();
      }}
      style={{
        padding: StyleConstants.ITEM_PADDING,
        display: 'flex',
        flexFlow: 'row',
        fontSize: fontSize + 'pt',
        color: fontColor,
        backgroundColor: backgroundColor
      }}
    >
      <div
        style={{
          flexGrow: 1,
          flexShrink: 1,
          wordWrap: 'break-word',
          textOverflow: (wrapText)
            ? 'inherit'
            : 'ellipsis',
          fontSize: fontSize + 'pt',
          color: fontColor,
          backgroundColor: backgroundColor,
          overflow: (wrapText)
            ? 'inherit'
            : 'hidden',
          whiteSpace: (wrapText)
            ? 'inherit'
            : 'nowrap',
          fontFamily: (itemSelected)
            ? 'roboto-regular-condensed'
            : 'roboto-light'
        }}
      >
        {(itemSelected)
          ? nodeLabel
          : rank + '. ' + nodeLabel}
      </div>
      {enablePinning ?
        <ItemPin
          onSelected={handlePinIconSelected}
          fontSize={fontSize}
          color={pinColor}
          filled={pinFilled}
          backgroundColor={backgroundColor} /> :
        null}
      <BarSegments {...barSegments} />
    </div>
  );