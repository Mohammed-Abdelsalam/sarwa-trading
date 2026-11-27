import { type z } from 'zod';

import {
  type CancelOutcome,
  type CircuitBreakerRules,
  type ExecutionRules,
  type MarketSession,
  type OrderSize,
  type Rejection,
} from '@sarwa/domain';

import {
  type CancelOutcomeSchema,
  type CircuitBreakerSchema,
  type ExecutionRulesSchema,
  type MarketSessionSchema,
  type OrderSizeSchema,
  type RejectionSchema,
} from './trading';

// Compile-time only (not exported from the package): typecheck fails when a wire schema drifts
// from the domain type it carries, e.g. a new rejection code added without a contract update.
// The standard exact-equality trick: the generic is how TypeScript compares two types strictly.
type Equal<A, B> =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
// Unit brands exist only at compile time; on the wire they are plain numbers.
type Unbranded<T> = T extends number
  ? number
  : T extends string | boolean | null | undefined
    ? T
    : { [K in keyof T]: Unbranded<T[K]> };
type Tie<Schema extends z.ZodType, Domain extends object | string> = Equal<
  Unbranded<z.output<Schema>>,
  Unbranded<Domain>
>;
type Expect<T extends true> = T;

// The wire form of a tied domain type carries the same integers, so the boundary only re-attaches
// the unit brands. Limited to the tied types, whose shapes the checks below keep in step.
type Tied = Rejection | ExecutionRules | CircuitBreakerRules | MarketSession | OrderSize;
export const toDomain = <T extends Tied>(wire: Unbranded<T>) => wire as T;

export type DomainTies = [
  Expect<Tie<typeof RejectionSchema, Rejection>>,
  Expect<Tie<typeof ExecutionRulesSchema, ExecutionRules>>,
  Expect<Tie<typeof CircuitBreakerSchema, CircuitBreakerRules>>,
  Expect<Tie<typeof MarketSessionSchema, MarketSession>>,
  Expect<Tie<typeof OrderSizeSchema, OrderSize>>,
  Expect<Tie<typeof CancelOutcomeSchema, CancelOutcome>>,
];
