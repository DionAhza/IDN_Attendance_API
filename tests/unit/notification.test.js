// Mock db & nodemailer supaya require('notification.service') tidak
// mencoba bikin koneksi MySQL/SMTP asli — kita cuma menguji fungsi
// murni (compose*, normalizePhoneNumber, getEnabledChannels) di sini,
// bukan alur pengiriman end-to-end (itu ranah integration test).
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

const {
  getEnabledChannels,
  composeEmail,
  composeWhatsappMessage,
  normalizePhoneNumber,
} = require('../../src/services/notification.service');

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('notification.getEnabledChannels', () => {
  test('default hanya "email" kalau NOTIFICATION_CHANNELS tidak diisi', () => {
    delete process.env.NOTIFICATION_CHANNELS;
    expect(getEnabledChannels()).toEqual(['email']);
  });

  test('parse comma-separated channel dengan benar', () => {
    process.env.NOTIFICATION_CHANNELS = 'email,whatsapp';
    expect(getEnabledChannels().sort()).toEqual(['email', 'whatsapp']);
  });

  test('trim spasi & lowercase channel', () => {
    process.env.NOTIFICATION_CHANNELS = ' Email , WhatsApp ';
    expect(getEnabledChannels().sort()).toEqual(['email', 'whatsapp']);
  });

  test('buang channel yang tidak dikenal, fallback default kalau semua tidak dikenal', () => {
    process.env.NOTIFICATION_CHANNELS = 'sms,telegram';
    expect(getEnabledChannels()).toEqual(['email']);
  });

  test('buang duplikat channel', () => {
    process.env.NOTIFICATION_CHANNELS = 'email,email,whatsapp,whatsapp';
    expect(getEnabledChannels().sort()).toEqual(['email', 'whatsapp']);
  });
});

describe('notification.normalizePhoneNumber', () => {
  test('nomor lokal berawalan 0 diubah ke 62', () => {
    expect(normalizePhoneNumber('081234567890')).toBe('6281234567890');
  });

  test('nomor yang sudah berawalan 62 dibiarkan apa adanya', () => {
    expect(normalizePhoneNumber('6281234567890')).toBe('6281234567890');
  });

  test('membuang karakter non-digit (spasi, strip, plus)', () => {
    expect(normalizePhoneNumber('+62 812-3456-7890')).toBe('6281234567890');
  });

  test('return null untuk input kosong/null/undefined', () => {
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });
});

describe('notification.composeEmail', () => {
  test('STUDENT_CHECK_IN menghasilkan subject & html yang berisi nama siswa', () => {
    const { subject, html } = composeEmail('STUDENT_CHECK_IN', {
      studentName: 'Ahmad Fauzi',
      time: '2026-08-19 06:55:00',
      status: 'present',
    });
    expect(subject).toContain('Ahmad Fauzi');
    expect(subject).toContain('absen masuk');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('06:55:00');
  });

  test('status "late" menghasilkan label Terlambat di body email', () => {
    const { html } = composeEmail('STUDENT_CHECK_IN', {
      studentName: 'Budi',
      time: '2026-08-19 07:30:00',
      status: 'late',
    });
    expect(html).toContain('Terlambat');
  });

  test('type tidak dikenal tetap menghasilkan subject & html fallback (tidak throw)', () => {
    const { subject, html } = composeEmail('UNKNOWN_TYPE', {
      studentName: 'Citra',
      time: '2026-08-19 07:00:00',
      status: 'present',
    });
    expect(subject).toContain('Citra');
    expect(html).toContain('UNKNOWN_TYPE');
  });
});

describe('notification.composeWhatsappMessage', () => {
  test('STUDENT_CHECK_OUT menghasilkan teks plain (tanpa tag HTML)', () => {
    const text = composeWhatsappMessage('STUDENT_CHECK_OUT', {
      studentName: 'Ahmad Fauzi',
      time: '2026-08-19 15:05:00',
      status: 'present',
    });
    expect(text).toContain('Ahmad Fauzi');
    expect(text).toContain('absen pulang');
    expect(text).not.toContain('<div>');
    expect(text).not.toContain('<table>');
  });

  test('STUDENT_LATE menyertakan peringatan keterlambatan', () => {
    const text = composeWhatsappMessage('STUDENT_LATE', {
      studentName: 'Dewi',
      time: '2026-08-19 07:45:00',
      status: 'late',
    });
    expect(text).toContain('Peringatan Keterlambatan');
    expect(text).toContain('Dewi');
  });
});
