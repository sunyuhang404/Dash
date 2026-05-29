import type { RpcMethod, RpcParams, RpcResult } from './rpc-methods.types';
import { createMockRpcTransport } from './mock-rpc-transport';
import { createRpcTransportError, type RpcTransport } from './rpc-transport';
import type { RpcFailure, RpcRequest, RpcResponse } from '../types/rpc.types';
import { RPC_ERROR_CODES } from '../types/rpc.types';

interface CefQueryOptions {
  request: string;
  persistent?: boolean;
  onSuccess: (response: string) => void;
  onFailure: (errorCode: number, errorMessage: string) => void;
}

declare global {
  interface Window {
    cefQuery?: (options: CefQueryOptions) => number;
    cefQueryCancel?: (requestId: number) => void;
  }
}

let rpcRequestSequence = 0;
let activeTransport: RpcTransport | null = null;

const createRpcRequestId = () => {
  rpcRequestSequence += 1;

  return `dash-rpc-${Date.now()}-${rpcRequestSequence}`;
};

const isRpcFailure = <TResult>(response: RpcResponse<TResult>): response is RpcFailure => 'error' in response;

export const createCefRpcTransport = (): RpcTransport => ({
  request: async <TMethod extends RpcMethod>(
    method: TMethod,
    params: RpcParams<TMethod>,
  ): Promise<RpcResult<TMethod>> => {
    if (!window.cefQuery) {
      throw createRpcTransportError(
        RPC_ERROR_CODES.INTERNAL_ERROR,
        'CEF query bridge is not available in the current renderer.',
        { operation: method },
      );
    }

    const request: RpcRequest<RpcParams<TMethod>> = {
      jsonrpc: '2.0',
      id: createRpcRequestId(),
      method,
      params,
    };

    return new Promise<RpcResult<TMethod>>((resolve, reject) => {
      window.cefQuery?.({
        request: JSON.stringify(request),
        onSuccess: (responseText) => {
          try {
            const response = JSON.parse(responseText) as RpcResponse<RpcResult<TMethod>>;

            if (isRpcFailure(response)) {
              reject(createRpcTransportError(response.error.code, response.error.message, response.error.data));
              return;
            }

            resolve(response.result);
          } catch (error) {
            reject(
              createRpcTransportError(
                RPC_ERROR_CODES.INVALID_REQUEST,
                error instanceof Error ? error.message : 'Failed to parse native RPC response.',
                { operation: method },
              ),
            );
          }
        },
        onFailure: (errorCode, errorMessage) => {
          reject(createRpcTransportError(errorCode, errorMessage, { operation: method }));
        },
      });
    });
  },
});

const createDefaultTransport = (): RpcTransport =>
  window.cefQuery ? createCefRpcTransport() : createMockRpcTransport();

const getActiveTransport = () => {
  activeTransport ??= createDefaultTransport();

  return activeTransport;
};

export const setRpcTransport = (transport: RpcTransport) => {
  activeTransport = transport;
};

export const callNative = async <TMethod extends RpcMethod>(
  method: TMethod,
  params: RpcParams<TMethod>,
): Promise<RpcResult<TMethod>> => getActiveTransport().request(method, params);
