type ErrorDetails = Record<string, unknown>;
type ErrorInfo = {
    error: string;
    message: string;
    status: number;
    code: string;
    stack?: string;
    details?: ErrorDetails;
};
type SuccessResult<T> = {
    success: true;
    data: T;
    error?: never;
    message: string;
    status: number;
    code: string;
    match: <U>(onSuccess: (data: T) => U, onError: (error: ErrorInfo) => U) => U;
    transform: <U>(fn: (data: T) => U) => Result<U>;
    andThen: <U>(fn: (data: T) => Result<U>) => Result<U>;
    recover: <U>(fn: (error: ErrorInfo) => Result<U>) => Result<T>;
    transformAsync: <U>(fn: (data: T) => Promise<U>) => Promise<Result<U>>;
    andThenAsync: <U>(fn: (data: T) => Promise<Result<U>>) => Promise<Result<U>>;
};
type ErrorResult = {
    success: false;
    data?: never;
    error: string;
    message: string;
    status: number;
    code: string;
    stack?: string;
    details?: ErrorDetails;
    match: <U>(onSuccess: (data: never) => U, onError: (error: ErrorInfo) => U) => U;
    transform: <U>(fn: (data: never) => U) => Result<U>;
    andThen: <U>(fn: (data: never) => Result<U>) => Result<U>;
    recover: <T>(fn: (error: ErrorInfo) => Result<T>) => Result<T>;
    transformAsync: <U>(fn: (data: never) => Promise<U>) => Promise<Result<U>>;
    andThenAsync: <U>(fn: (data: never) => Promise<Result<U>>) => Promise<Result<U>>;
};
type Result<T> = SuccessResult<T> | ErrorResult;
declare const ok: <T>(data: T, message?: string, status?: number, code?: string) => Result<T>;
declare function err(error: string, message?: string, status?: number, code?: string, stack?: string, details?: ErrorDetails): Result<never>;
declare function err<TagValue extends string | number | boolean>(taggedData: {
    tag: TagValue;
} & Record<string, unknown>, message?: string, status?: number, code?: string, stack?: string, tagName?: string): Result<never>;
declare const safe: <T>(fn: () => T | Result<T>) => Result<T>;
declare const safeAsync: <T>(fn: () => Promise<T | Result<T>>) => Promise<Result<T>>;
declare function when<T>(condition: boolean, value: T, defaultValue: T): T;
declare function when<T>(condition: boolean, value: T): T | undefined;
declare const whenResult: <T>(condition: boolean, value: T, errorMessage?: string, errorCode?: string, statusCode?: number) => Result<T>;
declare const matchCode: <T>(code: string, overrides: Record<string, T>, defaultValue?: T) => T | undefined;
declare const matchCodeResult: <T>(code: string, overrides: Record<string, T | (() => T | Result<T>)>, errorMessage?: string, errorCode?: string, statusCode?: number) => Result<T>;
declare const matchStatus: <T>(status: number, overrides: Record<number, T>, defaultValue?: T) => T | undefined;
declare const matchStatusResult: <T>(status: number, overrides: Record<number, T | (() => T | Result<T>)>, errorMessage?: string, errorCode?: string, statusCode?: number) => Result<T>;
declare const matchResult: <T, R>(result: Result<T>, handlers: {
    ok: (data: T) => R;
    err: (error: ErrorInfo) => R;
}) => R;
declare function tagged<TagValue extends string | number | boolean, T extends Record<string, unknown>>(value: TagValue, data: T, tagName?: string): T & {
    tag: TagValue;
};
declare function tagged<TagValue extends string | number | boolean>(value: TagValue, tagName?: string): <T extends Record<string, unknown>>(data: T) => T & {
    tag: TagValue;
};
declare function taggedWith<Tag extends string, TagValue extends string | number | boolean, T extends Record<string, unknown>>(tag: Tag, value: TagValue, data: T): T & {
    [K in Tag]: TagValue;
};
declare function taggedWith<Tag extends string, TagValue extends string | number | boolean>(tag: Tag, value: TagValue): <T extends Record<string, unknown>>(data: T) => T & {
    [K in Tag]: TagValue;
};
type MatchHandlers<T extends {
    [K in TagName]: string | number | boolean;
}, R, TagName extends string = "tag"> = {
    [K in Extract<T[TagName], PropertyKey>]?: (payload: Omit<Extract<T, {
        [P in TagName]: K;
    }>, TagName>) => R;
} & {
    error?: (error: ErrorInfo) => R;
    default?: (payload: unknown) => R;
    [key: string]: any;
};
declare const match: <T extends { [K in TagName]: string | number | boolean; }, TagName extends string = "tag", Handlers extends MatchHandlers<T, any, TagName> = MatchHandlers<T, any, TagName>>(result: Result<T>, handlers: Handlers, tagName?: TagName) => Result<Handlers[keyof Handlers] extends (...args: any[]) => infer R ? R : never>;
declare function isTagged(value: unknown): value is {
    tag: string | number | boolean;
};
declare function isTagged<Tag extends string, TagValue extends string | number | boolean>(value: unknown, tag: Tag, tagValue: TagValue): value is {
    [K in Tag]: TagValue;
};
declare const isResult: <T>(value: unknown) => value is Result<T>;
declare const isSuccess: <T>(result: Result<T>) => result is SuccessResult<T>;
declare const isError: <T>(result: Result<T>) => result is ErrorResult;
declare const isOk: <T>(result: Result<T>) => result is SuccessResult<T>;
declare const isErr: <T>(result: Result<T>) => result is ErrorResult;
export { ok, err, safe, safeAsync, when, whenResult, matchCode, matchCodeResult, matchStatus, matchStatusResult, matchResult, tagged, taggedWith, match, isTagged, isResult, isSuccess, isError, isOk, isErr, };
export type { Result, SuccessResult, ErrorResult, ErrorInfo, ErrorDetails };
export declare const all: <T>(results: Result<T>[]) => Result<T[]>;
export declare const allSettled: <T>(results: Result<T>[]) => Result<{
    data: T[];
    errors: ErrorInfo[];
}>;
export declare const combine: <T>(results: Result<T>[]) => Result<Result<T>[]>;
export declare const tryValue: <T>(fn: () => T | Result<T>) => Result<T>;
export declare const tryAsync: <T>(fn: () => Promise<T | Result<T>>) => Promise<Result<T>>;
export declare function RetryConditionAlways(): boolean;
export declare function RetryConditionNever(): boolean;
export declare function tryWhile<T>(fn: (attempt: number) => Promise<T>, isRetryable: (err: unknown, nextAttempt: number) => boolean, options?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    verbose?: boolean;
}): Promise<T>;
export type TryNOptions = {
    /**
     * @param err Error thrown by the function.
     * @param nextAttempt Number of next attempt to make.
     * @returns Returns true if the error and nextAttempt number is retryable.
     */
    isRetryable?: (err: unknown, nextAttempt: number) => boolean;
    /**
     * Number of milliseconds to use as multiplier for the exponential backoff.
     */
    baseDelayMs?: number;
    /**
     * Maximum number of milliseconds to wait.
     */
    maxDelayMs?: number;
    /**
     * If true, logs the error and attempt number to the console.
     */
    verbose?: boolean;
};
export declare function tryN<T>(n: number, fn: (attempt: number) => Promise<T>, options?: TryNOptions): Promise<T>;
export declare function jitterBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
export declare function isErrorRetryable(err: unknown): boolean;
