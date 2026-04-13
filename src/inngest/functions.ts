import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { generateFollowUp } from "@/lib/claude";
import { sendEmail, emailBodyToHtml } from "@/lib/resend";

export const scheduleFollowUps = inngest.createFunction(
  {
    id: "schedule-follow-ups",
    name: "Schedule Follow-up Emails",
    triggers: [{ cron: "0 9 * * 1-5" }],
  },
  async ({ step }) => {
    const activeCampaigns = await step.run("get-active-campaigns", async () => {
      return prisma.campaign.findMany({
        where: { status: "ACTIVE" },
      });
    });

    for (const campaign of activeCampaigns) {
      await step.run(`process-campaign-${campaign.id}`, async () => {
        const emailsDue = await prisma.email.findMany({
          where: {
            campaignId: campaign.id,
            status: { in: ["SENT", "DELIVERED", "OPENED"] },
            type: "INITIAL",
            repliedAt: null,
            sentAt: {
              lte: new Date(
                Date.now() -
                  campaign.followUpDelayDays * 24 * 60 * 60 * 1000
              ),
            },
          },
          include: { prospect: true },
        });

        for (const email of emailsDue) {
          const existingFollowUps = await prisma.email.count({
            where: {
              campaignId: campaign.id,
              prospectId: email.prospectId,
              type: { in: ["FOLLOWUP_1", "FOLLOWUP_2", "FOLLOWUP_3"] },
            },
          });

          if (existingFollowUps >= campaign.maxFollowUps) continue;

          const hasReply = await prisma.response.findFirst({
            where: { prospectId: email.prospectId },
          });
          if (hasReply) continue;

          try {
            const followUpNumber = existingFollowUps + 1;
            const followUp = await generateFollowUp(
              email.subject,
              email.body,
              followUpNumber,
              email.prospect.contact || email.prospect.company,
              campaign.language,
              campaign.tone as "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM"
            );

            const emailType =
              followUpNumber === 1
                ? "FOLLOWUP_1"
                : followUpNumber === 2
                  ? "FOLLOWUP_2"
                  : "FOLLOWUP_3";

            await prisma.email.create({
              data: {
                campaignId: campaign.id,
                prospectId: email.prospectId,
                subject: followUp.subject,
                body: followUp.body,
                type: emailType as "FOLLOWUP_1" | "FOLLOWUP_2" | "FOLLOWUP_3",
                status: "PENDING",
              },
            });
          } catch (err) {
            console.error(`Follow-up generation failed for ${email.prospect.email}:`, err);
          }
        }
      });
    }

    return { processed: activeCampaigns.length };
  }
);

export const sendPendingEmails = inngest.createFunction(
  {
    id: "send-pending-emails",
    name: "Send Pending Emails Batch",
    triggers: [{ cron: "*/15 9-18 * * 1-5" }],
  },
  async ({ step }) => {
    const result = await step.run("send-batch", async () => {
      const settings = await prisma.appSettings.findUnique({
        where: { id: "default" },
      });
      const dailyLimit = settings?.dailyEmailLimit ?? 50;
      const spacing = settings?.emailSpacingSeconds ?? 30;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = await prisma.email.count({
        where: {
          sentAt: { gte: today },
          status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
        },
      });

      const remaining = dailyLimit - sentToday;
      if (remaining <= 0) return { sent: 0, message: "Daily limit reached" };

      const pendingEmails = await prisma.email.findMany({
        where: {
          status: "PENDING",
          campaign: { status: "ACTIVE" },
        },
        include: { prospect: true },
        take: Math.min(remaining, 10),
      });

      let sent = 0;
      for (const email of pendingEmails) {
        try {
          const resendResult = await sendEmail({
            to: email.prospect.email,
            subject: email.subject,
            html: emailBodyToHtml(email.body),
          });

          await prisma.email.update({
            where: { id: email.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              resendId: resendResult?.id,
            },
          });

          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { sentCount: { increment: 1 } },
          });

          await prisma.prospect.update({
            where: { id: email.prospectId },
            data: {
              status: "CONTACTED",
              lastContactedAt: new Date(),
            },
          });

          sent++;

          if (spacing > 0 && sent < pendingEmails.length) {
            await new Promise((r) => setTimeout(r, spacing * 1000));
          }
        } catch {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "FAILED" },
          });
        }
      }

      return { sent };
    });

    return result;
  }
);
