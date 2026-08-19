// ==========================================
// Geo utils — Phase 14 (GPS Geofencing)
// ==========================================
// Menghitung jarak antara dua titik koordinat (lat/long) di permukaan
// bumi memakai formula Haversine. Dipakai untuk validasi geofencing
// saat siswa check-in/check-out — memastikan siswa benar-benar berada
// di area sekolah (dalam radius toleransi tertentu), bukan sekadar
// mengandalkan input GPS klien yang bisa dipalsukan tanpa validasi ini.
// ==========================================

const EARTH_RADIUS_METERS = 6371000; // jari-jari bumi rata-rata (meter)

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Hitung jarak great-circle antara dua koordinat (lat1,lon1) dan
 * (lat2,lon2) memakai formula Haversine. Return jarak dalam METER.
 *
 * Formula:
 *   a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
 *   c = 2·atan2(√a, √(1−a))
 *   d = R·c
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(isFiniteNumber)) {
    throw new TypeError('Semua koordinat (lat1, lon1, lat2, lon2) harus berupa angka valid');
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Cek apakah titik (lat, lon) berada dalam radius (meter) dari titik
 * pusat (centerLat, centerLon). Return { withinRadius, distanceMeters }
 * supaya caller bisa sekaligus menampilkan jarak aktual ke user/log.
 */
function isWithinRadius(lat, lon, centerLat, centerLon, radiusMeters) {
  const distanceMeters = calculateDistanceMeters(lat, lon, centerLat, centerLon);
  return {
    withinRadius: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}

module.exports = { calculateDistanceMeters, isWithinRadius, EARTH_RADIUS_METERS };
