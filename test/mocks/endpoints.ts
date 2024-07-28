import type {
  Endpoint,
  EndpointsConfig,
  APIQueryParams as QueryParams,
} from '../../src/types/api-handler';

export const endpoints = {
  getUser: {
    url: '/user-details',
  },
  getUserByIdAndName: {
    url: '/user-details/:id/:name',
  },
  updateUserDetails: {
    method: 'post',
    url: '/user-details/:userId',
  },
} satisfies EndpointsConfig<EndpointsList>;

interface UserURLParams {
  id: number;
  name: string;
}

interface UserResponse {
  name: string;
  age: number;
}

// Passing QueryParams allows for any params to be passed to the request (no strict typing)
export interface EndpointsList {
  getUser: Endpoint;
  updateUserDetails: Endpoint<UserResponse>;
  getUserByIdAndName: Endpoint<UserResponse, QueryParams, UserURLParams>;
}
