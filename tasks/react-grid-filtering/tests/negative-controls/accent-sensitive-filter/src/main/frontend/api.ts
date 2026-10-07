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

function filterParams(filter: CustomerFilter, params = new URLSearchParams()) {
  if (filter.name.trim()) params.set('name', filter.name);
  if (filter.statuses.length) params.set('status', filter.statuses.join(','));
  return params;
}

/** One page of the matching customers. The backend refuses pages larger than 200 rows. */
export async function fetchCustomers(
  offset: number,
  limit: number,
  sorts: Sort[],
  filter: CustomerFilter = NO_FILTER,
): Promise<Customer[]> {
  const params = filterParams(filter, new URLSearchParams({ offset: String(offset), limit: String(limit) }));
  for (const sort of sorts) {
    params.append('sort', `${sort.property}:${sort.ascending ? 'asc' : 'desc'}`);
  }
  const response = await fetch(`/api/customers?${params}`);
  if (!response.ok) throw new Error(`Loading customers failed: ${response.status}`);
  return response.json();
}

/** The number of matching customers. */
export async function countCustomers(filter: CustomerFilter = NO_FILTER): Promise<number> {
  const response = await fetch(`/api/customers/count?${filterParams(filter)}`);
  if (!response.ok) throw new Error(`Counting customers failed: ${response.status}`);
  return response.json();
}
