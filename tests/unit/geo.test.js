const { calculateDistanceMeters, isWithinRadius } = require('../../src/utils/geo');

describe('geo.calculateDistanceMeters', () => {
  test('jarak antara dua titik yang identik adalah 0', () => {
    expect(calculateDistanceMeters(-6.2, 106.8, -6.2, 106.8)).toBeCloseTo(0, 5);
  });

  test('jarak Monas -> Bundaran HI (Jakarta) sekitar 3.4-3.6 km', () => {
    // Monas: -6.1754, 106.8272 | Bundaran HI: -6.1953, 106.8230
    const distance = calculateDistanceMeters(-6.1754, 106.8272, -6.1953, 106.8230);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(3000);
  });

  test('jarak simetris — urutan titik tidak mempengaruhi hasil', () => {
    const a = calculateDistanceMeters(-6.1754, 106.8272, -6.1953, 106.8230);
    const b = calculateDistanceMeters(-6.1953, 106.8230, -6.1754, 106.8272);
    expect(a).toBeCloseTo(b, 6);
  });

  test('jarak 1 derajat latitude sekitar 111 km (perkiraan kasar)', () => {
    const distance = calculateDistanceMeters(0, 0, 1, 0);
    expect(distance).toBeGreaterThan(110000);
    expect(distance).toBeLessThan(112000);
  });

  test('melempar TypeError kalau koordinat bukan angka valid', () => {
    expect(() => calculateDistanceMeters('a', 106.8, -6.2, 106.8)).toThrow(TypeError);
    expect(() => calculateDistanceMeters(NaN, 106.8, -6.2, 106.8)).toThrow(TypeError);
    expect(() => calculateDistanceMeters(undefined, 106.8, -6.2, 106.8)).toThrow(TypeError);
  });
});

describe('geo.isWithinRadius', () => {
  test('titik yang sama persis dengan pusat selalu dalam radius', () => {
    const result = isWithinRadius(-6.2, 106.8, -6.2, 106.8, 50);
    expect(result.withinRadius).toBe(true);
    expect(result.distanceMeters).toBeCloseTo(0, 5);
  });

  test('titik jauh di luar radius kecil dilaporkan withinRadius=false', () => {
    // ~2.2km dari pusat, radius toleransi cuma 200m
    const result = isWithinRadius(-6.1754, 106.8272, -6.1953, 106.8230, 200);
    expect(result.withinRadius).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(200);
  });

  test('titik sedikit bergeser tapi masih dalam radius besar', () => {
    // Sekitar puluhan meter dari pusat (pergeseran koordinat kecil)
    const result = isWithinRadius(-6.20001, 106.80001, -6.2, 106.8, 500);
    expect(result.withinRadius).toBe(true);
  });
});
