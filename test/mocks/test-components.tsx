import { useEffect, useState } from 'react';
import { useFetcher } from '../../src/react/index';
import type { RequestConfig } from '../../src/types/request-handler';

export interface TestData {
  message?: string;
  count?: number;
  original?: boolean;
  updated?: boolean;
  id?: number;
  name?: string;
  shared?: string;
  timestamp?: number;
  deduped?: boolean;
  poll?: number;
  success?: boolean;
  suspense?: string;
  individual?: boolean;
  posts?: Array<{ id: number; title: string }>;
  focus?: number;
  headers?: string;
  created?: boolean;
  userId?: number;
  default?: string;
  overlap?: boolean;
  mutated?: boolean;
  cached?: boolean;
}

export const BasicComponent = ({
  url,
  config = {},
}: {
  url: string | null;
  config?: RequestConfig<TestData>;
}) => {
  const {
    data,
    error,
    headers,
    isLoading,
    isFetching,
    mutate,
    refetch,
    config: requestConfig,
  } = useFetcher<TestData>(url, config);

  return (
    <div>
      <div data-testid="loading">
        {isLoading ? 'Loading...' : 'Not Loading'}
      </div>
      <div data-testid="validating">
        {isFetching ? 'Validating...' : 'Not Validating'}
      </div>
      <div data-testid="data">
        {data !== null && data !== undefined ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="headers">
        {headers ? JSON.stringify(headers) : 'No headers'}
      </div>
      <div data-testid="error">{error ? error.message : 'No Error'}</div>
      <div data-testid="config">
        {requestConfig ? JSON.stringify(requestConfig) : 'No Config'}
      </div>
      <button onClick={refetch} data-testid="refetch">
        Refetch
      </button>
      <button onClick={() => mutate({ updated: true })} data-testid="mutate">
        Mutate
      </button>
    </div>
  );
};

export const SuspenseComponent = ({ url }: { url: string }) => {
  const { data, error, isLoading } = useFetcher<TestData>(url, {
    strategy: 'reject',
  });

  if (error) {
    return <div data-testid="error">Error: {error.message}</div>;
  }

  if (isLoading) {
    return <div data-testid="conditional-loading">Conditional Loading...</div>;
  }

  return <div data-testid="data">{JSON.stringify(data)}</div>;
};

export const MultipleRequestsComponent = () => {
  const { data: data1 } = useFetcher<TestData>('/api/data-1');
  const { data: data2 } = useFetcher<TestData>('/api/data-2');
  const { data: data3, config: config3 } = useFetcher<TestData>('/api/data-3');

  return (
    <div>
      <div data-testid="data-1">
        {data1 ? JSON.stringify(data1) : 'No Data 1'}
      </div>
      <div data-testid="data-2">
        {data2 ? JSON.stringify(data2) : 'No Data 2'}
      </div>
      <div data-testid="data-3">
        {data3 ? JSON.stringify(data3) : 'No Data 3'}
      </div>
      <div data-testid="data-3-config">
        {config3 ? JSON.stringify(config3) : 'No Data 3 Config'}
      </div>
    </div>
  );
};

export const ErrorHandlingComponent = ({
  shouldError,
}: {
  shouldError: boolean;
}) => {
  const { data, error, refetch } = useFetcher<TestData>(
    shouldError ? '/api/error-endpoint' : '/api/success-endpoint',
    {
      retry: {
        retries: 2,
        delay: 100,
        backoff: 1.5,
      },
    },
  );

  return (
    <div>
      <div data-testid="result-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="result-error">{error ? error.message : 'No Error'}</div>
      <button onClick={refetch} data-testid="retry">
        Retry
      </button>
    </div>
  );
};

export const ConditionalComponent = ({ enabled }: { enabled: boolean }) => {
  const { data, isLoading } = useFetcher<TestData>(
    enabled ? '/api/conditional' : null,
  );

  return (
    <div>
      <div data-testid="conditional-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="conditional-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
    </div>
  );
};

// Complex caching + retry + polling component
export const CacheRetryPollComponent = ({
  url,
  enablePolling,
  retries = 3,
}: {
  url: string;
  enablePolling: boolean;
  retries?: number;
}) => {
  const { data, error, isLoading, isFetching, refetch } = useFetcher<TestData>(
    url,
    {
      cacheTime: 10, // 10 seconds
      dedupeTime: 2, // 2 seconds
      revalidateOnFocus: true,
      pollingInterval: enablePolling ? 1000 : 0,
      retry: {
        retries,
        delay: 100,
        backoff: 2,
        retryOn: [500, 502, 503],
      },
      cacheKey: (config) => `complex-${config.url}-${enablePolling}`,
    },
  );

  return (
    <div>
      <div data-testid="complex-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="complex-error">{error?.message || 'No Error'}</div>
      <div data-testid="complex-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
      <div data-testid="complex-validating">
        {isFetching ? 'Validating' : 'Not Validating'}
      </div>
      <button onClick={refetch} data-testid="complex-refetch">
        Refetch
      </button>
    </div>
  );
};

// Mixed strategies component
export const MixedStrategiesComponent = () => {
  const { data: rejectData, error: rejectError } = useFetcher<TestData>(
    '/api/reject',
    {
      strategy: 'reject',
      cacheTime: 5,
    },
  );

  const { data: softFailData } = useFetcher<TestData>('/api/softfail', {
    strategy: 'softFail',
    defaultResponse: { message: 'fallback' },
    retry: { retries: 2, delay: 50 },
  });

  return (
    <div>
      <div data-testid="reject-data">
        {rejectData ? JSON.stringify(rejectData) : 'No Reject Data'}
      </div>
      <div data-testid="reject-error">
        {rejectError?.message || 'No Reject Error'}
      </div>
      <div data-testid="softfail-data">
        {softFailData ? JSON.stringify(softFailData) : 'No SoftFail Data'}
      </div>
    </div>
  );
};

// Cache mutation with dependencies component
export const CacheMutationComponent = ({ userId }: { userId: number }) => {
  const { data: user, mutate: mutateUser } = useFetcher<TestData>(
    `/api/users/${userId}`,
    {
      cacheTime: 30,
      cacheKey: `user-${userId}`,
    },
  );

  const { data: posts, mutate: mutatePosts } = useFetcher<TestData>(
    `/api/users/${userId}/posts`,
    {
      cacheTime: 15,
      cacheKey: `posts-${userId}`,
      immediate: !!user, // Only fetch posts if user exists
    },
  );

  const updateUser = () => {
    mutateUser({ ...user, name: 'Updated Name', mutated: true });
    // Also update posts when user changes
    mutatePosts({ ...posts, cached: true });
  };

  return (
    <div>
      <div data-testid="user-data">
        {user ? JSON.stringify(user) : 'No User'}
      </div>
      <div data-testid="posts-data">
        {posts ? JSON.stringify(posts) : 'No Posts'}
      </div>
      <button onClick={updateUser} data-testid="update-user">
        Update User
      </button>
    </div>
  );
};

// Conditional with dynamic URLs component
export const ConditionalDynamicComponent = ({
  type,
  id,
  enabled,
}: {
  type: 'user' | 'post' | null;
  id?: number;
  enabled: boolean;
}) => {
  const url = enabled && type && id ? `/api/${type}s/${id}` : null;

  const { data, isLoading, refetch } = useFetcher<TestData>(url, {
    cacheTime: type === 'user' ? 60 : 30, // Different cache times
    dedupeTime: 5,
    retry: {
      retries: type === 'user' ? 3 : 1, // Different retry strategies
      delay: 200,
    },
    params: type === 'post' ? { include: 'comments' } : undefined,
  });

  return (
    <div>
      <div data-testid="dynamic-url">{url || 'No URL'}</div>
      <div data-testid="dynamic-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="dynamic-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
      <button onClick={refetch} data-testid="dynamic-refetch">
        Refetch
      </button>
    </div>
  );
};

// Overlapping requests with different configs
export const OverlappingRequestsComponent = ({
  phase,
}: {
  phase: 1 | 2 | 3;
}) => {
  // Same URL but different configs based on phase
  const config1: RequestConfig<TestData> = {
    cacheTime: phase === 1 ? 10 : 0,
    dedupeTime: 1,
    method: 'GET',
  };

  const config2: RequestConfig<TestData> = {
    cacheTime: 20,
    method: phase === 2 ? 'POST' : 'GET',
    body: phase === 2 ? { data: 'test' } : undefined,
    immediate: phase !== 2,
  };

  const { data: data1, isLoading: loading1 } = useFetcher<TestData>(
    '/api/overlap',
    config1,
  );
  const {
    data: data2,
    isLoading: loading2,
    refetch,
  } = useFetcher<TestData>('/api/overlap', config2);

  return (
    <div>
      <div data-testid="overlap-data1">
        {data1 ? JSON.stringify(data1) : 'No Data1'}
      </div>
      <div data-testid="overlap-data2">
        {data2 ? JSON.stringify(data2) : 'No Data2'}
      </div>
      <div data-testid="overlap-loading">
        {loading1 || loading2 ? 'Loading' : 'Not Loading'}
      </div>
      <div data-testid="overlap-phase">{phase}</div>
      <button onClick={refetch} data-testid="overlap-refetch">
        Refetch
      </button>
    </div>
  );
};

// Error boundaries with different error types
export const ErrorTypesComponent = ({
  errorType,
}: {
  errorType: 'network' | '500' | '404' | 'timeout' | 'success';
}) => {
  const getUrl = () => {
    switch (errorType) {
      case 'network':
        return '/api/network-error';
      case '500':
        return '/api/server-error';
      case '404':
        return '/api/not-found';
      case 'timeout':
        return '/api/slow-endpoint';
      case 'success':
        return '/api/success';
    }
  };

  const { data, error, isLoading } = useFetcher<TestData>(getUrl(), {
    timeout: errorType === 'timeout' ? 100 : 5000,
    retry: {
      retries: errorType === '500' ? 3 : 1,
      delay: 50,
      retryOn: errorType === '404' ? [] : [500, 502, 503],
    },
    strategy: errorType === '404' ? 'softFail' : 'reject',
    defaultResponse: { error: true },
  });

  return (
    <div>
      <div data-testid="error-type">{errorType}</div>
      <div data-testid="error-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="error-message">{error?.message || 'No Error'}</div>
      <div data-testid="error-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
    </div>
  );
};

export const PaginationComponent = () => {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useFetcher<{
    data: Array<{ id: number; title: string }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>('/api/posts', {
    params: { page, limit },
    cacheTime: 30,
    cacheKey: `posts-page-${page}`,
  });

  return (
    <div>
      <div data-testid="pagination-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
      <div data-testid="pagination-error">
        {error ? error.message : 'No Error'}
      </div>
      <div data-testid="pagination-data">
        {data?.data ? JSON.stringify(data.data) : 'No Data'}
      </div>
      <div data-testid="pagination-info">
        {data?.pagination
          ? `Page ${data.pagination.page} of ${data.pagination.totalPages}`
          : 'No Pagination Info'}
      </div>
      <button
        onClick={() => setPage(page - 1)}
        disabled={!data?.pagination?.hasPrev}
        data-testid="prev-page"
      >
        Previous
      </button>
      <button
        onClick={() => setPage(page + 1)}
        disabled={!data?.pagination?.hasNext}
        data-testid="next-page"
      >
        Next
      </button>
      <div data-testid="current-page">{page}</div>
    </div>
  );
};

export const InfiniteScrollComponent = () => {
  const [allItems, setAllItems] = useState<
    Array<{ id: number; content: string }>
  >([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const { data, isLoading } = useFetcher<{
    items: Array<{ id: number; content: string }>;
    hasMore: boolean;
    nextOffset: number | null;
  }>('/api/feed', {
    params: { offset, limit: 5 },
    cacheTime: 0, // Don't cache for infinite scroll
    immediate: hasMore, // Only fetch if there's more data
  });

  useEffect(() => {
    if (data?.items) {
      setAllItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      if (data.nextOffset !== null) {
        // Don't auto-advance here, wait for user action
      }
    }
  }, [data]);

  const loadMore = () => {
    if (data && data.nextOffset !== null && hasMore) {
      setOffset(data.nextOffset);
    }
  };

  return (
    <div>
      <div data-testid="infinite-items">
        {allItems.map((item) => (
          <div key={item.id} data-testid={`item-${item.id}`}>
            {item.content}
          </div>
        ))}
      </div>
      <div data-testid="infinite-loading">
        {isLoading ? 'Loading More' : 'Not Loading'}
      </div>
      <div data-testid="items-count">{allItems.length}</div>
      <button
        onClick={loadMore}
        disabled={!hasMore || isLoading}
        data-testid="load-more"
      >
        Load More
      </button>
      <div data-testid="has-more">{hasMore ? 'Has More' : 'No More'}</div>
    </div>
  );
};

export const SearchPaginationComponent = () => {
  const [search, setSearch] = useState('john');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFetcher<{
    users: Array<{ id: number; name: string; status: string }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>('/api/users', {
    params: { search, status, page, limit: 3 },
    cacheTime: 60,
    cacheKey: `users-${search}-${status}-${page}`,
    dedupeTime: 1000, // Dedupe rapid searches
  });

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search, status]);

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        data-testid="search-input"
        placeholder="Search users..."
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        data-testid="status-filter"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <div data-testid="search-loading">
        {isLoading ? 'Searching' : 'Not Searching'}
      </div>

      <div data-testid="search-results">
        {data?.users?.map((user) => (
          <div key={user.id} data-testid={`user-${user.id}`}>
            {user.name} - {user.status}
          </div>
        )) || 'No Results'}
      </div>

      <div data-testid="search-total">
        {data?.pagination ? `Total: ${data.pagination.total}` : 'No Total'}
      </div>

      <div data-testid="search-page">
        {data?.pagination ? `Page: ${data.pagination.page}` : 'No Page'}
      </div>
    </div>
  );
};

export const ErrorPaginationComponent = ({ attemptCount = 0 }) => {
  const [page, setPage] = useState(1);

  const { data, error, isLoading } = useFetcher('/api/posts-error', {
    params: { page },
    retry: { retries: 3, delay: 100, backoff: 1.5 },
    cacheTime: 0, // Don't cache error responses
  });

  return (
    <div>
      <div data-testid="error-pagination-data">
        {data?.data ? JSON.stringify(data.data) : 'No Data'}
      </div>
      <div data-testid="error-pagination-error">
        {error ? `Error: ${error.status}` : 'No Error'}
      </div>
      <div data-testid="error-pagination-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
      <button onClick={() => setPage(2)} data-testid="goto-page-2">
        Go to Page 2
      </button>
      <div data-testid="error-attempt-count">{attemptCount}</div>
    </div>
  );
};
