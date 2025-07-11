// This is just a raw comparison benchmark for the `useFetcher` hook
// against the `useQuery` hook from React Query (cold starts).

// To run this benchmark, use the following command:
// npx tsx test/benchmarks/rq.bench.jsx
import { JSDOM } from 'jsdom';
import React from 'react';

// Setup jsdom environment before React & RTL imports
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

import Benchmark from 'benchmark';
import { onComplete } from './utils.mjs';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';

import { useFetcher } from '../../src/react/index'; // Ensure this path is correct for your setup
import { act, cleanup, render } from '@testing-library/react';

// Mock fetch response before running benchmarks
global.fetch = () =>
  // @ts-expect-error This is a mock implementation
  Promise.resolve({
    status: 200,
    ok: true,
    body: {
      userId: 1,
      id: 1,
      title: 'Test Title',
      body: 'Test Body',
    },
  });
const fetcher = (url) => fetch(url).then(async (res) => await res.json());
let j = 0;
let k = 0;

function FetcherComponent() {
  j++;
  const { data } = useFetcher('https://localhost/posts/' + j, { fetcher });
  return <div data-testid="many-requests">{data} loaded</div>;
}

function ReactQueryComponent() {
  k++;
  const { data } = useQuery({
    queryKey: [`https://localhost/posts/${k}`],
    queryFn: fetcher.bind(null, 'https://localhost/posts/' + k),
  });
  return <div data-testid="many-requests">{data} loaded</div>;
}

const suite = new Benchmark.Suite();
const settings = {
  defer: true,
};

const fetcherBench = {
  ...settings,
  fn: async (deferred) => {
    // Render the component inside benchmarked function
    await act(async () => {
      const { unmount } = render(<FetcherComponent />);
      unmount();
    });

    cleanup();

    deferred.resolve();
  },
};

const queryClient = new QueryClient();

const reactQueryBench = {
  ...settings,
  fn: async (deferred) => {
    // Render the component inside benchmarked function
    await act(async () => {
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <ReactQueryComponent />
        </QueryClientProvider>,
      );

      unmount();
    });

    cleanup();
    deferred.resolve();
  },
};

suite
  .add('useFetcher', fetcherBench)
  .add('useQuery', reactQueryBench)
  .on('start', function () {
    console.log('Time per single mount/fetch/unmount:');
  })
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', onComplete)
  .run({ async: true });
