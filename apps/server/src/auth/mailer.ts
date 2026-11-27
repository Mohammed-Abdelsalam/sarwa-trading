import { Logger } from '@nestjs/common';

export type MailKind = 'verify_email' | 'password_reset' | 'password_changed' | 'admin_invite';

export interface Mail {
  to: string;
  kind: MailKind;
  subject: string;
  link?: string;
}

export abstract class Mailer {
  abstract send(mail: Mail): Promise<void>;
}

// Dev and test: the link is printed instead of sent. A real provider replaces it in production.
export class LogMailer extends Mailer {
  private readonly logger = new Logger('Mail');

  send(mail: Mail): Promise<void> {
    this.logger.log(`${mail.kind} → ${mail.to}${mail.link ? ` ${mail.link}` : ''}`);
    return Promise.resolve();
  }
}
