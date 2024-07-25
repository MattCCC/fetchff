import {
  Endpoint,
  APIQueryParams as QueryParams,
  APIUrlParams as UrlParams,
} from '../../src/types/api';
import type { EndpointsConfig } from '../../src/types/http-request';

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
} satisfies EndpointsConfig<string>;

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
  updateUserDetails: Endpoint<UserResponse, QueryParams, UrlParams>;
  getUserByIdAndName: Endpoint<UserResponse, QueryParams, UserURLParams>;
}
