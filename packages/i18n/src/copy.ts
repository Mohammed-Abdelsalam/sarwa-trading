import { type AlertIssue, type Rejection } from '@sarwa/domain';

export interface Copy {
  reason: string;
  explanation: string;
}

export interface SymbolContext {
  symbol: string;
}

// Client-only reasons the ticket blocks before the server is ever asked.
export interface ConnectionBlock {
  code: 'CONNECTION_NOT_LIVE';
}

export interface StatusLoadingBlock {
  code: 'STATUS_LOADING';
}

export type ClientBlock = ConnectionBlock | StatusLoadingBlock;

// Plain Extract misses members that share one shape across several codes ({ code: 'A' | 'B' }).
type ByCode<U, C> = U extends { code: infer K } ? (C extends K ? U : never) : never;

// Each code's params without the code: the one table every per-code map is keyed by.
export type ParamsByCode<U extends { code: string }> = {
  [C in U['code']]: Omit<ByCode<U, C>, 'code'>;
};

export type Formatted<T> = { [K in keyof T]: T[K] extends number ? string : T[K] };

export type RejectionParamTable = ParamsByCode<Rejection | ClientBlock>;
export type RejectionKey = keyof RejectionParamTable;
export type RejectionParams<C extends RejectionKey> = Formatted<RejectionParamTable[C]> &
  SymbolContext;

export type AlertIssueParamTable = ParamsByCode<AlertIssue>;
export type AlertIssueCode = keyof AlertIssueParamTable;
export type AlertIssueParams<C extends AlertIssueCode> = Formatted<AlertIssueParamTable[C]> &
  SymbolContext;

export type RejectionCopy = {
  [C in RejectionKey]: (params: RejectionParams<C>) => Copy;
};

export type AlertIssueCopy = {
  [C in AlertIssueCode]: (params: AlertIssueParams<C>) => Copy;
};

export interface Count {
  count: number;
  n: string;
}
