/**
 * @jest-environment node
 */
/**
 * Server-side rendering runs without window or document.
 */
import { createElement, type ReactElement } from 'react';
import { useFetcher } from '../../src/react/index';
import { pruneCache } from '../../src/cache-manager';
import { clearAllTimeouts } from '../../src/timeout-wheel';

// This project has no react-dom types, so the one function used is typed here
const { renderToString } = jest.requireActual<{
  renderToString: (element: ReactElement) => string;
}>('react-dom/server');

function Component({
  url,
  initialData,
}: {
  url: string;
  initialData?: unknown;
}) {
  const { data, isLoading } = useFetcher(url, { initialData });

  return createElement(
    'div',
    null,
    isLoading ? 'Loading' : JSON.stringify(data),
  );
}

describe('Server-side rendering', () => {
  afterEach(() => {
    pruneCache();
    clearAllTimeouts();
  });

  it('should render the initial data', () => {
    global.fetch = jest.fn();

    expect(
      renderToString(
        createElement(Component, {
          url: '/api/ssr-initial',
          initialData: { name: 'Ada' },
        }),
      ),
    ).toBe('<div>{&quot;name&quot;:&quot;Ada&quot;}</div>');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should render without window or document and without fetching', () => {
    global.fetch = jest.fn();

    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(renderToString(createElement(Component, { url: '/api/ssr' }))).toBe(
      '<div>Loading</div>',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
