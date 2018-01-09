import * as React from 'react';
import { IRelatedHeaderProps } from '../interfaces';
import { StyleConstants } from '../styleconstants';

/**
 * Template for the section listing the current selections
 */
export const RelatedHeader: React.SFC<IRelatedHeaderProps> = (props) => (
  <div
    style={{
      padding: StyleConstants.ITEM_PADDING,
      fontSize: props.fontSize + 'pt',
      color: props.fontColor,
      backgroundColor: props.backgroundColor,
      fontFamily: 'roboto-regular-condensed'
    }}
  >
    {props.title}
  </div>
);