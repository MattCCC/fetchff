// This is just a raw comparison benchmark for the `useFetcher` hook
// against the `useSWR` hook from the SWR library
// and against the `useQuery` hook from React Query.

// To run this benchmark, use the following command:
// npx tsx test/benchmarks/concurrent.bench.jsx
import { JSDOM } from 'jsdom';

// Setup jsdom environment before React & RTL imports
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.navigator = dom.window.navigator;
global.getComputedStyle = dom.window.getComputedStyle;
global.document.body.innerHTML = '<div id="root"></div>';

import React from 'react';
import Benchmark from 'benchmark';
import { onComplete } from './utils.mjs';
import useSWR from 'swr';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';

import { mockFetchResponse } from '../utils/mockFetchResponse';

import { useFetcher } from '../../src/react/index'; // Ensure this path is correct for your setup
// import { useFetcher } from '../../dist/react/index.mjs'; // Ensure this path is correct for your setup
import { cleanup, render, getByTestId, waitFor } from '@testing-library/react';

const RUNS = 100;
const fetcher = (url) => fetch(url).then((res) => res.json());

// Mock i different endpoints
for (let i = 0; i < RUNS; i++) {
  mockFetchResponse('/api/perf-' + i, {
    status: 200,
    ok: true,
    body: {
      userId: 1,
      id: i,
      title: 'Test Title',
      body: 'Test Body',
    },
  });
}

function ManySWRComponents() {
  const requests = Array.from({ length: RUNS }, (_, i) => {
    const response = useSWR('/api/perf-' + i, fetcher, {});

    return response;
  });

  return (
    <div data-testid="many-requests">
      {requests.filter((r) => r.data).length} loaded
    </div>
  );
}

function ManyReactQueryComponents() {
  const requests = Array.from({ length: RUNS }, (_, i) => {
    const response = useQuery({
      queryKey: ['/api/perf-' + i],
      queryFn: fetcher.bind(null, '/api/perf-' + i),
    });

    return response;
  });

  return (
    <div data-testid="many-requests">
      {requests.filter((r) => r.data).length} loaded
    </div>
  );
}

function ManyFetcherComponents() {
  const requests = Array.from({ length: RUNS }, (_, i) => {
    const response = useFetcher('/api/perf-' + i, {
      fetcher,
    });

    return response;
  });

  return (
    <div data-testid="many-requests">
      {requests.filter((r) => r.data).length} loaded
    </div>
  );
}

let fetcherCount = 0;
let swrCount = 0;
let reactQueryCount = 0;
const settings = {
  defer: true,
};

const fetcherBench = {
  ...settings,
  fn: async (deferred) => {
    const { container } = render(<ManyFetcherComponents />);
    await waitFor(async () => {
      const el = getByTestId(container, 'many-requests');
      fetcherCount += Number(el.textContent?.match(/\d+/)?.[0] || 0);
    });
    cleanup();
    deferred.resolve();
  },
};

const swrBench = {
  ...settings,
  fn: async (deferred) => {
    const { container } = render(<ManySWRComponents />);
    await waitFor(async () => {
      const el = getByTestId(container, 'many-requests');
      swrCount += Number(el?.textContent?.match(/\d+/)?.[0] || 0);
    });
    cleanup();
    deferred.resolve();
  },
};

const queryClient = new QueryClient();

const reactQueryBench = {
  ...settings,
  fn: async (deferred) => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ManyReactQueryComponents />
      </QueryClientProvider>,
    );
    await waitFor(async () => {
      const el = getByTestId(container, 'many-requests');
      reactQueryCount += Number(el?.textContent?.match(/\d+/)?.[0] || 0);
    });
    cleanup();
    deferred.resolve();
  },
};

const suite = new Benchmark.Suite();

suite
  .add('useFetcher (concurrent)', fetcherBench)
  .add('useSWR (concurrent)', swrBench)
  .add('useQuery (concurrent)', reactQueryBench)
  .on('start', function () {
    console.log(
      `Time for ${RUNS} concurrent requests (End-to-end data load, UI update, cache):`,
    );
  })
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    onComplete.call(this);
    console.log(
      `Total requests: ${RUNS}, useFetcher calls: ${fetcherCount}, useSWR calls: ${swrCount}, useQuery calls: ${reactQueryCount}`,
    );

    process.exit(0);
  })
  .run({ async: true });
