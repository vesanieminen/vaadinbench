import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  countCustomers,
  fetchCustomers,
  type Customer,
  type CustomerFilter,
  type Sort,
  type SortProperty,
} from './api';

/** Rows asked for in one request. */
const PAGE_SIZE = 50;
const ROW_HEIGHT = 36;

const COLUMNS: { key: SortProperty & keyof Customer; header: string }[] = [
  { key: 'firstName', header: 'First name' },
  { key: 'lastName', header: 'Last name' },
  { key: 'email', header: 'Email' },
  { key: 'country', header: 'Country' },
  { key: 'status', header: 'Status' },
];

/**
 * Lists customers in a lazily loaded, virtualised grid.
 *
 * The grid never holds the whole data set: it asks the backend for the total
 * row count, renders only the rows in view, and fetches the page of rows those
 * belong to when it first needs them. Clicking a column header sorts by that
 * column — ascending, then descending, then unsorted — and it is the backend
 * that sorts.
 *
 * It is an ARIA grid: `aria-rowcount` is the number of rows including the
 * header row, and every row carries its `aria-rowindex`, so assistive
 * technology knows where it is in a list most of which is not in the DOM.
 */
export default function CustomerGrid({
  filter,
  onCount,
}: {
  filter: CustomerFilter;
  onCount?: (count: number) => void;
}) {
  const [sort, setSort] = useState<Sort | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<Map<number, Customer[]>>(() => new Map());
  const requested = useRef(new Set<number>());
  const generation = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  // A new filter is a new row count, which is the backend's to say.
  useEffect(() => {
    let current = true;
    countCustomers(filter).then((count) => {
      if (!current) return;
      setTotal(count);
      onCount?.(count);
    });
    return () => {
      current = false;
    };
  }, [filter, onCount]);

  // A new filter or sort order invalidates every page fetched so far.
  useEffect(() => {
    generation.current++;
    requested.current = new Set();
    setPages(new Map());
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [sort, filter]);

  const virtualizer = useVirtualizer({
    count: total ?? 0,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const items = virtualizer.getVirtualItems();
  const first = items.length ? items[0].index : -1;
  const last = items.length ? items[items.length - 1].index : -1;

  useEffect(() => {
    if (first < 0) return;
    const current = generation.current;
    for (let page = Math.floor(first / PAGE_SIZE); page <= Math.floor(last / PAGE_SIZE); page++) {
      if (requested.current.has(page)) continue;
      requested.current.add(page);
      fetchCustomers(page * PAGE_SIZE, PAGE_SIZE, sort ? [sort] : [], filter).then((rows) => {
        if (current !== generation.current) return;
        setPages((loaded) => new Map(loaded).set(page, rows));
      });
    }
  }, [first, last, sort, filter]);

  function toggleSort(property: SortProperty) {
    setSort((current) => {
      if (current?.property !== property) return { property, ascending: true };
      return current.ascending ? { property, ascending: false } : null;
    });
  }

  function ariaSort(property: SortProperty) {
    if (sort?.property !== property) return 'none';
    return sort.ascending ? 'ascending' : 'descending';
  }

  return (
    <div role="grid" aria-label="Customers" aria-rowcount={total === null ? -1 : total + 1} className="grid">
      <div role="rowgroup">
        <div role="row" aria-rowindex={1} className="row header">
          {COLUMNS.map((column) => (
            <div role="columnheader" key={column.key} aria-sort={ariaSort(column.key)}>
              <button type="button" onClick={() => toggleSort(column.key)}>
                {column.header}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup" ref={scroller} className="body">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {items.map((item) => {
            const customer = pages.get(Math.floor(item.index / PAGE_SIZE))?.[item.index % PAGE_SIZE];
            return (
              <div
                role="row"
                key={item.key}
                aria-rowindex={item.index + 2}
                className="row"
                style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
              >
                {COLUMNS.map((column) => (
                  <div role="gridcell" key={column.key}>
                    {customer ? String(customer[column.key]) : ''}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
