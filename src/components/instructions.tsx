import * as React from 'react';

/**
 * Instructions shown before all data fields are bound
 */
export const instructions = (
  <div className='instructions-outer'>
    <div className='instructions-inner'>
      <div className='instruction-title'>Pivot Slicer</div>
      <div className='instruction'>
        Pivot Slicer provides a unified 'list of lists' approach to viewing, navigating, and slicing data. While regular slicers act on a single data dimension, Pivot Slicer enables dynamic pivoting over any combination of categorical data types, numerical data attributes, and linked data items. It can be used to create a wide range of slicers for different purposes, including stacking multiple slicers in a single compact visual, exploring data rankings resulting from weighted combinations of numerical attributes, and navigating the link structure of item hierarchies and networks. Items of interest can be pinned from any view for systematic comparison of atttibute values, link weights and linked items.
      </div>
      <div className='instruction-subtitle'>
        Creating a simple slicer
      </div>
      <div className='instruction'>
        Bind a text data column to the required <span className='instruction-bold'>Item</span> field to create an alphabetic item list. Selecting an item slices the Item column accordingly.
      </div>
      <div className='instruction-subtitle'>
        Stacking slicers of different item types
      </div>
      <div className='instruction'>
        Bind a text data column to <span className='instruction-bold'>Item Type</span> to stack multiple slicers, each showing the top N items of that type (Top Items Count configuration option). Selecting a slicer header expands the slicer to show more items (up to Max Items Count). Slicers are themselves ranked based on the Section Order option.
      </div>
      <div className='instruction-subtitle'>
        Linking items to numeric attribute values
      </div>
      <div className='instruction'>
        Bind one or more numeric data columns to <span className='instruction-bold'>Item Attributes</span> to create an ATTRIBUTES view in
        which items of all types are ranked by their attribute values (attribute labels are provided by bound column titles).
      </div>
      <div className='instruction-subtitle'>
        Linking items via linker objects
      </div>
      <div className='instruction'>
        Bind a text data column to <span className='instruction-bold'>Item Linker</span> to indicate that items are to be connected
        indirectly based on their relations to common objects (e.g., documents, entities, or events). Pairwise links are automatically created between all items connected to the same linker object. Selecting an item shows linked items under a RELATED TO SELECTIONS section (unless Show Related is deactivated). Switching between LINKS and JOINT LINKS views shows items related to any and all selections respectively, and slices to the corresponding item linkers accordingly.
      </div>
      <div className='instruction-subtitle'>
        Linking items via directed edges
      </div>
      <div className='instruction'>
        Bind a text data column to <span className='instruction-bold'>Linked Item</span> to indicate that items are to be connected directly. Bind a text data column to <span className='instruction-bold'>Linked Item Type</span> to specify the type of the linked item OR the link itself. Bind a numeric data column to <span className='instruction-bold'>Link Weight</span> to specify a weight for the directed link.
      </div>
      <div className='instruction-subtitle'>
        Dealing with items that have multiple types
      </div>
      <div className='instruction'>
        If the selected item has multiple item types, these will be listed in a SIMILAR TO SELECTIONS section below the RELATED TO SELECTIONS section. If the result set could exceed 500 rows, create a text data column combining item and item type, bind it to <span className='instruction-bold'>Item Filter Key</span>, and use this column for cross-filtering linked data tables.
      </div>
    </div>
  </div>
);
