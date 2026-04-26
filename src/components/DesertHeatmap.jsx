import { useEffect, useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Icon,
  Flex,
  Spinner,
  Tooltip,
  SimpleGrid,
  Progress,
  Heading,
} from '@chakra-ui/react';
import {
  LuMapPinOff,
  LuTrendingDown,
  LuTrendingUp,
  LuTriangleAlert,
} from 'react-icons/lu';
import { askGenie } from '../api/genie.js';

// Picks the state-name + count columns out of Genie's response no matter what
// they're called (Genie sometimes returns `address_stateOrRegion`,
// sometimes `state`, count column varies too).
function extractStateCounts(genie) {
  const cols = genie?.table?.columns ?? [];
  const rows = genie?.table?.rows ?? [];
  if (!cols.length || !rows.length) return null;
  const stateIdx = cols.findIndex((c) => /state|region/i.test(c.name));
  const countIdx = cols.findIndex((c) => /count|num|total|hospitals/i.test(c.name));
  if (stateIdx === -1 || countIdx === -1) {
    // Fallback: assume first column is label, second is value
    if (cols.length >= 2) return rows.map((r) => ({ state: r[0], count: Number(r[1]) || 0 }));
    return null;
  }
  return rows.map((r) => ({ state: r[stateIdx], count: Number(r[countIdx]) || 0 }));
}

function colorForRank(rank, total) {
  // 0 = worst desert (deepest red), total-1 = most served (green)
  const t = total <= 1 ? 0 : rank / (total - 1);
  if (t < 0.15) return { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5' }; // critical
  if (t < 0.35) return { bg: '#ffedd5', fg: '#9a3412', border: '#fdba74' }; // severe
  if (t < 0.6) return { bg: '#fef3c7', fg: '#854d0e', border: '#fcd34d' };  // moderate
  if (t < 0.85) return { bg: '#ecfccb', fg: '#3f6212', border: '#bef264' }; // covered
  return { bg: '#d1fae5', fg: '#065f46', border: '#6ee7b7' };               // well-served
}

function StatTile({ rank, total, state, count, max }) {
  const c = colorForRank(rank, total);
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <Tooltip
      label={`Rank #${rank + 1} of ${total} · ${count.toLocaleString()} facilities`}
      placement="top"
      hasArrow
    >
      <Box
        bg={c.bg}
        border="1px solid"
        borderColor={c.border}
        borderRadius="10px"
        p={2.5}
        cursor="default"
        transition="all 0.15s"
        _hover={{ transform: 'translateY(-2px)', boxShadow: 'soft' }}
      >
        <Text
          fontSize="0.66rem"
          fontWeight={700}
          color={c.fg}
          letterSpacing="0.04em"
          textTransform="uppercase"
          noOfLines={1}
        >
          {state || 'unknown'}
        </Text>
        <HStack justify="space-between" align="baseline" mt={1}>
          <Text fontSize="1.1rem" fontWeight={800} color={c.fg} lineHeight={1}>
            {count.toLocaleString()}
          </Text>
          <Text fontSize="0.6rem" color={c.fg} opacity={0.7}>
            #{rank + 1}
          </Text>
        </HStack>
        <Box mt={1.5} h="3px" bg="white" borderRadius="full" overflow="hidden" border="1px solid" borderColor="white">
          <Box w={`${pct}%`} h="100%" bg={c.fg} opacity={0.6} />
        </Box>
      </Box>
    </Tooltip>
  );
}

function DesertCallout({ entry, rank, total }) {
  const c = colorForRank(rank, total);
  return (
    <HStack
      p={3}
      bg={c.bg}
      border="1px solid"
      borderColor={c.border}
      borderRadius="12px"
      spacing={3}
      align="center"
    >
      <Flex
        w="34px"
        h="34px"
        borderRadius="8px"
        bg="white"
        align="center"
        justify="center"
        color={c.fg}
        flexShrink={0}
      >
        <Icon as={LuMapPinOff} boxSize="16px" />
      </Flex>
      <Box flex={1} minW={0}>
        <Text fontSize="0.66rem" fontWeight={700} color={c.fg} letterSpacing="0.05em" textTransform="uppercase">
          Desert #{rank + 1}
        </Text>
        <Text fontSize="0.92rem" fontWeight={700} color={c.fg} noOfLines={1}>
          {entry.state}
        </Text>
        <Text fontSize="0.74rem" color={c.fg} opacity={0.85}>
          only {entry.count.toLocaleString()} facilities
        </Text>
      </Box>
    </HStack>
  );
}

