import { useEffect, useState } from 'react';
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerCloseButton,
  Box,
  Heading,
  Text,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
  Stack,
  Link,
  Spinner,
  Icon,
  Flex,
  HStack,
  Button,
  Grid,
  GridItem,
  Tooltip,
  Divider,
} from '@chakra-ui/react';
import {
  LuPhone,
  LuGlobe,
  LuMapPin,
  LuUserRound,
  LuBedDouble,
  LuCalendar,
  LuNavigation,
  LuLocateFixed,
  LuStethoscope,
  LuActivity,
  LuShieldCheck,
  LuFileText,
  LuHospital,
  LuTriangleAlert,
} from 'react-icons/lu';
import { getHospital } from '../api/hospitals.js';
import { buildDirectionsUrl } from '../utils/maps.js';

const titleCase = (s) =>
  typeof s === 'string'
    ? s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    : s;

const humanize = (s) => {
  if (typeof s !== 'string') return s;
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]{2,})/g, ' $1').replace(/\s+/g, ' ').trim();
};

function SectionHeader({ icon, title, count }) {
  return (
    <HStack spacing={2.5} mb={3}>
      <Flex
        w="28px"
        h="28px"
        borderRadius="8px"
        bg="brand.50"
        color="brand.700"
        align="center"
        justify="center"
      >
        <Icon as={icon} boxSize="14px" />
      </Flex>
      <Text fontSize="0.85rem" fontWeight={700} color="ink.900" letterSpacing="-0.01em">
        {title}
      </Text>
      {count != null && (
        <Tag size="sm" colorScheme="gray" borderRadius="pill" variant="subtle" fontSize="0.7rem">
          {count}
        </Tag>
      )}
    </HStack>
  );
}

function StatCard({ icon, label, value, accent = 'brand' }) {
  if (!value) return null;
  return (
    <Flex
      direction="column"
      align="flex-start"
      p={3}
      borderRadius="14px"
      bg="white"
      border="1px solid"
      borderColor="ink.100"
      gap={1.5}
      flex={1}
      minW={0}
    >
      <Flex
        w="32px"
        h="32px"
        borderRadius="10px"
        bg={`${accent}.50`}
        color={`${accent}.700`}
        align="center"
        justify="center"
      >
        <Icon as={icon} boxSize="15px" />
      </Flex>
      <Text fontSize="1.1rem" fontWeight={800} color="ink.900" lineHeight={1}>
        {value}
      </Text>
      <Text fontSize="0.7rem" color="ink.500" letterSpacing="0.03em" textTransform="uppercase">
        {label}
      </Text>
    </Flex>
  );
}

function SpecialtyChips({ items, max = 12 }) {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;
  const shown = expanded ? items : items.slice(0, max);
  const hidden = items.length - max;
  return (
    <Wrap spacing={1.5}>
      {shown.map((s) => (
        <WrapItem key={s}>
          <Tag
            size="md"
            colorScheme="teal"
            variant="subtle"
            borderRadius="pill"
            px={3}
            py={1}
            fontSize="0.78rem"
            fontWeight={600}
            textTransform="capitalize"
          >
            {humanize(s)}
          </Tag>
        </WrapItem>
      ))}
      {hidden > 0 && (
        <WrapItem>
          <Tag
            as="button"
            size="md"
            colorScheme="gray"
            variant="subtle"
            borderRadius="pill"
            px={3}
            cursor="pointer"
            onClick={() => setExpanded((v) => !v)}
            _hover={{ bg: 'brand.100', color: 'brand.700' }}
            transition="all 0.12s"
          >
            {expanded ? 'Show less' : `+${hidden} more`}
          </Tag>
        </WrapItem>
      )}
    </Wrap>
  );
}

