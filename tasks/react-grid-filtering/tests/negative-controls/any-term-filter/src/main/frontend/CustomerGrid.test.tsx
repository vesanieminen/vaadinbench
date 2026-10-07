import { render, screen } from '@testing-library/react';
import CustomerGrid from './CustomerGrid';
import { NO_FILTER } from './api';

// An example component test. Run it with `npm test`.
//
// jsdom has no layout, so the virtualised body renders no rows here; the grid's
// structure and its conversation with the backend are what a test like this can
// check. fetch is stubbed, so no backend is needed.
describe('CustomerGrid', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/count') ? 500 : []))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports every customer in aria-rowcount, header row included', async () => {
    render(<CustomerGrid filter={NO_FILTER} />);

    expect(await screen.findByRole('grid')).toHaveAttribute('aria-rowcount', '501');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });
});
