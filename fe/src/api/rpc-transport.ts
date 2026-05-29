import type { RpcMethod, RpcParams, RpcResult } from './rpc-methods.types';
import type { RpcErrorData } from '../types/rpc.types';

export interface RpcTransport {
  request: <TMethod extends RpcMethod>(
    method: TMethod,
    params: RpcParams<TMethod>,
  ) => Promise<RpcResult<TMethod>>;
}

export interface RpcTransportError extends Error {
  code: number;
  data?: RpcErrorData;
}

export const createRpcTransportError = (
  code: number,
  message: string,
  data?: RpcErrorData,
): RpcTransportError =>
  Object.assign(new Error(message), {
    name: 'RpcTransportError',
    code,
    data,
  });
