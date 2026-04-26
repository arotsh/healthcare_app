import { useEffect, useMemo } from 'react';
import { Box, Flex, Heading, Text, Button, Icon, Link, HStack, Tag } from '@chakra-ui/react';
import { LuMap, LuLocateFixed, LuNavigation, LuArrowRight } from 'react-icons/lu';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../styles/map.css';
import { buildDirectionsUrl } from '../utils/maps.js';

const titleCase = (s) =>
  typeof s === 'string'
    ? s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    : s;

const hospitalIcon = L.divIcon({
  className: 'hospital-marker',
  html: `
    <div class="hospital-pin">
      <div class="hospital-pin-bg"></div>
      <div class="hospital-pin-icon">+</div>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 38],
  popupAnchor: [0, -36],
});

const userIcon = L.divIcon({
  className: 'user-marker',
  html: `
    <div class="user-pin">
      <div class="user-pin-pulse"></div>
      <div class="user-pin-dot"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FlyToUser({ userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 12, { duration: 0.8 });
    }
  }, [map, userLocation]);
  return null;
}

function FitToMarkers({ markers, userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) return;
    if (markers.length === 0) return;
    const points = markers.map((m) => [m.lat, m.lng]);
    if (points.length === 1) {
      map.flyTo(points[0], 12, { duration: 0.6 });
      return;
    }
    const bounds = L.latLngBounds(points);
    map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 11, duration: 0.6 });
  }, [markers, userLocation, map]);
  return null;
}

export default function MapSection({
  items,
  userLocation,
  onRequestLocation,
  onOpenDetails,
  locationStatus,
}) {
  const markers = useMemo(
    () => (items ?? []).filter((h) => h.lat != null && h.lng != null),
    [items]
  );

  return (
    <Box
      id="map-section"
      bg="white"
      borderRadius="card"
      p={{ base: 4, md: 7 }}
      boxShadow="soft"
      border="1px solid"
      borderColor="ink.100"
    >
      <Flex justify="space-between" align="flex-start" mb={5} wrap="wrap" gap={3}>
        <Box>
          <HStack spacing={2.5} mb={1}>
            <Flex
              w="36px"
              h="36px"
              borderRadius="10px"
              bg="brand.50"
              align="center"
              justify="center"
            >
              <Icon as={LuMap} color="brand.700" boxSize="18px" />
            </Flex>
            <Heading as="h2" fontSize={{ base: '1.1rem', md: '1.35rem' }} color="ink.900">
              Facility Map
            </Heading>
            <Tag colorScheme="teal" borderRadius="pill" fontSize="0.65rem" px={2}>
              {markers.length}
            </Tag>
          </HStack>
          <Text color="ink.500" fontSize="0.9rem">
            {markers.length === 0
              ? 'No facilities to plot.'
              : 'Tap any marker to see name, location, and route options.'}
          </Text>
        </Box>
        <Button
          onClick={onRequestLocation}
          isLoading={locationStatus === 'pending'}
          loadingText="Locating"
          leftIcon={<Icon as={LuLocateFixed} boxSize="14px" />}
          size="sm"
          variant="outline"
          borderColor={userLocation ? 'success.500' : 'brand.200'}
          color={userLocation ? 'success.600' : 'brand.700'}
          fontWeight={600}
          _hover={{ bg: userLocation ? 'success.50' : 'brand.50' }}
        >
          {userLocation ? 'Centered on you' : 'Find near me'}
        </Button>
      </Flex>

      <Box
        position="relative"
        h={{ base: '380px', md: '500px' }}
        w="100%"
        borderRadius="20px"
        overflow="hidden"
        border="1px solid"
        borderColor="ink.100"
        boxShadow="inset 0 1px 4px rgba(15, 23, 42, 0.04)"
      >
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
          {markers.map((h) => {
            const directionsUrl = buildDirectionsUrl({
              origin: userLocation ?? null,
              destination: { lat: h.lat, lng: h.lng },
            });
            return (
              <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
                <Popup minWidth={220}>
                  <strong>{titleCase(h.name)}</strong>
                  <br />
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                    {[titleCase(h.city), titleCase(h.state)].filter(Boolean).join(', ') || '—'}
                  </span>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <a
                      onClick={() => onOpenDetails(h.id)}
                      style={{
                        cursor: 'pointer',
                        background: '#f0fdfa',
                        color: '#0f766e',
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      Details →
                    </a>
                    {directionsUrl && (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
                          color: 'white',
                          padding: '6px 10px',
                          borderRadius: 8,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          textDecoration: 'none',
                        }}
                      >
                        {userLocation ? 'Route from me' : 'Open route'}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <strong>You are here</strong>
              </Popup>
            </Marker>
          )}
          <FlyToUser userLocation={userLocation} />
          <FitToMarkers markers={markers} userLocation={userLocation} />
        </MapContainer>

        {/* Legend overlay */}
        <Box
          position="absolute"
          bottom={3}
          left={3}
          bg="rgba(255,255,255,0.95)"
          backdropFilter="blur(8px)"
          borderRadius="10px"
          border="1px solid"
          borderColor="ink.100"
          px={3}
          py={2}
          boxShadow="0 4px 12px rgba(15, 23, 42, 0.08)"
          zIndex={500}
        >
          <HStack spacing={3}>
            <HStack spacing={1.5}>
              <Box
                w="12px"
                h="14px"
                bgGradient="linear(135deg, brand.500, brand.700)"
                borderRadius="50% 50% 50% 0"
                transform="rotate(-45deg)"
                border="1.5px solid white"
              />
              <Text fontSize="0.7rem" color="ink.700" fontWeight={500}>
                Facility
              </Text>
            </HStack>
            {userLocation && (
              <HStack spacing={1.5}>
                <Box
                  w="10px"
                  h="10px"
                  borderRadius="full"
                  bg="sky.500"
                  border="2px solid white"
                  boxShadow="0 0 0 1px rgba(14, 165, 233, 0.3)"
                />
                <Text fontSize="0.7rem" color="ink.700" fontWeight={500}>
                  You
                </Text>
              </HStack>
            )}
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}
