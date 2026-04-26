import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Stack,
  HStack,
  VStack,
  Icon,
  Spinner,
  Wrap,
  WrapItem,
  Tag,
  Code,
  Button,
  Collapse,
  Flex,
  SimpleGrid,
  Badge,
  Progress,
} from '@chakra-ui/react';
import {
  LuChartArea,
  LuMapPinOff,
  LuTriangleAlert,
  LuTrendingDown,
  LuRefreshCw,
  LuChartBar,
  LuChevronDown,
  LuChevronUp,
} from 'react-icons/lu';
import { askGenie } from '../api/genie.js';
import DesertHeatmap from '../components/DesertHeatmap.jsx';
import IdpDemo from '../components/IdpDemo.jsx';

// NGO planner / Medical Desert dashboard.
// Each panel below sends a Genie analytical query and renders the result.
// Backed by the same DECISION_SYSTEM ANALYTICS branch, so Genie writes the SQL.

const PANELS = [
  {
    id: 'desert-states',
    title: 'States with the fewest hospitals',
    subtitle: 'Highest-need regions for new facility investment',
    icon: LuMapPinOff,
    accent: 'warning',
    query:
      'How many hospitals are in each Indian state? Show the state name and the count, ordered fewest first. Limit 10.',
  },
  {
    id: 'top-states',
    title: 'States with the most hospitals',
    subtitle: 'Saturated regions — useful baseline for comparison',
    icon: LuChartBar,
    accent: 'brand',
    query:
      'How many hospitals are in each Indian state? Show the state name and the count, ordered most first. Limit 10.',
  },
  {
    id: 'top-cities',
    title: 'Cities with the most healthcare facilities',
    subtitle: 'Urban concentration map',
    icon: LuChartBar,
    accent: 'brand',
    query:
      'Which cities in India have the most hospitals? Show the city name and the count, ordered most first. Limit 10.',
  },
  {
    id: 'facility-types',
    title: 'Breakdown by facility type',
    subtitle: 'What kind of care exists in the dataset',
    icon: LuChartBar,
    accent: 'brand',
    query:
      'How many facilities of each type are there? Group by facility type and show counts, ordered most first.',
  },
  {
    id: 'low-trust-states',
    title: 'States with the lowest average trust score',
    subtitle: 'Where NGO oversight may be most valuable',
    icon: LuTrendingDown,
    accent: 'danger',
    query:
      'For each Indian state, what is the average trust score across hospitals? Show state name and average trust score, ordered lowest first. Limit 10.',
  },
  {
    id: 'maternal-coverage',
    title: 'States with weakest maternal & neonatal coverage',
    subtitle: 'Maternal health investment priorities',
    icon: LuTriangleAlert,
    accent: 'orange',
    query:
      'For each Indian state, how many hospitals offer maternal or neonatal care? Show state name and count, ordered fewest first. Limit 10.',
  },
];

const ACCENT = {
  warning: { bg: 'warning.50', border: 'warning.200', icon: 'warning.600', tag: 'orange' },
  danger: { bg: 'danger.50', border: 'danger.200', icon: 'danger.600', tag: 'red' },
  brand: { bg: 'brand.50', border: 'brand.200', icon: 'brand.700', tag: 'teal' },
  orange: { bg: 'orange.50', border: 'orange.200', icon: 'orange.600', tag: 'orange' },
};

function formatCell(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  return String(v);
}

