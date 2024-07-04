import {
  Endpoint,
  APIQueryParams as QueryParams,
  APIUrlParams as UrlParams,
} from '../../src/types/api';

export const endpoints = {
  getUserDetails: {
    url: '/user-details',
  },
  getUserDetailsByIdAndName: {
    url: '/user-details/:id/:name',
  },
  updateUserDetails: {
    method: 'post',
    url: '/user-details/:userId',
  },
};

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
  getUserDetails: Endpoint;
  updateUserDetails: Endpoint<UserResponse, QueryParams, UrlParams>;
  getUserDetailsByIdAndName: Endpoint<UserResponse, QueryParams, UserURLParams>;
}