export default function DesertHeatmap() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await askGenie(
          'How many hospitals are in each Indian state? Use address_stateOrRegion as the state name. Return state and count, ordered fewest first. Limit 50.'
        );
        if (cancelled) return;
        const entries = extractStateCounts(data?.genie);
        if (!entries || entries.length === 0) {
          throw new Error(data?.reply || 'Genie returned no rows.');
        }
        setState({ loading: false, entries, sql: data?.genie?.sql });
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, error: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <Box
        p={5}
        borderRadius="card"
        bg="white"
        border="1px solid"
        borderColor="ink.100"
        boxShadow="soft"
      >
        <HStack spacing={3}>
          <Spinner size="sm" color="brand.500" />
          <Text fontSize="0.85rem" color="ink.500">
            Genie is computing the medical desert index across all Indian states…
          </Text>
        </HStack>
      </Box>
    );
  }

  if (state.error) {
    return (
      <Box
        p={4}
        borderRadius="card"
        bg="warning.50"
        border="1px solid"
        borderColor="warning.100"
      >
        <HStack spacing={2}>
          <Icon as={LuTriangleAlert} color="warning.600" boxSize="14px" />
          <Text fontSize="0.82rem" color="warning.700" lineHeight={1.5}>
            Couldn't load desert index: {state.error}
          </Text>
        </HStack>
      </Box>
    );
  }

  const entries = state.entries.filter((e) => e.state);
  const max = Math.max(...entries.map((e) => e.count));
  const top5Deserts = entries.slice(0, 5);
  const top3Served = [...entries].sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <Box>
      {/* Top 5 deserts callouts */}
      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={2.5} mb={4}>
        {top5Deserts.map((e, i) => (
          <DesertCallout key={e.state} entry={e} rank={i} total={entries.length} />
        ))}
      </SimpleGrid>

      {/* Heatmap grid of all states */}
      <Box
        p={4}
        bg="white"
        borderRadius="card"
        border="1px solid"
        borderColor="ink.100"
        boxShadow="soft"
      >
        <Flex justify="space-between" align="flex-start" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Heading fontSize="0.95rem" color="ink.900">
              State-by-state desert index
            </Heading>
            <Text fontSize="0.78rem" color="ink.500" mt={0.5}>
              All {entries.length} states sorted by facility count · darker = more underserved
            </Text>
          </Box>
          <HStack spacing={3} fontSize="0.7rem" color="ink.500">
            <HStack spacing={1}>
              <Box w="12px" h="12px" borderRadius="3px" bg="#fee2e2" border="1px solid" borderColor="#fca5a5" />
              <Text>Critical</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="12px" h="12px" borderRadius="3px" bg="#fef3c7" border="1px solid" borderColor="#fcd34d" />
              <Text>Moderate</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="12px" h="12px" borderRadius="3px" bg="#d1fae5" border="1px solid" borderColor="#6ee7b7" />
              <Text>Well-served</Text>
            </HStack>
          </HStack>
        </Flex>
        <SimpleGrid columns={{ base: 2, sm: 3, md: 5, lg: 7 }} spacing={2}>
          {entries.map((e, i) => (
            <StatTile
              key={e.state || `state-${i}`}
              rank={i}
              total={entries.length}
              state={e.state}
              count={e.count}
              max={max}
            />
          ))}
        </SimpleGrid>

        <HStack mt={4} pt={3} borderTop="1px solid" borderColor="ink.100" justify="space-between" flexWrap="wrap" gap={2}>
          <HStack spacing={1.5} color="ink.500" fontSize="0.74rem">
            <Icon as={LuTrendingUp} boxSize="11px" />
            <Text>
              Most served: <b>{top3Served.map((s) => s.state).join(', ')}</b>
            </Text>
          </HStack>
          <HStack spacing={1.5} color="ink.500" fontSize="0.74rem">
            <Icon as={LuTrendingDown} boxSize="11px" />
            <Text>
              {entries.length} Indian states/regions analyzed live via Databricks Genie
            </Text>
          </HStack>
        </HStack>
      </Box>
    </Box>
  );
}
