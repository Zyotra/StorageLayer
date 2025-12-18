export type HTTPMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface apiRoute{
    path: string;
    method: HTTPMethod;
    handler: (data?:any) => void;
    middlewares?: Array<() => void>;
    isProtected: boolean;
}

export enum StatusCode{
    OK=200,
    CREATED=201,
    ACCEPTED=202,
    NOT_FOUND=404,
    BAD_REQUEST=400,
    UNAUTHORIZED=401,
    FORBIDDEN=403,
    EXPIRED_TOKEN=419,
    LOCKED=423,
    TOO_MANY_REQUESTS=429,
    INTERNAL_SERVER_ERROR=500
}
export interface User{
    id: number;
    email: string;
}
export type DeploymentStatus = 'SUCCESS' | 'FAILED';