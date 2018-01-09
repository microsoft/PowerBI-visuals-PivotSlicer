/**
 * Constants used to construct labels and css for the UI
 */
export class StyleConstants {
  static readonly ITEM_PADDING: string = '5px';
  static readonly PIN_PADDING: string = '2px 2px 2px 2px';
  static readonly BOOKMARKED: string = 'fa-bookmark';
  static readonly UNBOOKMARKED: string = 'fa-bookmark-o';
  static readonly UNDO_BUTTON: string = 'fa fa-chevron-left';
  static readonly REDO_BUTTON: string = 'fa fa-chevron-right';
  static readonly SECTION_EXPANDED: string = 'fas fa-angle-down';
  static readonly SECTION_COLLAPSED: string = 'fas fa-angle-right';
  static readonly INCREASE_WEIGHT: string = 'fas fa-plus-square-o';
  static readonly DECREASE_WEIGHT: string = 'fas fa-minus-square-o';
  static readonly NEXT_OPTION: string = 'fas fa-angle-double-down';
  static readonly REMOVE: string = 'fas fa-times';
  static readonly MAX_SELECTIONS_HEIGHT: string = '40%';
  static readonly MAX_BAR_WIDTH: number = 80;
  static readonly BOOKMARK_HUE_DELTA: number = 29;
  static readonly BOOKMARK_SATURATION: number = 80;
  static readonly ATTRIBUTE_SATURATION: number = 40;
  static readonly ATTRIBUTE_HUE_DELTA: number = 53;
  static readonly PIN_BORDER_RADIUS: number = 4;
  static readonly PIN_BORDER_WIDTH: number = 2;
  static readonly PIN_HORIZONTAL_SPACING: number = 4;
  static readonly PIN_VERTICAL_SPACING: number = 3;
  static readonly TRUNCATE_PIN_LABEL: number = 50;
  static readonly HEADER_FONT_SIZE_MULTIPLIER = 1.2;
  static readonly SECTION_FONT_SIZE_MULTIPLIER = 1.1;
  static readonly SELECTED_LABEL = 'SELECTED';
  static readonly TOP_LABEL = 'TOP RANKED';
  static readonly RELATED_LABEL = 'RELATED TO SELECTIONS';
  static readonly SIMILAR_LABEL = 'SIMILAR TO SELECTIONS';
  static readonly TOGGLE_ALL_LABEL = 'ALL';
  static readonly DEFAULT_TYPE_LABEL = 'Item';
  static readonly ATTRIBUTES_LABEL = 'ATTRIBUTES';
  static readonly COMBINED_ATTRIBUTES_LABEL = 'combined sum';
}
