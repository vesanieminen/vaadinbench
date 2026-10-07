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

/** One page of customers. The backend refuses pages larger than 200 rows. */
export async function fetchCustomers(offset: number, limit: number, sorts: Sort[]): Promise<Customer[]> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  for (const sort of sorts) {
    params.append('sort', `${sort.property}:${sort.ascending ? 'asc' : 'desc'}`);
  }
  const response = await fetch(`/api/customers?${params}`);
  if (!response.ok) throw new Error(`Loading customers failed: ${response.status}`);
  return response.json();
}

/** The total number of customers. */
export async function countCustomers(): Promise<number> {
  const response = await fetch('/api/customers/count');
  if (!response.ok) throw new Error(`Counting customers failed: ${response.status}`);
  return response.json();
}
