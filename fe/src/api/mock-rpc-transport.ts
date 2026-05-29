import appCapabilitiesMock from '../mocks/rpc/app.capabilities.json';
import conflictDetailMock from '../mocks/rpc/git.conflict-detail.json';
import diffMock from '../mocks/rpc/git.diff.json';
import logMock from '../mocks/rpc/git.log.json';
import refsMock from '../mocks/rpc/git.refs.json';
import stashesMock from '../mocks/rpc/git.stashes.json';
import statusMock from '../mocks/rpc/git.status.json';
import repoListMock from '../mocks/rpc/repo.list.json';
import repoOpenMock from '../mocks/rpc/repo.open.json';
import type { RpcMethod, RpcParams, RpcResult } from './rpc-methods.types';
import { createRpcTransportError, type RpcTransport } from './rpc-transport';
import type { GitDiffParams, GitDiffResult } from '../types/git.types';
import type { RepoAddParams, RepoOpenParams, RepoOpenResult, RepositoryRecord } from '../types/repository.types';
import { RPC_ERROR_CODES } from '../types/rpc.types';

export type MockRpcTransport = RpcTransport;

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);

const getDisplayNameFromPath = (path: string) => {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  return pathParts.at(-1) ?? 'Repository';
};

const createRepositoryRecord = (params: RepoAddParams, sequence: number): RepositoryRecord => {
  const displayName = params.display_name?.trim() || getDisplayNameFromPath(params.path);

  return {
    repository_key: `mock-repo-${sequence}`,
    root_path: params.path,
    display_name: displayName,
    group: params.group,
    initial: displayName.charAt(0).toUpperCase() || 'R',
    auto_fetch_on_open: params.auto_fetch_on_open,
    remote_summary: {
      behind: 0,
      ahead: 0,
      state: 'unknown',
    },
  };
};

const createOpenResult = (repository: RepositoryRecord): RepoOpenResult => ({
  repo_id: repository.repository_key === repoOpenMock.repository_key ? repoOpenMock.repo_id : `repo-${repository.repository_key}`,
  repository_key: repository.repository_key,
  root_path: repository.root_path,
  display_name: repository.display_name,
  head: {
    branch: 'main',
    sha: repoOpenMock.head.sha,
    detached: false,
  },
});

const createDiffResult = (params: GitDiffParams): GitDiffResult => ({
  ...cloneDto(diffMock),
  file_path: params.file_path,
  old_path: null,
});

export const createMockRpcTransport = (): MockRpcTransport => {
  const repositoryList = cloneDto(repoListMock);
  let nextRepositorySequence = repositoryList.repositories.length + 1;

  const resolve = (method: RpcMethod, params: RpcParams<RpcMethod>): unknown => {
    switch (method) {
      case 'app.capabilities':
        return appCapabilitiesMock;
      case 'repo.list':
        return repositoryList;
      case 'repo.add': {
        const addedRepository = createRepositoryRecord(params as RepoAddParams, nextRepositorySequence);
        nextRepositorySequence += 1;
        repositoryList.repositories.push(addedRepository);

        return addedRepository;
      }
      case 'repo.open': {
        const { repository_key } = params as RepoOpenParams;
        const repository = repositoryList.repositories.find((item) => item.repository_key === repository_key);

        if (!repository) {
          throw createRpcTransportError(
            RPC_ERROR_CODES.REPOSITORY_NOT_FOUND,
            `Repository ${repository_key} was not found in mock repository list.`,
            { operation: 'repo.open' },
          );
        }

        return createOpenResult(repository);
      }
      case 'git.status':
        return statusMock;
      case 'git.refs':
        return refsMock;
      case 'git.log':
        return logMock;
      case 'git.diff':
        return createDiffResult(params as GitDiffParams);
      case 'git.stashes':
        return stashesMock;
      case 'git.conflictDetail':
        return conflictDetailMock;
      default:
        throw createRpcTransportError(
          RPC_ERROR_CODES.METHOD_NOT_FOUND,
          `Mock RPC method ${method} is not implemented yet.`,
          { operation: method },
        );
    }
  };

  return {
    request: async <TMethod extends RpcMethod>(
      method: TMethod,
      params: RpcParams<TMethod>,
    ): Promise<RpcResult<TMethod>> => cloneDto(resolve(method, params) as RpcResult<TMethod>),
  };
};