function BulletList({ items, max = 5, color = 'brand' }) {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;
  const shown = expanded ? items : items.slice(0, max);
  const hidden = items.length - max;
  return (
    <Stack spacing={2}>
      {shown.map((item, i) => (
        <HStack key={i} spacing={2.5} align="flex-start">
          <Box w="6px" h="6px" borderRadius="full" bg={`${color}.500`} mt={2} flexShrink={0} />
          <Text fontSize="0.88rem" color="ink.700" lineHeight={1.5}>
            {item}
          </Text>
        </HStack>
      ))}
      {hidden > 0 && (
        <Button
          onClick={() => setExpanded((v) => !v)}
          variant="ghost"
          size="xs"
          color={`${color}.700`}
          fontWeight={600}
          fontSize="0.75rem"
          alignSelf="flex-start"
          pl="14px"
          h="auto"
          py={1}
          _hover={{ bg: `${color}.50` }}
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </Button>
      )}
    </Stack>
  );
}

function QuickAction({ icon, label, href, accent = 'brand', external }) {
  if (!href) return null;
  return (
    <Button
      as="a"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      flex={1}
      size="md"
      leftIcon={<Icon as={icon} boxSize="14px" />}
      bg="white"
      color={`${accent}.700`}
      border="1px solid"
      borderColor={`${accent}.200`}
      fontWeight={600}
      fontSize="0.85rem"
      borderRadius="12px"
      _hover={{ bg: `${accent}.50`, borderColor: `${accent}.400`, textDecoration: 'none' }}
    >
      {label}
    </Button>
  );
}

