/**
 * Email Queue
 *
 * Functions to queue email notifications.
 */

import { getQueue } from "@packrun/queue";
import {
  EMAIL_DELIVERY_QUEUE,
  type EmailDeliveryJobData,
  EXTERNAL_API_RETRY,
} from "@packrun/queue/delivery";

export interface ReleaseEmailData {
  userId: string;
  email: string;
  release: {
    id: string;
    title: string;
    packageName?: string;
    targetVersion: string;
    releasedVersion: string;
    description?: string;
    websiteUrl?: string;
  };
}

/**
 * Queue a release launched email notification
 */
export async function queueReleaseEmail(data: ReleaseEmailData): Promise<void> {
  const emailQueue = getQueue<EmailDeliveryJobData>({ name: EMAIL_DELIVERY_QUEUE });

  await emailQueue.add(
    "send",
    {
      to: data.email,
      userId: data.userId,
      template: "release-launched",
      props: {
        releaseTitle: data.release.title,
        packageName: data.release.packageName,
        targetVersion: data.release.targetVersion,
        releasedVersion: data.release.releasedVersion,
        description: data.release.description,
        websiteUrl: data.release.websiteUrl,
      },
    },
    {
      ...EXTERNAL_API_RETRY,
      jobId: `release-${data.userId}-${data.release.id}`,
    },
  );
}
