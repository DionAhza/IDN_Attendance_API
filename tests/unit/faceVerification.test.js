const mockQuery = jest.fn();

jest.mock('../../src/config/database', () => ({
  query: (...args) => mockQuery(...args),
}));

const faceVerificationService = require('../../src/services/faceVerification.service');
const schoolConfig = require('../../src/config/school');
const { cosineSimilarity } = faceVerificationService;

beforeEach(() => {
  mockQuery.mockReset();
  // config/school.js meng-cache school_settings di module scope (TTL 60s)
  // supaya query DB tidak diulang tiap request di production. Di test,
  // cache ini harus di-invalidate tiap kasus supaya urutan mockQuery
  // (mockResolvedValueOnce) selalu sesuai dengan urutan query yang
  // benar-benar dieksekusi oleh service.
  schoolConfig.invalidateCache();
});

describe('faceVerification.cosineSimilarity', () => {
  test('vector identik menghasilkan similarity 1', () => {
    const vector = [0.1, 0.2, 0.3, 0.4, 0.5, 0.1, 0.2, 0.3, 0.4, 0.5];
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
  });

  test('vector berlawanan arah menghasilkan similarity -1', () => {
    const vectorA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const vectorB = [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(cosineSimilarity(vectorA, vectorB)).toBeCloseTo(-1, 5);
  });

  test('vector orthogonal menghasilkan similarity 0', () => {
    const vectorA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const vectorB = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(cosineSimilarity(vectorA, vectorB)).toBeCloseTo(0, 5);
  });

  test('melempar AppError kalau dimensi vector berbeda', () => {
    const vectorA = new Array(10).fill(0.1);
    const vectorB = new Array(12).fill(0.1);
    expect(() => cosineSimilarity(vectorA, vectorB)).toThrow(/Dimensi/);
  });

  test('melempar error kalau input bukan array', () => {
    expect(() => cosineSimilarity('bukan-array', [1, 2, 3])).toThrow();
  });

  test('mengembalikan 0 kalau salah satu vector adalah nol (hindari divide-by-zero)', () => {
    const zeroVector = new Array(10).fill(0);
    const normalVector = new Array(10).fill(0.5);
    expect(cosineSimilarity(zeroVector, normalVector)).toBe(0);
  });
});

describe('faceVerification.verifyFace', () => {
  const FAKE_ENCODING = new Array(10).fill(0).map((_, i) => (i + 1) / 10);

  test('return enrolled=false kalau siswa belum punya encoding terdaftar', async () => {
    // 1. getStudentByUserId
    mockQuery.mockResolvedValueOnce([{ id: 1, full_name: 'Ahmad', is_active: 1 }]);
    // 2. getSetting (face_match_threshold) -> getAllSettings query
    mockQuery.mockResolvedValueOnce([{ setting_key: 'face_match_threshold', setting_value: '0.6' }]);
    // 3. getRawEncoding -> no rows
    mockQuery.mockResolvedValueOnce([]);

    const result = await faceVerificationService.verifyFace(99, FAKE_ENCODING);

    expect(result.enrolled).toBe(false);
    expect(result.matched).toBe(false);
    expect(result.score).toBeNull();
  });

  test('matched=true kalau similarity di atas threshold', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, full_name: 'Ahmad', is_active: 1 }]);
    mockQuery.mockResolvedValueOnce([{ setting_key: 'face_match_threshold', setting_value: '0.6' }]);
    mockQuery.mockResolvedValueOnce([{ encoding: JSON.stringify(FAKE_ENCODING) }]);

    const result = await faceVerificationService.verifyFace(99, FAKE_ENCODING);

    expect(result.enrolled).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.score).toBeCloseTo(1, 3);
  });

  test('matched=false kalau similarity di bawah threshold', async () => {
    const differentEncoding = new Array(10).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));

    mockQuery.mockResolvedValueOnce([{ id: 1, full_name: 'Ahmad', is_active: 1 }]);
    mockQuery.mockResolvedValueOnce([{ setting_key: 'face_match_threshold', setting_value: '0.6' }]);
    mockQuery.mockResolvedValueOnce([{ encoding: JSON.stringify(differentEncoding) }]);

    const result = await faceVerificationService.verifyFace(99, FAKE_ENCODING);

    expect(result.enrolled).toBe(true);
    expect(result.matched).toBe(false);
  });

  test('melempar AppError 403 kalau akun siswa nonaktif', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, full_name: 'Ahmad', is_active: 0 }]);

    await expect(faceVerificationService.verifyFace(99, FAKE_ENCODING)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('melempar AppError 404 kalau profil siswa tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await expect(faceVerificationService.verifyFace(99, FAKE_ENCODING)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('faceVerification.overrideFace', () => {
  test('insert log override dan kembalikan baris yang baru dibuat', async () => {
    // ensureStudentExists
    mockQuery.mockResolvedValueOnce([{ id: 5, full_name: 'Citra' }]);
    // INSERT face_override_logs
    mockQuery.mockResolvedValueOnce({ insertId: 42, affectedRows: 1 });
    // SELECT baris terbaru
    mockQuery.mockResolvedValueOnce([
      {
        id: 42,
        student_id: 5,
        attendance_id: null,
        attendance_type: 'check_in',
        overridden_by: 1,
        similarity_score: 0.42,
        reason: 'Wajah tertutup masker, dikonfirmasi manual oleh wali kelas',
        created_at: '2026-08-19 07:10:00',
      },
    ]);

    const result = await faceVerificationService.overrideFace({
      overriddenByUserId: 1,
      studentId: 5,
      attendanceId: null,
      attendanceType: 'check_in',
      similarityScore: 0.42,
      reason: 'Wajah tertutup masker, dikonfirmasi manual oleh wali kelas',
    });

    expect(result.id).toBe(42);
    expect(result.reason).toContain('masker');
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  test('melempar AppError 404 kalau siswa tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await expect(
      faceVerificationService.overrideFace({
        overriddenByUserId: 1,
        studentId: 999,
        attendanceType: 'check_in',
        reason: 'Alasan override yang cukup panjang',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
