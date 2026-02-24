export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp?: string;
}

export const sendDiscordMessage = async (
  webhookUrl: string,
  content?: string,
  embeds?: DiscordEmbed[]
): Promise<void> => {
  try {
    const body: Record<string, unknown> = {};
    if (content) body.content = content;
    if (embeds) body.embeds = embeds;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[discord] webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Notifications must never crash the pipeline
    console.error('[discord] webhook error:', error instanceof Error ? error.message : error);
  }
};