function PanelCard({ panel, state, onRefresh }) {
  const [showSql, setShowSql] = useState(false);
  const accent = ACCENT[panel.accent] ?? ACCENT.brand;
  const data = state?.data;
  const columns = data?.genie?.table?.columns ?? [];
  const rows = data?.genie?.table?.rows ?? [];

  return (
    <Box
      p={4}
      borderRadius="card"
      bg="white"
      border="1px solid"
      borderColor="ink.100"
      boxShadow="soft"
      h="100%"
      display="flex"
      flexDirection="column"
    >
      <HStack spacing={3} mb={3} align="flex-start">
        <Flex
          w="36px"
          h="36px"
          borderRadius="10px"
          align="center"
          justify="center"
          bg={accent.bg}
          color={accent.icon}
          flexShrink={0}
        >
          <Icon as={panel.icon} boxSize="18px" />
        </Flex>
        <Box flex={1}>
          <Heading fontSize="0.95rem" color="ink.900" lineHeight={1.3}>
            {panel.title}
          </Heading>
          <Text fontSize="0.78rem" color="ink.500" mt={0.5}>
            {panel.subtitle}
          </Text>
        </Box>
        <Button
          size="xs"
          variant="ghost"
          leftIcon={<Icon as={LuRefreshCw} boxSize="11px" />}
          onClick={onRefresh}
          isDisabled={state?.loading}
          color="ink.500"
          _hover={{ bg: 'brand.50', color: 'brand.700' }}
          fontSize="0.7rem"
        >
          {state?.loading ? '…' : 'Refresh'}
        </Button>
      </HStack>

      {state?.loading && (
        <Stack spacing={2} mt={4}>
          <HStack>
            <Spinner size="xs" color="brand.500" />
            <Text fontSize="0.78rem" color="ink.500">
              Genie is composing SQL…
            </Text>
          </HStack>
          <Progress size="xs" isIndeterminate colorScheme="teal" borderRadius="pill" />
        </Stack>
      )}

      {state?.error && (
        <Box mt={3} p={3} bg="warning.50" border="1px solid" borderColor="warning.100" borderRadius="10px">
          <HStack spacing={2} align="flex-start">
            <Icon as={LuTriangleAlert} color="warning.600" boxSize="14px" mt={0.5} flexShrink={0} />
            <Box>
              <Text fontSize="0.78rem" color="warning.700" lineHeight={1.5}>
                {state.error}
              </Text>
              {/no column|data incomplete|not.*found|cannot.*answer/i.test(state.error) && (
                <Text fontSize="0.72rem" color="ink.600" mt={1.5} lineHeight={1.45}>
                  <b>Tip:</b> attach both <Code fontSize="0.7rem">clean_facilities</Code> and{' '}
                  <Code fontSize="0.7rem">facility_signals</Code> to your Genie space so it has
                  access to scoring columns. Open the space → Edit → Add data.
                </Text>
              )}
            </Box>
          </HStack>
        </Box>
      )}

      {data && !state?.loading && (
        <>
          {data.reply && (
            <Text fontSize="0.82rem" color="ink.700" mb={3} lineHeight={1.5}>
              {data.reply}
            </Text>
          )}

          {rows.length > 0 && (
            <Box
              border="1px solid"
              borderColor="ink.100"
              borderRadius="10px"
              overflow="hidden"
              maxH="260px"
              overflowY="auto"
              mb={3}
            >
              <Box as="table" w="100%" fontSize="0.78rem">
                <Box as="thead" bg="ink.50" position="sticky" top={0} zIndex={1}>
                  <Box as="tr">
                    {columns.map((c) => (
                      <Box
                        key={c.name}
                        as="th"
                        textAlign="left"
                        px={2.5}
                        py={2}
                        fontSize="0.66rem"
                        color="ink.600"
                        letterSpacing="0.04em"
                        textTransform="uppercase"
                        borderBottom="1px solid"
                        borderColor="ink.100"
                      >
                        {c.name}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box as="tbody">
                  {rows.map((row, idx) => (
                    <Box
                      as="tr"
                      key={idx}
                      _hover={{ bg: accent.bg }}
                      transition="background 0.1s"
                    >
                      {row.map((cell, ci) => (
                        <Box
                          as="td"
                          key={ci}
                          px={2.5}
                          py={1.5}
                          color="ink.800"
                          borderBottom="1px solid"
                          borderColor="ink.100"
                        >
                          {formatCell(cell)}
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {data.genie?.sql && (
            <Box mt="auto">
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<Icon as={LuChartBar} boxSize="11px" />}
                rightIcon={<Icon as={showSql ? LuChevronUp : LuChevronDown} boxSize="11px" />}
                onClick={() => setShowSql((v) => !v)}
                fontSize="0.7rem"
                color="ink.500"
                _hover={{ bg: 'brand.50', color: 'brand.700' }}
              >
                {showSql ? 'Hide SQL' : 'View Genie-generated SQL'}
              </Button>
              <Collapse in={showSql} animateOpacity>
                <Code
                  display="block"
                  whiteSpace="pre-wrap"
                  fontSize="0.7rem"
                  p={2.5}
                  mt={1.5}
                  borderRadius="8px"
                  bg="ink.900"
                  color="ink.50"
                  fontFamily="mono"
                  lineHeight={1.5}
                >
                  {data.genie.sql}
                </Code>
              </Collapse>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default function InsightsPage() {
  const [states, setStates] = useState({});

  const runPanel = async (panel) => {
    setStates((s) => ({ ...s, [panel.id]: { loading: true } }));
    try {
      const data = await askGenie(panel.query);
      const hasSql = Boolean(data?.genie?.sql);
      const hasRows = (data?.genie?.table?.rows?.length ?? 0) > 0;
      // Genie returns an explanation in `reply` when it can't write SQL.
      // Treat that as an error rather than rendering it as a successful result.
      if (!hasSql && !hasRows) {
        throw new Error(
          data?.reply ||
            'Genie could not answer this question with the tables attached to the space.'
        );
      }
      setStates((s) => ({ ...s, [panel.id]: { loading: false, data } }));
    } catch (err) {
      setStates((s) => ({ ...s, [panel.id]: { loading: false, error: err.message } }));
    }
  };

  useEffect(() => {
    PANELS.forEach((p, i) => {
      // stagger so we don't fire 4 Genie calls simultaneously
      setTimeout(() => runPanel(p), i * 1200);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box bg="ink.50" minH="calc(100vh - 65px)" pb={10}>
      <Container maxW="1200px" pt={{ base: 4, md: 8 }} px={{ base: 3, md: 5 }}>
        <Box
          p={{ base: 4, md: 6 }}
          borderRadius="card"
          bgGradient="linear(135deg, brand.500, brand.700)"
          color="white"
          mb={6}
        >
          <HStack spacing={3} mb={2}>
            <Flex
              w="36px"
              h="36px"
              borderRadius="10px"
              bg="whiteAlpha.300"
              align="center"
              justify="center"
            >
              <Icon as={LuChartArea} boxSize="18px" />
            </Flex>
            <Badge bg="whiteAlpha.300" color="white" borderRadius="pill" px={2.5}>
              For NGO planners
            </Badge>
          </HStack>
          <Heading fontSize={{ base: '1.4rem', md: '1.8rem' }} mb={1}>
            Medical Desert Insights
          </Heading>
          <Text fontSize={{ base: '0.85rem', md: '0.95rem' }} opacity={0.9} lineHeight={1.5}>
            Live analytics across the 10K-facility India dataset. Each panel is a Genie-generated
            SQL query — click "View Genie-generated SQL" to audit the query, or "Refresh" to re-run.
          </Text>
        </Box>

        <Box mb={6}>
          <IdpDemo />
        </Box>

        <Box mb={6}>
          <DesertHeatmap />
        </Box>

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 3, md: 4 }}>
          {PANELS.map((p) => (
            <PanelCard
              key={p.id}
              panel={p}
              state={states[p.id]}
              onRefresh={() => runPanel(p)}
            />
          ))}
        </SimpleGrid>

        <Box
          mt={6}
          p={4}
          borderRadius="card"
          bg="white"
          border="1px solid"
          borderColor="ink.100"
        >
          <Heading fontSize="0.95rem" color="ink.900" mb={1}>
            How this works
          </Heading>
          <Text fontSize="0.82rem" color="ink.600" lineHeight={1.55}>
            Each panel question is forwarded directly to a <b>Databricks Genie</b> space. Genie
            autonomously decomposes the question, generates SQL against your warehouse, runs it,
            and returns both the natural-language answer and the underlying SQL — fully auditable.
          </Text>
          <Text fontSize="0.78rem" color="ink.500" mt={2} lineHeight={1.5}>
            <b>Setup:</b> attach <Code fontSize="0.74rem">workspace.default.clean_facilities</Code> and{' '}
            <Code fontSize="0.74rem">workspace.default.facility_signals</Code> to the Genie space and
            publish it. The first table powers location-based panels; the second powers score-based
            panels (trust, capability, maternal coverage).
          </Text>
        </Box>
      </Container>
    </Box>
  );
}
