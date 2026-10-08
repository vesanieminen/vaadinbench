export const CUSTOMER_STATUSES = ['ACTIVE', 'PENDING', 'CLOSED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export type Customer = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  status: CustomerStatus;
};

export type SortProperty = 'id' | 'firstName' | 'lastName' | 'email' | 'country' | 'status';
export type Sort = { property: SortProperty; ascending: boolean };

/** What the list is narrowed down to. The backend does the matching. */
export type CustomerFilter = { name: string; statuses: CustomerStatus[] };

export const NO_FILTER: CustomerFilter = { name: '', statuses: [] };

const MAX_PAGE_SIZE = 200;
let everyone: Promise<Customer[]> | null = null;

/** The whole table, fetched once in pages the backend will serve. */
function allCustomers(): Promise<Customer[]> {
  everyone ??= (async () => {
    const rows: Customer[] = [];
    for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
      const response = await fetch(`/api/customers?offset=${offset}&limit=${MAX_PAGE_SIZE}`);
      const page: Customer[] = await response.json();
      rows.push(...page);
      if (page.length < MAX_PAGE_SIZE) return rows;
    }
  })();
  return everyone;
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function matching(rows: Customer[], filter: CustomerFilter) {
  const terms = fold(filter.name).trim().split(/\s+/).filter(Boolean);
  return rows.filter(
    (row) =>
      (filter.statuses.length === 0 || filter.statuses.includes(row.status)) &&
      terms.every((term) => fold(row.firstName).includes(term) || fold(row.lastName).includes(term)),
  );
}

export async function fetchCustomers(
  offset: number,
  limit: number,
  sorts: Sort[],
  filter: CustomerFilter = NO_FILTER,
): Promise<Customer[]> {
  const rows = matching(await allCustomers(), filter);
  const sorted = [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const order = String(a[sort.property]).localeCompare(String(b[sort.property]), undefined, {
        sensitivity: 'accent',
      });
      if (order !== 0) return sort.ascending ? order : -order;
    }
    return a.id - b.id;
  });
  return sorted.slice(offset, offset + limit);
}

export async function countCustomers(filter: CustomerFilter = NO_FILTER): Promise<number> {
  return matching(await allCustomers(), filter).length;
}
