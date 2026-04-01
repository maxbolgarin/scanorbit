import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { encryptOAuthToken, decryptOAuthToken } from '../lib/crypto.js';
import { slackIntegrations, slackChannelMappings } from '../db/schema.js';
import type { SlackIntegration, SlackChannelMapping } from '../db/schema.js';
import { HTTP404Error } from '../lib/errors.js';

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface ChannelMappingInput {
  eventType: string;
  channelId: string;
  channelName: string;
}

export const slackService = {
  // Generate OAuth authorize URL
  getOAuthUrl(orgId: string): string {
    const state = Buffer.from(JSON.stringify({ orgId })).toString('base64url');
    const params = new URLSearchParams({
      client_id: config.slack.clientId,
      scope: 'chat:write,channels:read,groups:read',
      redirect_uri: `${config.frontendUrl}/integrations/slack/callback`,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params}`;
  },

  // Exchange OAuth code for token, encrypt, store
  async handleOAuthCallback(code: string, orgId: string, userId: string): Promise<SlackIntegration> {
    // Exchange code for token
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: `${config.frontendUrl}/integrations/slack/callback`,
      }),
    });
    const data = await response.json() as any;
    if (!data.ok) throw new Error(`Slack OAuth failed: ${data.error}`);

    const encryptedToken = encryptOAuthToken(data.access_token);

    // Upsert (one Slack integration per org)
    const [integration] = await db
      .insert(slackIntegrations)
      .values({
        orgId,
        teamId: data.team.id,
        teamName: data.team.name,
        accessToken: encryptedToken,
        botUserId: data.bot_user_id,
        installedBy: userId,
      })
      .onConflictDoUpdate({
        target: slackIntegrations.orgId,
        set: {
          teamId: data.team.id,
          teamName: data.team.name,
          accessToken: encryptedToken,
          botUserId: data.bot_user_id,
          installedBy: userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return integration;
  },

  // Get integration (without decrypted token)
  async getIntegration(orgId: string): Promise<SlackIntegration | null> {
    const [integration] = await db
      .select()
      .from(slackIntegrations)
      .where(eq(slackIntegrations.orgId, orgId))
      .limit(1);
    return integration ?? null;
  },

  // List channels from Slack API
  async listChannels(orgId: string): Promise<SlackChannel[]> {
    const integration = await this.getIntegration(orgId);
    if (!integration) throw new HTTP404Error('Slack integration not found');

    const token = decryptOAuthToken(integration.accessToken);
    const response = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json() as any;
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);

    return (data.channels || []).map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private,
    }));
  },

  // Send a message to a Slack channel
  async sendMessage(orgId: string, channelId: string, text: string, blocks?: object[]): Promise<void> {
    const integration = await this.getIntegration(orgId);
    if (!integration) return; // silently skip if no integration

    const token = decryptOAuthToken(integration.accessToken);
    const body: any = { channel: channelId, text };
    if (blocks) body.blocks = blocks;

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json() as any;
    if (!data.ok) {
      logger.error('Slack message failed', new Error(data.error), { channelId, orgId });
    }
  },

  // Send notification to mapped channels for an event type
  async sendNotification(orgId: string, eventType: string, data: object): Promise<void> {
    const integration = await this.getIntegration(orgId);
    if (!integration) return;

    const mappings = await db
      .select()
      .from(slackChannelMappings)
      .where(and(
        eq(slackChannelMappings.slackIntegrationId, integration.id),
        eq(slackChannelMappings.eventType, eventType),
      ));

    for (const mapping of mappings) {
      const { text, blocks } = formatSlackNotification(eventType, data);
      await this.sendMessage(orgId, mapping.channelId, text, blocks);
    }
  },

  // Update channel mappings (replace all for this integration)
  async updateChannelMappings(orgId: string, mappings: ChannelMappingInput[]): Promise<SlackChannelMapping[]> {
    const integration = await this.getIntegration(orgId);
    if (!integration) throw new HTTP404Error('Slack integration not found');

    // Delete existing and insert new (within transaction)
    return await db.transaction(async (tx) => {
      await tx.delete(slackChannelMappings)
        .where(eq(slackChannelMappings.slackIntegrationId, integration.id));

      if (mappings.length === 0) return [];

      return await tx.insert(slackChannelMappings)
        .values(mappings.map(m => ({
          slackIntegrationId: integration.id,
          eventType: m.eventType,
          channelId: m.channelId,
          channelName: m.channelName,
        })))
        .returning();
    });
  },

  // Disconnect Slack (delete integration + mappings)
  async disconnect(orgId: string): Promise<void> {
    await db.delete(slackIntegrations).where(eq(slackIntegrations.orgId, orgId));
    // Channel mappings are cascade-deleted
  },
};

// Format Slack Block Kit notifications
function formatSlackNotification(eventType: string, data: any): { text: string; blocks: object[] } {
  switch (eventType) {
    case 'scan.completed': {
      const text = `Scan completed: ${data.data?.resourcesDiscovered ?? 0} resources, ${data.data?.findingsNew ?? 0} new findings`;
      return {
        text,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `:white_check_mark: *Scan Completed*\n${text}` } },
        ],
      };
    }
    case 'finding.new_critical': {
      const count = data.data?.count ?? 0;
      const text = `${count} new critical finding${count !== 1 ? 's' : ''} detected`;
      return {
        text,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `:rotating_light: *New Critical Finding${count !== 1 ? 's' : ''}*\n${text}` } },
        ],
      };
    }
    case 'finding.new_high': {
      const count = data.data?.count ?? 0;
      const text = `${count} new high severity finding${count !== 1 ? 's' : ''} detected`;
      return {
        text,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `:warning: *New High Severity Finding${count !== 1 ? 's' : ''}*\n${text}` } },
        ],
      };
    }
    default: {
      return { text: `ScanOrbit notification: ${eventType}`, blocks: [] };
    }
  }
}
