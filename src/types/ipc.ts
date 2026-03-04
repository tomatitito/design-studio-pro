export interface IpcSuccess<T> {
  data: T;
}

export interface IpcError {
  message: string;
  code?: string;
}

export type IpcResult<T> = IpcSuccess<T> | IpcError;
