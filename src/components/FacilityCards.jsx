import {
  Box,
  Stack,
  HStack,
  Text,
  Badge,
  Button,
  Flex,
  Tag,
  Wrap,
  WrapItem,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import {
  LuMapPin,
  LuTriangleAlert,
  LuArrowRight,
  LuActivity,
  LuStethoscope,
  LuShieldCheck,
  LuShieldX,
  LuNavigation,
  LuSparkles,
  LuCircleCheck,
} from 'react-icons/lu';
import { buildDirectionsUrl } from '../utils/maps.js';

const titleCase = (s) =>
  typeof s === 'string'
    ? s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    : s;

const SIGNAL_COLOR = {
  strong: 'green',
  medium: 'yellow',
  weak: 'orange',
  none: 'gray',
};
const SIGNAL_LABEL = {
  emergency: 'Emergency',
  surgery: 'Surgery',
  critical_care: 'ICU',
  diagnostic: 'Diagnostic',
  maternal_neonatal: 'Maternal',
  specialty: 'Specialty',
};

function SignalChip({ kind, level }) {
  if (!level || level === 'none') return null;
  return (
    <Tag
      size="sm"
      colorScheme={SIGNAL_COLOR[level] ?? 'gray'}
      variant="subtle"
      borderRadius="pill"
      fontSize="0.7rem"
      fontWeight={600}
    >
      {SIGNAL_LABEL[kind] ?? kind} · {level}
    </Tag>
  );
}

function ScorePill({ icon, label, value, color = 'ink' }) {
  if (value == null) return null;
  return (
    <Tooltip label={`${label}: ${value}`} placement="top" hasArrow>
      <Flex
        align="center"
        gap={1}
        px={2}
        py={1}
        borderRadius="pill"
        bg={`${color}.50`}
        border="1px solid"
        borderColor={`${color}.100`}
        fontSize="0.7rem"
        fontWeight={600}
        color={`${color}.700`}
      >
        {icon && <Icon as={icon} boxSize="11px" />}
        <Text>{value}</Text>
      </Flex>
    </Tooltip>
  );
}

function FacilityCard({ facility, rank, onOpenDetails, userLocation }) {
  const { name, location, scores, signals, risk_flags, evidence_snippet } = facility;
  const directionsUrl = buildDirectionsUrl({
    origin: userLocation ?? null,
    destination:
      location?.latitude != null && location?.longitude != null
        ? { lat: location.latitude, lng: location.longitude }
        : null,
  });
  const finalScore = scores?.final_score;
  const scorePct = finalScore != null ? Math.round(finalScore * 100) : null;

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

      <Wrap spacing={1.5} mt={2}>
        {Object.entries(signals ?? {}).map(([kind, level]) => (
          <WrapItem key={kind}>
            <SignalChip kind={kind} level={level} />
          </WrapItem>
        ))}
      </Wrap>

      <HStack spacing={1.5} mt={2.5} flexWrap="wrap">
        <ScorePill icon={LuShieldCheck} label="Trust" value={scores?.trust_score} color="brand" />
        <ScorePill icon={LuStethoscope} label="Capability" value={scores?.capability_score} color="sky" />
        <ScorePill icon={LuActivity} label="Match" value={scores?.query_match_score} color="brand" />
        {scores?.distance_km != null && (
          <ScorePill icon={LuMapPin} label="km away" value={`${scores.distance_km} km`} color="ink" />
        )}
      </HStack>

      {risk_flags?.length > 0 && (
        <HStack spacing={1.5} mt={2} color="warning.600" fontSize="0.74rem" align="flex-start">
          <Icon as={LuTriangleAlert} boxSize="13px" mt={0.5} flexShrink={0} />
          <Text noOfLines={2}>{risk_flags.join('; ')}</Text>
        </HStack>
      )}

      {facility.semantic?.matched && (
        <Box
          mt={2.5}
          px={2.5}
          py={1.5}
          bg="brand.50"
          border="1px solid"
          borderColor="brand.100"
          borderRadius="8px"
        >
          <HStack spacing={1.5} mb={0.5}>
            <Icon as={LuSparkles} color="brand.700" boxSize="11px" />
            <Text fontSize="0.66rem" fontWeight={700} color="brand.700" letterSpacing="0.04em" textTransform="uppercase">
              Semantic match
            </Text>
          </HStack>
          <Text fontSize="0.74rem" color="ink.700" noOfLines={2} lineHeight={1.45} fontStyle="italic">
            {facility.semantic.excerpt || evidence_snippet}
          </Text>
        </Box>
      )}

      {facility.verification && (
        <Box
          mt={2}
          px={2.5}
          py={1.5}
          bg={facility.verification.verified === true ? 'success.50' : facility.verification.verified === false ? 'warning.50' : 'ink.50'}
          border="1px solid"
          borderColor={facility.verification.verified === true ? 'success.100' : facility.verification.verified === false ? 'warning.100' : 'ink.100'}
          borderRadius="8px"
        >
          <HStack spacing={1.5} mb={0.5}>
            <Icon
              as={facility.verification.verified === true ? LuCircleCheck : facility.verification.verified === false ? LuShieldX : LuShieldCheck}
              color={facility.verification.verified === true ? 'success.600' : facility.verification.verified === false ? 'warning.600' : 'ink.500'}
              boxSize="12px"
            />
            <Text fontSize="0.66rem" fontWeight={700} letterSpacing="0.04em" textTransform="uppercase"
              color={facility.verification.verified === true ? 'success.700' : facility.verification.verified === false ? 'warning.700' : 'ink.600'}>
              Self-verified · confidence {Math.round((facility.verification.confidence ?? 0) * 100)}%
            </Text>
          </HStack>
          {facility.verification.verdict && (
            <Text fontSize="0.74rem" color="ink.700" lineHeight={1.45} mt={0.5}>
              {facility.verification.verdict}
            </Text>
          )}
          {facility.verification.supporting_quote && (
            <Text fontSize="0.72rem" color="ink.600" mt={1} fontStyle="italic" borderLeft="2px solid" borderColor="ink.200" pl={2} noOfLines={2}>
              "{facility.verification.supporting_quote}"
            </Text>
          )}
          {facility.verification.concerns?.length > 0 && (
            <Wrap spacing={1} mt={1.5}>
              {facility.verification.concerns.map((c, i) => (
                <WrapItem key={i}>
                  <Tag size="sm" colorScheme="orange" variant="subtle" borderRadius="pill" fontSize="0.66rem">
                    ⚠ {c}
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          )}
        </Box>
      )}

      {!facility.semantic?.matched && evidence_snippet && (
        <Text fontSize="0.78rem" color="ink.500" mt={2.5} noOfLines={2} lineHeight={1.5}>
          {evidence_snippet}
        </Text>
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
          View details
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
            {userLocation ? 'Route from me' : 'Open route'}
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
