/**
 * @packrun/email - Email templates and client for packrun.dev notifications
 */

export {
  generateUnsubscribeToken,
  RateLimitError,
  resend,
  type SendEmailOptions,
  sendEmail,
  verifyUnsubscribeToken,
} from "./client";

export { CriticalAlert, type CriticalAlertProps } from "./templates/critical";
export { Digest, type DigestProps, type DigestUpdate } from "./templates/digest";
export { ReleaseLaunched, type ReleaseLaunchedProps } from "./templates/release-launched";
