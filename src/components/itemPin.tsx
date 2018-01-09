import * as React from 'react';
import { StyleConstants } from '../styleconstants';

export interface IItemPinProps {
    onSelected?: () => any;
    backgroundColor: string;
    color: string;
    fontSize: number;
    filled: boolean;
}

/**
 * Template for list items corresponding to nodes
 */
export const ItemPin: React.SFC<IItemPinProps> = ({
    onSelected = () => {},
    backgroundColor,
    color,
    fontSize,
    filled,
}: IItemPinProps) => (
    <div
        onClick={(e) => {
            e.stopPropagation();
            onSelected();
        }}
        style={{
            flexShrink: 0,
            flexGrow: 0,
            paddingLeft: StyleConstants.ITEM_PADDING,
            paddingRight: StyleConstants.ITEM_PADDING,
            color,
            fontSize: fontSize + 'pt',
            backgroundColor
        }}
    >
        <span
            style={{ fontFamily: 'FontAwesome' }}
            className={filled ? StyleConstants.BOOKMARKED : StyleConstants.UNBOOKMARKED}
        />
    </div>
);