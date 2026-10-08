import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import CustomerGrid from './CustomerGrid';
import { countCustomers, CUSTOMER_STATUSES, type CustomerFilter, type CustomerStatus } from './api';

function statusesFrom(param: string | null): CustomerStatus[] {
  const given = new Set((param ?? '').split(','));
  return CUSTOMER_STATUSES.filter((status) => given.has(status));
}

/** The customer list, at /, with a filter carried in the URL. */
export default function CustomerListView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState(() => searchParams.get('name') ?? '');
  const appliedName = name;
  const [statuses, setStatuses] = useState<CustomerStatus[]>(() => statusesFrom(searchParams.get('status')));
  const [matching, setMatching] = useState<number | null>(null);
  const [all, setAll] = useState<number | null>(null);

  useEffect(() => {
    countCustomers().then(setAll);
  }, []);


  const filter = useMemo<CustomerFilter>(() => ({ name: appliedName, statuses }), [appliedName, statuses]);

  // The address bar follows the applied filter, replacing the current history
  // entry rather than adding one, and only when it would actually change.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.name.trim()) params.set('name', filter.name);
    if (filter.statuses.length) params.set('status', filter.statuses.join(','));
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [filter, searchParams, setSearchParams]);

  function toggle(status: CustomerStatus, checked: boolean) {
    setStatuses((current) =>
      CUSTOMER_STATUSES.filter((s) => (s === status ? checked : current.includes(s))),
    );
  }

  return (
    <main className="view">
      <h2>Customers</h2>
      <div className="filters">
        <input
          type="text"
          aria-label="Name"
          placeholder="Filter by name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <fieldset>
          <legend>Status</legend>
          {CUSTOMER_STATUSES.map((status) => (
            <label key={status}>
              <input
                type="checkbox"
                checked={statuses.includes(status)}
                onChange={(event) => toggle(status, event.target.checked)}
              />
              {status}
            </label>
          ))}
        </fieldset>
      </div>
      {matching !== null && all !== null && (
        <span>
          Showing {matching} of {all}
        </span>
      )}
      <CustomerGrid filter={filter} onCount={setMatching} />
    </main>
  );
}
