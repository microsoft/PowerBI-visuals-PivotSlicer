import * as React from 'react';
import { IDataViewOptionsProps } from '../interfaces';
import { StyleConstants } from '../styleconstants';

/**
 * Template for buttons controlling listing and counting options in selected header
 */
export const DataViewOptions: React.SFC<IDataViewOptionsProps> = ({
  handleDataViewOptionChange = () => {},
  fontSize,
  fontColor,
  selectedOption,
  backgroundColor,
  options,
}) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      handleDataViewOptionChange(selectedOption);
    }}
    style={{
      flexGrow: 0,
      flexShrink: 0,
      fontSize: fontSize + 'pt !important',
      color: fontColor,
      textAlign: 'right',
      border: '0px !important',
      fontFamily: 'roboto-regular-condensed !important',
    }}
  >
    {selectedOption + ' '}
    <span
        style={{fontFamily: 'FontAwesome'}}
        className={StyleConstants.NEXT_OPTION}
      />
  </div>
);