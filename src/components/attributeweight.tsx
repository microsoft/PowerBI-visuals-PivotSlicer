import * as React from 'react';
import { StyleConstants } from '../styleconstants';
import { IAttributeWeightProps } from '../interfaces';

/**
 * Shows the weight of an attribute type and controls for weight increment/decrement
 */
export const AttributeWeight: React.SFC<IAttributeWeightProps> = ({
  section,
  attributeWeight,
  fontColor,
  fontSize,
  handleAttributeOptionChanged = (() => {}) as any
}) => {
  return (
    <div onClick={
      (e) => { e.stopPropagation(); }
    }>
      weight: {attributeWeight}&nbsp;&nbsp;
      <span
        id={`${section}+`}
        onClick={(e: any) => {
          const id: string = e.target.id;
          e.stopPropagation();
          handleAttributeOptionChanged(section, true);
        }}
        className={StyleConstants.INCREASE_WEIGHT}
        style={{
          color: fontColor,
          fontSize: fontSize + 'pt',
          fontFamily: 'FontAwesome'
        }}
      />
      &nbsp;&nbsp;
      <span
        id={`${section}-`}
        onClick={(e: any) => {
          const id: string = e.target.id;
          e.stopPropagation();
          handleAttributeOptionChanged(section, false);
        }}
        className={StyleConstants.DECREASE_WEIGHT}
        style={{
          color: fontColor,
          fontSize: fontSize + 'pt',
          fontFamily: 'FontAwesome'
        }}
      />
    </div>
  );
};