export default function HospitalDetailsDrawer({ id, onClose, userLocation, onRequestLocation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id == null) {
      setData(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getHospital(id, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [id]);

  const directionsUrl =
    data?.lat != null && data?.lng != null
      ? buildDirectionsUrl({
          origin: userLocation ?? null,
          destination: { lat: data.lat, lng: data.lng },
        })
      : null;

  const hasStats =
    data && (data.numberDoctors || data.capacity || data.yearEstablished);

  return (
    <Drawer
      isOpen={id != null}
      onClose={onClose}
      size={{ base: 'full', md: 'md' }}
      placement="right"
    >
      <DrawerOverlay bg="rgba(15, 23, 42, 0.5)" backdropFilter="blur(6px)" />
      <DrawerContent bg="ink.50">
        <DrawerCloseButton size="lg" top={4} right={4} zIndex={2} bg="rgba(255,255,255,0.85)" borderRadius="full" />
        <DrawerBody p={0}>
          {loading && (
            <Flex justify="center" align="center" minH="50vh">
              <Spinner color="brand.500" size="lg" thickness="3px" />
            </Flex>
          )}

          {error && (
            <Flex direction="column" align="center" justify="center" minH="50vh" px={6} gap={2}>
              <Icon as={LuTriangleAlert} color="danger.500" boxSize="32px" />
              <Text color="danger.600" fontSize="0.9rem" textAlign="center">
                {error}
              </Text>
            </Flex>
          )}

          {data && !loading && (
            <Box>
              {/* Hero */}
              <Box
                bgGradient="linear(135deg, brand.700 0%, brand.500 100%)"
                color="white"
                px={{ base: 5, md: 7 }}
                pt={12}
                pb={6}
                position="relative"
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top="-80px"
                  right="-80px"
                  w="220px"
                  h="220px"
                  borderRadius="full"
                  bg="rgba(255,255,255,0.08)"
                  pointerEvents="none"
                />
                <Box position="relative">
                  <HStack spacing={2} mb={3} flexWrap="wrap">
                    {data.facility_type && (
                      <Tag
                        bg="rgba(255,255,255,0.18)"
                        color="white"
                        backdropFilter="blur(8px)"
                        border="1px solid rgba(255,255,255,0.25)"
                        borderRadius="pill"
                        fontSize="0.7rem"
                        fontWeight={600}
                        textTransform="capitalize"
                      >
                        <Icon as={LuHospital} boxSize="11px" mr={1} />
                        <TagLabel>{titleCase(data.facility_type)}</TagLabel>
                      </Tag>
                    )}
                  </HStack>
                  <Heading
                    fontSize={{ base: '1.45rem', md: '1.7rem' }}
                    fontWeight={800}
                    letterSpacing="-0.02em"
                    lineHeight={1.15}
                  >
                    {titleCase(data.name)}
                  </Heading>
                  <HStack spacing={1.5} mt={2} color="rgba(255,255,255,0.88)">
                    <Icon as={LuMapPin} boxSize="14px" />
                    <Text fontSize="0.9rem">
                      {[titleCase(data.city), titleCase(data.state)].filter(Boolean).join(', ') ||
                        'Location unknown'}
                    </Text>
                  </HStack>

                  {directionsUrl && (
                    <Stack spacing={2} mt={5}>
                      <Button
                        as="a"
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="lg"
                        leftIcon={<Icon as={LuNavigation} boxSize="18px" />}
                        bg="white"
                        color="brand.700"
                        fontWeight={700}
                        boxShadow="0 4px 14px rgba(0,0,0,0.15)"
                        _hover={{ bg: 'brand.50', transform: 'translateY(-1px)' }}
                        _active={{ transform: 'translateY(0)' }}
                        transition="all 0.15s"
                      >
                        {userLocation ? 'Get directions from my location' : 'Open route in Maps'}
                      </Button>
                      {!userLocation && (
                        <Button
                          onClick={onRequestLocation}
                          size="sm"
                          variant="ghost"
                          leftIcon={<Icon as={LuLocateFixed} boxSize="14px" />}
                          color="white"
                          fontWeight={500}
                          fontSize="0.78rem"
                          opacity={0.9}
                          _hover={{ bg: 'rgba(255,255,255,0.1)', opacity: 1 }}
                        >
                          Use my location for an exact route
                        </Button>
                      )}
                    </Stack>
                  )}

                  {(data.phone || data.website) && (
                    <HStack mt={3} spacing={2}>
                      {data.phone && (
                        <QuickAction
                          icon={LuPhone}
                          label="Call"
                          href={`tel:${data.phone}`}
                        />
                      )}
                      {data.website && (
                        <QuickAction
                          icon={LuGlobe}
                          label="Website"
                          href={
                            data.website.startsWith('http')
                              ? data.website
                              : `https://${data.website}`
                          }
                          external
                        />
                      )}
                    </HStack>
                  )}
                </Box>
              </Box>

              {/* Body */}
              <Box px={{ base: 5, md: 7 }} py={6}>
                <Stack spacing={6}>
                  {hasStats && (
                    <Box>
                      <SectionHeader icon={LuActivity} title="Quick facts" />
                      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                        <GridItem>
                          <StatCard
                            icon={LuBedDouble}
                            label="Beds"
                            value={data.capacity}
                            accent="brand"
                          />
                        </GridItem>
                        <GridItem>
                          <StatCard
                            icon={LuUserRound}
                            label="Doctors"
                            value={data.numberDoctors}
                            accent="sky"
                          />
                        </GridItem>
                        <GridItem>
                          <StatCard
                            icon={LuCalendar}
                            label="Established"
                            value={data.yearEstablished}
                            accent="brand"
                          />
                        </GridItem>
                      </Grid>
                    </Box>
                  )}

                  {data.specialties?.length > 0 && (
                    <Box>
                      <SectionHeader
                        icon={LuStethoscope}
                        title="Specialties"
                        count={data.specialties.length}
                      />
                      <SpecialtyChips items={data.specialties} max={12} />
                    </Box>
                  )}

                  {data.description && (
                    <Box>
                      <SectionHeader icon={LuFileText} title="About" />
                      <Text fontSize="0.9rem" color="ink.700" lineHeight={1.6}>
                        {data.description}
                      </Text>
                    </Box>
                  )}

                  {data.capabilities?.length > 0 && (
                    <Box>
                      <SectionHeader
                        icon={LuShieldCheck}
                        title="Capabilities"
                        count={data.capabilities.length}
                      />
                      <BulletList items={data.capabilities} max={5} color="brand" />
                    </Box>
                  )}

                  {data.procedures?.length > 0 && (
                    <Box>
                      <SectionHeader
                        icon={LuActivity}
                        title="Top procedures"
                        count={data.procedures.length}
                      />
                      <BulletList items={data.procedures} max={5} color="sky" />
                    </Box>
                  )}

                  {data.address && (
                    <>
                      <Divider borderColor="ink.100" />
                      <Box>
                        <SectionHeader icon={LuMapPin} title="Address" />
                        <Text fontSize="0.85rem" color="ink.600" lineHeight={1.6}>
                          {data.address}
                        </Text>
                      </Box>
                    </>
                  )}
                </Stack>
              </Box>
            </Box>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
