export function buildDirectionsUrl({ destination, origin } = {}) {
  if (destination?.lat == null || destination?.lng == null) return null;
  const params = new URLSearchParams({ api: '1' });
  if (origin?.lat != null && origin?.lng != null) {
    params.set('origin', `${origin.lat},${origin.lng}`);
  }
  params.set('destination', `${destination.lat},${destination.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildPlaceUrl({ lat, lng, label } = {}) {
  if (lat == null || lng == null) return null;
  const params = new URLSearchParams({ api: '1', query: `${lat},${lng}` });
  return `https://www.google.com/maps/search/?${params.toString()}${label ? `&query_place_id=${encodeURIComponent(label)}` : ''}`;
}

export function openDirections({ destination, origin }) {
  const url = buildDirectionsUrl({ destination, origin });
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
