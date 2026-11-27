import { maskDeep, maskEmail, maskIp, piiViewOf } from '../../src/common/pii';

describe('pii', () => {
  it('shows full details to admins and masked ones to every other role', () => {
    expect(piiViewOf('ADMIN')).toBe('full');
    expect(piiViewOf('VIEWER')).toBe('masked');
  });

  it('keeps the first letter and the domain of an email', () => {
    expect(maskEmail('sara.h@example.com')).toBe('s•••@example.com');
    expect(maskEmail('not-an-email')).toBe('•••');
  });

  it('keeps the network half of an ip', () => {
    expect(maskIp('192.168.10.42')).toBe('192.168.x.x');
    expect(maskIp('::ffff:10.0.0.7')).toBe('10.0.x.x');
    expect(maskIp('2001:db8:85a3::7334')).toBe('2001:db8:x:x');
  });

  it('masks emails and ips at any depth of a payload, even inside text, and leaves the rest', () => {
    const payload = {
      before: { email: 'omar@sarwa.dev', role: 'VIEWER' },
      after: { email: 'omar@sarwa.dev', role: 'ADMIN' },
      ip: '198.18.0.1',
      notes: ['contact lina@sarwa.dev', 'lina@sarwa.dev'],
    };

    expect(maskDeep(payload)).toEqual({
      before: { email: 'o•••@sarwa.dev', role: 'VIEWER' },
      after: { email: 'o•••@sarwa.dev', role: 'ADMIN' },
      ip: '198.18.x.x',
      notes: ['contact l•••@sarwa.dev', 'l•••@sarwa.dev'],
    });
  });
});
