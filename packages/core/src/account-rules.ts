// The account rules forms show (password meter, reason length, typed confirmations), for apps
// that only depend on core.
export {
  ADMIN_REASON_LENGTH,
  type AuthFieldError,
  checkPassword,
  NAME_MAX_LENGTH,
  needsNumberOrSymbol,
  PASSWORD_POLICY,
  type PasswordIssue,
  type PasswordStrength,
  passwordStrength,
  SUSPENSION_CATEGORIES,
} from '@sarwa/domain';
export { DELETE_CONFIRM, RESET_CONFIRM } from '@sarwa/contracts';
