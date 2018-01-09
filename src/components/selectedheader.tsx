import * as React from 'react';
import { ISelectedHeaderProps } from '../interfaces';
import { DataViewOptions } from './dataviewoptions';
import { StyleConstants } from '../styleconstants';

/**
 * Template for the section listing the current selections and providing button to alternate
 * between counting occurrences vs cooccurrences
 */
export const SelectedHeader: React.SFC<ISelectedHeaderProps> = (props) => (
  <div
    style={{
      padding: StyleConstants.ITEM_PADDING,
      flexGrow: 1,
      flexShrink: 1,
      display: 'flex',
      justifyContent: 'space-between',
      flexDirection: 'row',
      color: props.fontColor,
      backgroundColor: props.backgroundColor,
      fontFamily: 'roboto-bold-condensed',
      fontSize: props.fontSize,
    }}
  >
    <div
      style={{
        color: props.fontColor,
        fontSize: props.fontSize + 'pt',
        backgroundColor: props.backgroundColor,
        flexShrink: 1,
        flexGrow: 1,
        fontFamily: 'roboto-bold-condensed',
      }}
    >
      {(props.showTop) ? StyleConstants.TOP_LABEL : StyleConstants.SELECTED_LABEL}
    </div>
    {(props.showUndoButton)
    ? <div
        onClick={(e) => {
          e.stopPropagation();
          props.handleUndoButton();
        }}
        style={{
          paddingRight: StyleConstants.ITEM_PADDING,
          color: props.fontColor,
          fontSize: props.fontSize + 'pt',
          backgroundColor: props.backgroundColor,
          flexShrink: 0,
          flexGrow: 0
        }}>
        <span
          onClick={(e) => {
            e.stopPropagation();
            props.handleUndoButton();
          }}
          className={StyleConstants.UNDO_BUTTON}
          style={{fontFamily: 'FontAwesome'}}
        />
      </div>
    : <div
        style={{
          paddingRight: StyleConstants.ITEM_PADDING,
          color: props.backgroundColor,
          fontSize: props.fontSize + 'pt',
          backgroundColor: props.backgroundColor,
          flexShrink: 0,
          flexGrow: 0
        }}>
        <span
          className={StyleConstants.UNDO_BUTTON}
          style={{fontFamily: 'FontAwesome'}}
        />
      </div>
    }
    {(props.showRedoButton)
    ? <div
        onClick={(e) => {
          e.stopPropagation();
          props.handleRedoButton();
        }}
        style={{
          paddingRight: StyleConstants.ITEM_PADDING,
          color: props.fontColor,
          fontSize: props.fontSize + 'pt',
          backgroundColor: props.backgroundColor,
          flexShrink: 0,
          flexGrow: 0
        }}>
        <span
          onClick={(e) => {
            e.stopPropagation();
            props.handleRedoButton();
          }}
          className={StyleConstants.REDO_BUTTON}
          style={{fontFamily: 'FontAwesome'}}
        />
      </div>
    : <div
        style={{
          paddingRight: StyleConstants.ITEM_PADDING,
          color: props.backgroundColor,
          fontSize: props.fontSize + 'pt',
          backgroundColor: props.backgroundColor,
          flexShrink: 0,
          flexGrow: 0
        }}>
        <span
          className={StyleConstants.REDO_BUTTON}
          style={{fontFamily: 'FontAwesome'}}
        />
      </div>
    }
    <div
      style={{
        flexGrow: 0,
        flexShrink: 0,
        color: props.fontColor,
        fontSize: props.fontSize + 'pt',
        textAlign: 'right'
      }}
    />
    <div
      style={{
        flexBasis: props.barWidth + '%',
        position: 'relative',
        color: props.fontColor,
        fontSize: props.fontSize + 'pt',
        backgroundColor: props.backgroundColor,
        fontFamily: 'roboto-bold-condensed'
      }}
    >
      {(props.showLabel)
        ? <DataViewOptions {...props.dataViewOptions} />
        : ''
      }
    </div>
  </div>
);