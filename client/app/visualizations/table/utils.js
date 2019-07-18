import { isNil, map, filter, each, sortBy, some, findIndex } from 'lodash';
import React from 'react';
import Icon from 'antd/lib/icon';

import initTextColumn from './columns/text';
import initNumberColumn from './columns/number';
import initDateTimeColumn from './columns/datetime';
import initBooleanColumn from './columns/boolean';
import initLinkColumn from './columns/link';
import initImageColumn from './columns/image';
import initJsonColumn from './columns/json';

// this map should contain all possible values for `column.displayAs` property
export const ColumnTypes = {
  string: initTextColumn,
  number: initNumberColumn,
  datetime: initDateTimeColumn,
  boolean: initBooleanColumn,
  link: initLinkColumn,
  image: initImageColumn,
  json: initJsonColumn,
};

function nextOrderByDirection(direction) {
  switch (direction) {
    case 'ascend': return 'descend';
    case 'descend': return null;
    default: return 'ascend';
  }
}

function toggleOrderBy(columnName, orderBy = [], multiColumnSort = false) {
  const index = findIndex(orderBy, i => i.name === columnName);
  const item = { name: columnName, direction: 'ascend' };
  if (index >= 0) {
    item.direction = nextOrderByDirection(orderBy[index].direction);
  }

  if (multiColumnSort) {
    if (!item.direction) {
      return filter(orderBy, i => i.name !== columnName);
    }
    if (index >= 0) {
      orderBy[index] = item;
    } else {
      orderBy.push(item);
    }
    return [...orderBy];
  }
  return item.direction ? [item] : [];
}

function getOrderByInfo(orderBy) {
  const result = {};
  each(orderBy, ({ name, direction }, index) => {
    result[name] = { direction, index: index + 1 };
  });
  return result;
}

export function prepareColumns(columns, searchInput, orderBy, onOrderByChange) {
  columns = filter(columns, 'visible');
  columns = sortBy(columns, 'order');

  const isMultiColumnSort = orderBy.length > 1;
  const orderByInfo = getOrderByInfo(orderBy);

  let tableColumns = map(columns, (column) => {
    const isAscend = orderByInfo[column.name] && (orderByInfo[column.name].direction === 'ascend');
    const isDescend = orderByInfo[column.name] && (orderByInfo[column.name].direction === 'descend');

    const result = {
      key: column.name, // set this because we don't use `dataIndex`
      // Column name may contain any characters (or be empty at all), therefore
      // we cannot use `dataIndex` because it has special syntax and will not work
      // for all possible column names. Instead, we'll generate row key dynamically
      // based on row index
      dataIndex: null,
      align: column.alignContent,
      title: (
        <React.Fragment>
          <div className={`d-flex align-items-center justify-content-${column.alignContent}`}>
            {isMultiColumnSort && orderByInfo[column.name] && (
              <span className="sort-column-order-indicator">{orderByInfo[column.name].index}</span>
            )}
            <span>{column.title}</span>
          </div>
          <div className="ant-table-column-sorter">
            <Icon
              className={`ant-table-column-sorter-up ${isAscend ? 'on' : 'off'}`}
              type="caret-up"
              theme="filled"
            />
            <Icon
              className={`ant-table-column-sorter-down ${isDescend ? 'on' : 'off'}`}
              type="caret-down"
              theme="filled"
            />
          </div>
        </React.Fragment>
      ),
      onHeaderCell: () => ({
        className: 'ant-table-column-has-actions ant-table-column-has-sorters',
        onClick: event => onOrderByChange(toggleOrderBy(column.name, orderBy, event.shiftKey)),
      }),
    };

    const initColumn = ColumnTypes[column.displayAs];
    const Component = initColumn(column);
    result.render = (unused, row) => ({
      children: <Component row={row} />,
      props: { className: `display-as-${column.displayAs}` },
    });

    return result;
  });

  tableColumns.push({
    key: '###Redash::Visualizations::Table::Spacer###',
    dataIndex: null,
    title: '',
    className: 'table-visualization-spacer',
    render: () => '',
    onHeaderCell: () => ({ className: 'table-visualization-spacer' }),
  });

  if (searchInput) {
    // We need a merged head cell through entire row. With Ant's Table the only way to do it
    // is to add a single child to every column move `dataIndex` property to it and set
    // `colSpan` to 0 for every child cell except of the 1st one - which should be expanded.
    tableColumns = map(tableColumns, ({ title, align, key, onHeaderCell, ...rest }, index) => ({
      key: key + '(parent)',
      title,
      align,
      onHeaderCell,
      children: [{
        ...rest,
        key: key + '(child)',
        align,
        colSpan: index === 0 ? tableColumns.length : 0,
        title: index === 0 ? searchInput : null,
      }],
    }));
  }

  return tableColumns;
}

export function filterRows(rows, searchTerm, searchColumns) {
  if ((searchTerm !== '') && (searchColumns.length > 0)) {
    searchTerm = searchTerm.toUpperCase();
    const matchFields = map(searchColumns, (column) => {
      const initColumn = ColumnTypes[column.displayAs];
      const { prepareData } = initColumn(column);
      return (row) => {
        const { text } = prepareData(row);
        return text.toUpperCase().indexOf(searchTerm) >= 0;
      };
    });

    return filter(rows, row => some(matchFields, match => match(row)));
  }
  return rows;
}

export function sortRows(rows, orderBy) {
  if ((orderBy.length === 0) || (rows.length === 0)) {
    return rows;
  }

  const directions = { ascend: 1, descend: -1 };

  // Create a copy of array before sorting, because .sort() will modify original array
  return [...rows].sort((a, b) => {
    let va;
    let vb;
    for (let i = 0; i < orderBy.length; i += 1) {
      va = a[orderBy[i].name];
      vb = b[orderBy[i].name];
      if (isNil(va) || va < vb) {
        // if a < b - we should return -1, but take in account direction
        return -1 * directions[orderBy[i].direction];
      }
      if (va > vb || isNil(vb)) {
        // if a > b - we should return 1, but take in account direction
        return 1 * directions[orderBy[i].direction];
      }
    }
    return 0;
  });
}