export function haversineDistanceKm(
  firstPoint: google.maps.LatLngLiteral,
  secondPoint: google.maps.LatLngLiteral
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(secondPoint.lat - firstPoint.lat);
  const longitudeDelta = toRadians(secondPoint.lng - firstPoint.lng);
  const firstLatitude = toRadians(firstPoint.lat);
  const secondLatitude = toRadians(secondPoint.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

export function scoreFromDistance(distanceKm: number) {
  const maxPoints = 5000;

  return Math.max(0, Math.min(maxPoints, Math.round(maxPoints * Math.exp(-distanceKm / 1500))));
}

export function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return "Tahmin yok";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(distanceKm >= 100 ? 0 : 1)} km`;
}

export function formatPoints(points: number) {
  return new Intl.NumberFormat("tr-TR").format(points);
}

export function accuracyLabel(distanceKm: number | null) {
  if (distanceKm === null) {
    return "Sure doldu, tahmin gelmedi";
  }

  if (distanceKm < 1) {
    return "Neredeyse tam isabet";
  }

  if (distanceKm < 25) {
    return "Cok yakin";
  }

  if (distanceKm < 100) {
    return "Iyi tahmin";
  }

  if (distanceKm < 500) {
    return "Fena degil";
  }

  if (distanceKm < 1500) {
    return "Uzak kaldin";
  }

  return "Cok uzaktin";
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
