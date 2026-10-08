import CustomerGrid from './CustomerGrid';

/** The customer list, at /. */
export default function CustomerListView() {
  return (
    <main className="view">
      <h2>Customers</h2>
      <CustomerGrid />
    </main>
  );
}
