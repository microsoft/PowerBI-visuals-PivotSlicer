import * as React from 'react';
import { StyleConstants } from '../styleconstants';

/**
 * React props for node pins. State machine:
 * 1. Node unselected and unpinned
 * 1>2. Node is selected from a node list by clicking it
 * 2. Node selected and unpinned
 * 2>1. Node in selections list is unselecting by clicking it
 * 2>3. Node in selections list is pinned by clicking its empty pin icon
 * 3. Node selected and pinned
 * 3>1. Node pin is cleared by clicking the filled pin icon within the pin
 * 3>4. Node in pins list is unselected by clicking the body of the pin
 * 4. Node pinned and unselected
 * 4>1. Node pin is cleared by clicking the filled pin icon within the pin
 * 4>3. Unselected pin in pins list is selected by clicking the body of the pin
 */
export interface INodePinProps {
  id: string;
  label: string;
  color: string;
  selected: boolean;
  fontColor: string;
  fontSize: string;
  onClick: () => any;
  onClear: () => any;
}

/**
 * Template for node pins listed at the top of the UI
 */
export const NodePin: React.SFC<INodePinProps> = ({
  id,
  label,
  color,
  selected,
  fontColor,
  fontSize,
  onClick = () => {},
  onClear = () => {}
}) => (
  <div
    key={`${id}-${color}-Pin`}
    id={id}
    style={{
      display: 'flex',
      flexFlow: 'row',
      borderRadius: StyleConstants.PIN_BORDER_RADIUS + 'px',
      marginRight: StyleConstants.PIN_HORIZONTAL_SPACING + 'px',
      marginBottom: StyleConstants.PIN_VERTICAL_SPACING + 'px',
      fontSize: fontSize + 'pt',
      color: fontColor,
      border: `${StyleConstants.PIN_BORDER_WIDTH}px solid ${color}`,
      backgroundColor: (selected) ? color : 'transparent'
    }}
  >
    <div
      id={id}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        fontSize: fontSize + 'pt',
        color: fontColor,
        padding: StyleConstants.PIN_PADDING,
        fontFamily: 'roboto-regular-condensed'
      }}
    >
      {label.substr(0, StyleConstants.TRUNCATE_PIN_LABEL)}
    </div>
    <div
      id={id}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      style={{
        fontSize: fontSize + 'pt',
        color: fontColor,
        padding: '1pt 2pt 3pt 2pt'
      }}
    >
      <span
        id={id}
        className={StyleConstants.REMOVE}
        style={{
          fontFamily: 'FontAwesome',
        }}
      />
    </div>
  </div>
);