export type ChannelMessage = {
  text: string;
  imageUrl?: string;
};

export type ChannelSendResult = {
  ok: boolean;
  externalMessageId?: string;
  error?: string;
};

export interface ChannelAdapter {
  readonly type: string;
  validateConnection(): Promise<boolean>;
  sendOffer(message: ChannelMessage): Promise<ChannelSendResult>;
}

export class MockChannelAdapter implements ChannelAdapter {
  readonly type = 'MOCK';

  async validateConnection(): Promise<boolean> {
    return true;
  }

  async sendOffer(message: ChannelMessage): Promise<ChannelSendResult> {
    console.log('[MOCK CHANNEL] publicacao simulada');
    console.log(message.text);
    return { ok: true, externalMessageId: `mock-${Date.now()}` };
  }
}
