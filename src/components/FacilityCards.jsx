import {
  Box,
  Stack,
  HStack,
  Text,
  Button,
  Flex,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import {
  LuMapPin,
  LuArrowRight,
  LuNavigation,
  LuSparkles,
} from 'react-icons/lu';
import { buildDirectionsUrl } from '../utils/maps.js';

const titleCase = (s) =>
  typeof s === 'string'
    ? s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    : s;

function FacilityCard({ facility, rank, onOpenDetails, userLocation }) {
  const { name, location, scores, evidence_snippet } = facility;
  const directionsUrl = buildDirectionsUrl({
    origin: userLocation ?? null,
    destination:
      location?.latitude != null && location?.longitude != null
        ? { lat: location.latitude, lng: location.longitude }
        : null,
  });
  const finalScore = scores?.final_score;
  const scorePct = finalScore != null ? Math.round(finalScore * 100) : null;
  const fitReason =
    facility.verification?.verdict ||
    facility.semantic?.excerpt ||
    evidence_snippet ||
    '';

  return (
    <Box
      p={{ base: 3, md: 4 }}
      borderRadius="16px"
      bg="white"
      border="1px solid"
      borderColor="ink.100"
      position="relative"
      overflow="hidden"
      transition="all 0.15s"
      _hover={{ borderColor: 'brand.300', boxShadow: 'soft', transform: 'translateY(-1px)' }}
    >
      <Flex justify="space-between" align="flex-start" gap={3} mb={2}>
        <Box minW={0} flex={1}>
          <HStack spacing={2} mb={0.5}>
            <Flex
              w="22px"
              h="22px"
              borderRadius="6px"
              bg="brand.50"
              color="brand.700"
              align="center"
              justify="center"
              fontSize="0.72rem"
              fontWeight={700}
              flexShrink={0}
            >
              {rank}
            </Flex>
            <Text fontWeight={700} fontSize="0.95rem" noOfLines={1} color="ink.900">
              {titleCase(name) || 'Unnamed facility'}
            </Text>
          </HStack>
          <HStack spacing={1} color="ink.500" fontSize="0.78rem" pl="30px">
            <Icon as={LuMapPin} boxSize="11px" />
            <Text noOfLines={1}>
              {[titleCase(location?.city), titleCase(location?.state)].filter(Boolean).join(', ') ||
                '—'}
            </Text>
          </HStack>
        </Box>
        {scorePct != null && (
          <Tooltip label="Final ranking score" placement="left" hasArrow>
            <Flex
              direction="column"
              align="center"
              minW="56px"
              borderRadius="10px"
              bgGradient="linear(135deg, brand.500, brand.700)"
              color="white"
              px={2}
              py={1.5}
              flexShrink={0}
            >
              <Text fontSize="1rem" fontWeight={800} lineHeight={1}>
                {scorePct}
              </Text>
              <Text fontSize="0.6rem" opacity={0.85} mt={0.5} letterSpacing="0.04em">
                SCORE
              </Text>
            </Flex>
          </Tooltip>
        )}
      </Flex>

      {fitReason && (
        <Box
          mt={2.5}
          px={2.5}
          py={1.5}
          bg="brand.50"
          border="1px solid"
          borderColor="brand.100"
          borderRadius="8px"
        >
          <HStack spacing={1.5} mb={1}>
            <Icon as={LuSparkles} color="brand.700" boxSize="11px" />
            <Text
              fontSize="0.66rem"
              fontWeight={700}
              color="brand.700"
              letterSpacing="0.04em"
              textTransform="uppercase"
            >
              Why it's a good fit
            </Text>
          </HStack>
          <Text fontSize="0.78rem" color="ink.700" lineHeight={1.5} noOfLines={3}>
            {fitReason}
          </Text>
        </Box>
      )}

      <HStack mt={3} spacing={2}>
        <Button
          size="sm"
          onClick={() => onOpenDetails(facility.facility_id)}
          rightIcon={<Icon as={LuArrowRight} boxSize="14px" />}
          variant="ghost"
          color="brand.700"
          fontWeight={600}
          fontSize="0.82rem"
          px={2}
          h="32px"
          _hover={{ bg: 'brand.50', color: 'brand.800' }}
        >
          Details
        </Button>
        {directionsUrl && (
          <Button
            as="a"
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            leftIcon={<Icon as={LuNavigation} boxSize="13px" />}
            bgGradient="linear(135deg, brand.500, brand.700)"
            color="white"
            fontWeight={600}
            fontSize="0.82rem"
            px={3}
            h="32px"
            borderRadius="8px"
            _hover={{ opacity: 0.9, transform: 'translateY(-1px)' }}
            transition="all 0.15s"
          >
            View location
          </Button>
        )}
      </HStack>
    </Box>
  );
}

export default function FacilityCards({ facilities, onOpenDetails, userLocation }) {
  if (!facilities || facilities.length === 0) return null;
  return (
    <Stack spacing={2} w="100%">
      {facilities.map((f, i) => (
        <FacilityCard
          key={f.facility_id}
          facility={f}
          rank={i + 1}
          onOpenDetails={onOpenDetails}
          userLocation={userLocation}
        />
      ))}
    </Stack>
  );
}
