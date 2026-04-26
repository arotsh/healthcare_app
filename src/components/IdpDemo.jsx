import { useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Icon,
  Flex,
  Button,
  Spinner,
  SimpleGrid,
  Heading,
  Tag,
  Wrap,
  WrapItem,
  Badge,
  Tooltip,
  Code,
} from '@chakra-ui/react';
import {
  LuFileScan,
  LuPlay,
  LuMapPin,
  LuTriangleAlert,
  LuCircleCheck,
  LuShieldCheck,
  LuShieldX,
  LuSparkles,
  LuCircleDot,
  LuExternalLink,
} from 'react-icons/lu';
import { runIdpExtraction } from '../api/idp.js';

const LEVEL_COLOR = {
  strong: { bg: 'success.50', fg: 'success.700', border: 'success.200', dot: 'success.500' },
  medium: { bg: 'sky.50', fg: 'sky.700', border: 'sky.200', dot: 'sky.500' },
  weak: { bg: 'warning.50', fg: 'warning.700', border: 'warning.200', dot: 'warning.500' },
  none: { bg: 'ink.50', fg: 'ink.500', border: 'ink.100', dot: 'ink.300' },
};

const CAPABILITY_LABELS = {
  emergency: 'Emergency',
  surgery: 'Surgery',
  critical_care: 'ICU / Critical care',
  diagnostic: 'Diagnostic',
  maternal_neonatal: 'Maternal & Neonatal',
  specialty: 'Specialty',
};

function highlightQuote(source, quote) {
  if (!source || !quote) return null;
  const lowerSrc = source.toLowerCase();
  const lowerQ = quote.toLowerCase();
  const idx = lowerSrc.indexOf(lowerQ);
  if (idx === -1) return null;
  return {
    before: source.slice(Math.max(0, idx - 80), idx),
    match: source.slice(idx, idx + quote.length),
    after: source.slice(idx + quote.length, idx + quote.length + 80),
  };
}

function CapabilityChip({ name, field, source }) {
  const c = LEVEL_COLOR[field?.level] ?? LEVEL_COLOR.none;
  const conf = Math.round((field?.confidence ?? 0) * 100);
  const isReal = field?.level && field.level !== 'none';
  const highlight = highlightQuote(source, field?.quote);

  return (
    <Tooltip
      label={
        field?.quote
          ? `"${field.quote}" — ${conf}% confidence`
          : `${CAPABILITY_LABELS[name] ?? name}: not mentioned in source`
      }
      placement="top"
      hasArrow
    >
      <Box
        px={2.5}
        py={1.5}
        borderRadius="10px"
        bg={c.bg}
        border="1px solid"
        borderColor={c.border}
        opacity={isReal ? 1 : 0.55}
      >
        <HStack spacing={1.5} mb={field?.quote ? 0.5 : 0}>
          <Box w="6px" h="6px" borderRadius="full" bg={c.dot} flexShrink={0} />
          <Text fontSize="0.7rem" fontWeight={700} color={c.fg} letterSpacing="0.02em">
            {CAPABILITY_LABELS[name] ?? name}
          </Text>
          <Badge
            ml="auto"
            fontSize="0.58rem"
            colorScheme={field?.level === 'strong' ? 'green' : field?.level === 'medium' ? 'blue' : field?.level === 'weak' ? 'orange' : 'gray'}
            variant="subtle"
            borderRadius="pill"
            px={1.5}
          >
            {field?.level ?? 'none'}
          </Badge>
        </HStack>
        {field?.quote && (
          <Text fontSize="0.7rem" color={c.fg} fontStyle="italic" lineHeight={1.4} noOfLines={2} mt={1}>
            "{field.quote}"
          </Text>
        )}
      </Box>
    </Tooltip>
  );
}

