import {
  Endpoint,
  APIQueryParams as QueryParams,
  APIUrlParams as UrlParams,
} from '../../src/types/api';

export const endpoints = {
  getUserDetails: {
    method: 'get',
    url: '/user-details/get',
  },
  getUserDetailsByIdAndName: {
    method: 'get',
    url: '/user-details/get/:id/:name',
  },
  updateUserDetails: {
    method: 'post',
    url: '/user-details/update/:userId',
  },
};

interface CustomURLParams {
  id: number;
  name: string;
}

interface CustomResponse {
  name: string;
  age: number;
}

export interface IEndpoints {
  getUserDetails: Endpoint;
  updateUserDetails: Endpoint<QueryParams, UrlParams>;
  getUserDetailsByIdAndName: Endpoint<
    QueryParams,
    CustomURLParams,
    CustomResponse
  >;
}
