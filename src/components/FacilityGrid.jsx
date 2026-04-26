import {
  Grid,
  GridItem,
  Box,
  Flex,
  HStack,
  Text,
  Tag,
  Wrap,
  WrapItem,
  Icon,
  IconButton,
  Tooltip,
  Spinner,
} from '@chakra-ui/react';
import {
  LuHospital,
  LuMapPin,
  LuPhone,
  LuGlobe,
  LuNavigation,
  LuArrowRight,
} from 'react-icons/lu';
import { buildDirectionsUrl } from '../utils/maps.js';

const titleCase = (s) =>
  typeof s === 'string'
    ? s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    : s;

const humanize = (s) => {
  if (typeof s !== 'string') return s;
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
};

function ActionIcon({ label, icon, href, accent = 'brand', onClick, external }) {
  if (!href && !onClick) return null;
  const stop = (e) => e.stopPropagation();
  return (
    <Tooltip label={label} placement="top" hasArrow>
      <IconButton
        as={href ? 'a' : undefined}
        href={href}
        onClick={onClick ? (e) => { stop(e); onClick(); } : stop}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        aria-label={label}
        icon={<Icon as={icon} boxSize="14px" />}
        size="sm"
        bg={`${accent}.50`}
        color={`${accent}.700`}
        border="1px solid"
        borderColor={`${accent}.100`}
        borderRadius="10px"
        _hover={{ bg: `${accent}.500`, color: 'white', borderColor: `${accent}.500` }}
        transition="all 0.15s"
      />
    </Tooltip>
  );
}

function FacilityCard({ facility, userLocation, onOpenDetails }) {
  const directionsUrl =
    facility.lat != null && facility.lng != null
      ? buildDirectionsUrl({
          origin: userLocation ?? null,
          destination: { lat: facility.lat, lng: facility.lng },
        })
      : null;

  const phoneUrl = facility.phone ? `tel:${facility.phone}` : null;
  const websiteUrl = facility.website
    ? facility.website.startsWith('http')
      ? facility.website
      : `https://${facility.website}`
    : null;

  return (
    <Box
      onClick={() => onOpenDetails(facility.id)}
      role="button"
      cursor="pointer"
      bg="white"
      borderRadius="16px"
      border="1px solid"
      borderColor="ink.100"
      p={4}
      h="100%"
      display="flex"
      flexDirection="column"
      transition="all 0.18s"
      _hover={{
        borderColor: 'brand.300',
        transform: 'translateY(-2px)',
        boxShadow: 'soft',
      }}
    >
      <HStack spacing={3} align="flex-start" mb={3}>
        <Flex
          w="40px"
          h="40px"
          borderRadius="12px"
          bgGradient="linear(135deg, brand.50, brand.100)"
          color="brand.700"
          align="center"
          justify="center"
          flexShrink={0}
        >
          <Icon as={LuHospital} boxSize="18px" />
        </Flex>
        <Box minW={0} flex={1}>
          <Text
            fontSize="0.95rem"
            fontWeight={700}
            color="ink.900"
            noOfLines={1}
            lineHeight={1.25}
          >
            {titleCase(facility.name) || 'Unnamed facility'}
          </Text>
          <HStack spacing={1} color="ink.500" fontSize="0.78rem" mt={0.5}>
            <Icon as={LuMapPin} boxSize="11px" />
            <Text noOfLines={1}>
              {[titleCase(facility.city), titleCase(facility.state)].filter(Boolean).join(', ') ||
                '—'}
            </Text>
          </HStack>
        </Box>
      </HStack>

      <Box flex={1}>
        {facility.specialties?.length > 0 ? (
          <Wrap spacing={1.5}>
            {facility.specialties.slice(0, 3).map((s) => (
              <WrapItem key={s}>
                <Tag
                  size="sm"
                  colorScheme="teal"
                  variant="subtle"
                  borderRadius="pill"
                  fontSize="0.7rem"
                  textTransform="capitalize"
                >
                  {humanize(s)}
                </Tag>
              </WrapItem>
            ))}
            {facility.specialties.length > 3 && (
              <WrapItem>
                <Tag
                  size="sm"
                  colorScheme="gray"
                  variant="subtle"
                  borderRadius="pill"
                  fontSize="0.7rem"
                >
                  +{facility.specialties.length - 3}
                </Tag>
              </WrapItem>
            )}
          </Wrap>
        ) : (
          <Text fontSize="0.78rem" color="ink.400">
            Specialty info pending
          </Text>
        )}
      </Box>

      <Flex
        mt={4}
        pt={3}
        borderTop="1px solid"
        borderColor="ink.100"
        justify="space-between"
        align="center"
        gap={2}
      >
        <HStack spacing={1.5}>
          <ActionIcon icon={LuPhone} label="Call" href={phoneUrl} accent="brand" />
          <ActionIcon
            icon={LuGlobe}
            label="Visit website"
            href={websiteUrl}
            accent="sky"
            external
          />
          <ActionIcon
            icon={LuNavigation}
            label={userLocation ? 'Route from my location' : 'Open route'}
            href={directionsUrl}
            accent="brand"
            external
          />
        </HStack>
        <HStack
          spacing={1}
          color="brand.700"
          fontSize="0.78rem"
          fontWeight={600}
          opacity={0.7}
          _groupHover={{ opacity: 1 }}
        >
          <Text>Details</Text>
          <Icon as={LuArrowRight} boxSize="12px" />
        </HStack>
      </Flex>
    </Box>
  );
}

export default function FacilityGrid({ items, loading, userLocation, onOpenDetails }) {
  if (loading && items.length === 0) {
    return (
      <Flex justify="center" py={12}>
        <Spinner color="brand.500" size="lg" thickness="3px" />
      </Flex>
    );
  }

  if (items.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={LuHospital} boxSize="32px" color="ink.300" mb={2} />
        <Text color="ink.500" fontSize="0.95rem">
          No facilities match your search.
        </Text>
        <Text color="ink.400" fontSize="0.8rem" mt={1}>
          Try a different city or condition.
        </Text>
      </Box>
    );
  }

  return (
    <Grid
      templateColumns={{
        base: '1fr',
        sm: 'repeat(2, 1fr)',
        lg: 'repeat(3, 1fr)',
      }}
      gap={3}
    >
      {items.map((h) => (
        <GridItem key={h.id}>
          <FacilityCard facility={h} userLocation={userLocation} onOpenDetails={onOpenDetails} />
        </GridItem>
      ))}
    </Grid>
  );
}