function ScalarRow({ label, value, kind = 'string' }) {
  const isNull = value == null || value === '';
  return (
    <HStack
      justify="space-between"
      py={1}
      borderBottom="1px dashed"
      borderColor="ink.100"
      _last={{ borderBottom: 'none' }}
    >
      <Text fontSize="0.74rem" color="ink.500">
        {label}
      </Text>
      <Text fontSize="0.78rem" fontWeight={isNull ? 400 : 700} color={isNull ? 'ink.400' : 'ink.800'}>
        {isNull ? '—' : kind === 'bool' ? (value ? 'Yes' : 'No') : value.toLocaleString?.() ?? String(value)}
      </Text>
    </HStack>
  );
}

function ResultCard({ result }) {
  const ext = result.extraction;
  const valid = result.validated;
  const levelColor = ext?.overall_evidence_strength
    ? LEVEL_COLOR[ext.overall_evidence_strength]
    : LEVEL_COLOR.none;

  return (
    <Box
      p={4}
      bg="white"
      border="1px solid"
      borderColor="ink.100"
      borderRadius="card"
      boxShadow="soft"
      h="100%"
    >
      {/* Header */}
      <Flex justify="space-between" align="flex-start" mb={3} gap={2}>
        <Box flex={1} minW={0}>
          <Heading fontSize="0.95rem" color="ink.900" noOfLines={1}>
            {result.name || 'Unnamed facility'}
          </Heading>
          <HStack spacing={1} color="ink.500" fontSize="0.74rem" mt={0.5}>
            <Icon as={LuMapPin} boxSize="11px" />
            <Text noOfLines={1}>
              {[result.city, result.state].filter(Boolean).join(', ') || '—'}
            </Text>
          </HStack>
        </Box>
        <Tooltip
          label={
            valid
              ? 'Pydantic-shape validation passed: every field has the right type, every evidence_field has a level + quote.'
              : `Validation failed: ${result.validation_errors.join('; ')}`
          }
          placement="top"
          hasArrow
        >
          <HStack
            px={2}
            py={1}
            borderRadius="pill"
            bg={valid ? 'success.50' : 'danger.50'}
            color={valid ? 'success.700' : 'danger.700'}
            border="1px solid"
            borderColor={valid ? 'success.200' : 'danger.200'}
            spacing={1}
            flexShrink={0}
          >
            <Icon as={valid ? LuShieldCheck : LuShieldX} boxSize="11px" />
            <Text fontSize="0.65rem" fontWeight={700} letterSpacing="0.04em">
              {valid ? 'VALIDATED' : 'INVALID'}
            </Text>
          </HStack>
        </Tooltip>
      </Flex>

      {/* Source text */}
      <Box
        bg="ink.50"
        border="1px solid"
        borderColor="ink.100"
        borderRadius="10px"
        p={2.5}
        mb={3}
        maxH="120px"
        overflowY="auto"
      >
        <Text fontSize="0.62rem" fontWeight={700} color="ink.500" letterSpacing="0.05em" textTransform="uppercase" mb={1}>
          Raw source text
        </Text>
        <Text fontSize="0.74rem" color="ink.700" lineHeight={1.5} fontFamily="mono">
          {(result.source_text || '').slice(0, 600)}
          {result.source_text?.length > 600 ? '…' : ''}
        </Text>
      </Box>

      {!ext && (
        <Box p={3} bg="danger.50" border="1px solid" borderColor="danger.100" borderRadius="10px">
          <HStack spacing={2}>
            <Icon as={LuTriangleAlert} color="danger.600" boxSize="13px" />
            <Text fontSize="0.78rem" color="danger.700">
              {result.parse_error || 'Extraction failed'}
            </Text>
          </HStack>
        </Box>
      )}

      {ext && (
        <>
          <Text fontSize="0.62rem" fontWeight={700} color="ink.500" letterSpacing="0.05em" textTransform="uppercase" mb={2}>
            Extracted capabilities
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={1.5} mb={3}>
            {Object.keys(CAPABILITY_LABELS).map((k) => (
              <CapabilityChip
                key={k}
                name={k}
                field={ext.capabilities?.[k]}
                source={result.source_text}
              />
            ))}
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3} mb={3}>
            <Box>
              <Text fontSize="0.62rem" fontWeight={700} color="ink.500" letterSpacing="0.05em" textTransform="uppercase" mb={1.5}>
                Infrastructure
              </Text>
              <Box>
                <ScalarRow label="Power backup" value={ext.infrastructure?.has_power_backup} kind="bool" />
                <ScalarRow label="Ambulance" value={ext.infrastructure?.has_ambulance} kind="bool" />
                <ScalarRow label="Beds" value={ext.infrastructure?.bed_count} />
                <ScalarRow label="ICU beds" value={ext.infrastructure?.icu_bed_count} />
                <ScalarRow label="Operating theatres" value={ext.infrastructure?.operating_theatre_count} />
              </Box>
            </Box>
            <Box>
              <Text fontSize="0.62rem" fontWeight={700} color="ink.500" letterSpacing="0.05em" textTransform="uppercase" mb={1.5}>
                Staffing
              </Text>
              <Box>
                <ScalarRow label="Doctors" value={ext.staffing?.doctor_count} />
                <ScalarRow label="Nurses" value={ext.staffing?.nurse_count} />
                <ScalarRow label="Specialists?" value={ext.staffing?.has_specialists} kind="bool" />
              </Box>
              {ext.staffing?.specialist_types?.length > 0 && (
                <Wrap spacing={1} mt={1.5}>
                  {ext.staffing.specialist_types.slice(0, 6).map((s) => (
                    <WrapItem key={s}>
                      <Tag size="sm" colorScheme="purple" variant="subtle" borderRadius="pill" fontSize="0.66rem">
                        {s}
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
            </Box>
          </SimpleGrid>

          {ext.risk_flags?.length > 0 && (
            <Box mb={2}>
              <Text fontSize="0.62rem" fontWeight={700} color="warning.700" letterSpacing="0.05em" textTransform="uppercase" mb={1}>
                Risk flags
              </Text>
              <Wrap spacing={1}>
                {ext.risk_flags.map((f, i) => (
                  <WrapItem key={i}>
                    <Tag size="sm" colorScheme="orange" variant="subtle" borderRadius="pill" fontSize="0.66rem">
                      ⚠ {f}
                    </Tag>
                  </WrapItem>
                ))}
              </Wrap>
            </Box>
          )}

          <HStack mt={3} pt={2} borderTop="1px solid" borderColor="ink.100" spacing={3} flexWrap="wrap">
            <HStack spacing={1} fontSize="0.66rem" color="ink.500">
              <Icon as={LuCircleDot} color={levelColor.dot} boxSize="9px" />
              <Text>
                Overall: <b style={{ color: 'inherit' }}>{ext.overall_evidence_strength}</b>
              </Text>
            </HStack>
            <Text fontSize="0.66rem" color="ink.500">
              · {result.latency_ms}ms · {result.tokens.prompt + result.tokens.completion} tokens
            </Text>
          </HStack>
        </>
      )}
    </Box>
  );
}

export default function IdpDemo() {
  const [state, setState] = useState({ idle: true });

  const run = async () => {
    setState({ loading: true });
    try {
      const data = await runIdpExtraction({ count: 3 });
      setState({ data });
    } catch (err) {
      setState({ error: err.message });
    }
  };

  return (
    <Box>
      <Box
        p={{ base: 4, md: 5 }}
        borderRadius="card"
        bgGradient="linear(135deg, brand.500, brand.700)"
        color="white"
        mb={4}
      >
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3}>
          <Box>
            <HStack spacing={2} mb={1}>
              <Icon as={LuFileScan} boxSize="16px" />
              <Badge bg="whiteAlpha.300" color="white" borderRadius="pill" px={2.5} fontSize="0.66rem">
                Live IDP demo
              </Badge>
            </HStack>
            <Heading fontSize={{ base: '1.1rem', md: '1.3rem' }}>
              Watch messy text become structured signals — live
            </Heading>
            <Text fontSize="0.85rem" opacity={0.9} mt={1} lineHeight={1.5}>
              Pulls 3 random Indian facilities, sends each profile through Llama 3.3 70B with the
              Virtue Foundation pydantic schema, validates the output, and shows the source text
              next to the extracted structure — every field anchored to a verbatim quote.
            </Text>
          </Box>
          <Button
            onClick={run}
            isDisabled={state.loading}
            leftIcon={<Icon as={state.loading ? LuSparkles : LuPlay} boxSize="14px" />}
            bg="white"
            color="brand.700"
            fontWeight={700}
            _hover={{ opacity: 0.92, transform: 'translateY(-1px)' }}
            transition="all 0.15s"
            flexShrink={0}
            size="md"
            borderRadius="10px"
          >
            {state.loading ? 'Extracting…' : state.data ? 'Run again' : 'Run extraction'}
          </Button>
        </Flex>
      </Box>

      {state.loading && (
        <Box p={5} bg="white" borderRadius="card" border="1px solid" borderColor="ink.100" boxShadow="soft">
          <HStack spacing={3}>
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="0.85rem" color="ink.600">
              Llama 3.3 70B is extracting structured signals from 3 facility profiles in parallel…
            </Text>
          </HStack>
        </Box>
      )}

      {state.error && (
        <Box p={4} bg="danger.50" border="1px solid" borderColor="danger.100" borderRadius="10px">
          <HStack>
            <Icon as={LuTriangleAlert} color="danger.600" />
            <Text fontSize="0.85rem" color="danger.700">
              {state.error}
            </Text>
          </HStack>
        </Box>
      )}

      {state.data && (
        <>
          <HStack
            mb={3}
            px={3}
            py={2}
            bg="white"
            border="1px solid"
            borderColor="ink.100"
            borderRadius="10px"
            spacing={4}
            flexWrap="wrap"
          >
            <HStack spacing={1.5}>
              <Icon as={LuCircleCheck} color="success.600" boxSize="13px" />
              <Text fontSize="0.78rem" color="ink.700">
                <b>{state.data.summary.validated}</b> / {state.data.summary.total} extractions passed schema validation
              </Text>
            </HStack>
            <Text fontSize="0.78rem" color="ink.500">
              · {state.data.summary.total_prompt_tokens.toLocaleString()} prompt + {state.data.summary.total_completion_tokens.toLocaleString()} completion tokens
            </Text>
            <Text fontSize="0.78rem" color="ink.500">
              · ${state.data.summary.total_cost_usd.toFixed(4)} total
            </Text>
            {state.data.trace_url && (
              <HStack spacing={1} ml="auto" fontSize="0.74rem" color="brand.700">
                <Icon as={LuExternalLink} boxSize="11px" />
                <Text
                  as="a"
                  href={state.data.trace_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  _hover={{ textDecoration: 'underline' }}
                >
                  MLflow trace
                </Text>
              </HStack>
            )}
          </HStack>

          <SimpleGrid columns={{ base: 1, lg: state.data.results.length >= 3 ? 3 : state.data.results.length }} spacing={3}>
            {state.data.results.map((r) => (
              <ResultCard key={r.facility_id} result={r} />
            ))}
          </SimpleGrid>
        </>
      )}

      {state.idle && !state.loading && !state.data && !state.error && (
        <Box
          p={6}
          textAlign="center"
          bg="white"
          border="1px dashed"
          borderColor="ink.200"
          borderRadius="card"
        >
          <Icon as={LuFileScan} boxSize="28px" color="ink.300" mb={2} />
          <Text fontSize="0.85rem" color="ink.500">
            Click <b>Run extraction</b> above to pull 3 random facilities and watch the IDP pipeline
            transform their unstructured profile text into validated structured signals.
          </Text>
        </Box>
      )}
    </Box>
  );
}
