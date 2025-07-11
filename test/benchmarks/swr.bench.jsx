// This is just a raw comparison benchmark for the `useFetcher` hook
// against the `useSWR` hook from the SWR library (cold starts).

// To run this benchmark, use the following command:
// npx tsx test/benchmarks/swr.bench.jsx
import { JSDOM } from 'jsdom';
import React from 'react';

// Setup jsdom environment before React & RTL imports
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

import Benchmark from 'benchmark';
import { onComplete } from './utils.mjs';
import useSWR from 'swr';
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
let i = 0;
let j = 0;
function SWRComponent() {
  i++;
  const { data } = useSWR('https://localhost/posts/' + i, fetcher, {});
  return <div data-testid="many-requests">{data} loaded</div>;
}

function FetcherComponent() {
  j++;
  const { data } = useFetcher('https://localhost/posts/' + j, { fetcher });
  return <div data-testid="many-requests">{data} loaded</div>;
}

const suite = new Benchmark.Suite();
const settings = {
  defer: true,
};

const swrBench = {
  ...settings,
  fn: async (deferred) => {
    // Render the component inside benchmarked function
    await act(async () => {
      const { unmount } = render(<SWRComponent />);
      unmount();
    });
    cleanup();

    deferred.resolve();
  },
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

suite
  .add('useFetcher', fetcherBench)
  .add('useSWR', swrBench)
  .on('start', function () {
    console.log('Time per single mount/fetch/unmount:');
  })
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', onComplete)
  .run({ async: true });
