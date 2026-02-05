/**
 * @packrun/email - Email templates and client for packrun.dev notifications
 */

export {
  resend,
  sendEmail,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  RateLimitError,
  type SendEmailOptions,
} from "./client";

export { CriticalAlert, type CriticalAlertProps } from "./templates/critical";
export { Digest, type DigestProps, type DigestUpdate } from "./templates/digest";
