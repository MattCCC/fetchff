export const apiEndpoints = {
    getUserDetails: {
        method: 'get',
        url: '/user-details/get',
    },
    updateUserDetails: {
        method: 'post',
        url: '/user-details/update/:userId',
    },
};

export interface IEndpoints {
    getUserDetails: (queryParams?: Record<string, any>, urlParams?: Record<string, any>) => Promise<any>;
    updateUserDetails: (queryParams: Record<string, any>, urlParams?: Record<string, any>) => Promise<any>;
}