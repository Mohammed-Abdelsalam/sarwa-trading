import { type AlertIssue, type Rejection, type RejectionCode } from '@sarwa/domain';

export interface Copy {
  reason: string;
  explanation: string;
}

export interface SymbolContext {
  symbol: string;
}

// Plain Extract misses members that share one shape across several codes ({ code: 'A' | 'B' }).
type ByCode<U, C> = U extends { code: infer K } ? (C extends K ? U : never) : never;

export type Formatted<T> = { [K in keyof T]: T[K] extends number ? string : T[K] };

export type RejectionParams<C extends RejectionCode> = Formatted<
  Omit<ByCode<Rejection, C>, 'code'>
> &
  SymbolContext;

export type AlertIssueCode = AlertIssue['code'];

export type AlertIssueParams<C extends AlertIssueCode> = Formatted<
  Omit<ByCode<AlertIssue, C>, 'code'>
> &
  SymbolContext;

export type RejectionCopy = {
  [C in RejectionCode]: (params: RejectionParams<C>) => Copy;
};

export interface Count {
  count: number;
  n: string;
}

export type AlertIssueCopy = {
  [C in AlertIssueCode]: (params: AlertIssueParams<C>) => Copy;
};
