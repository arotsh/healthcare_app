import {
  Box,
  HStack,
  Icon,
  Text,
  Code,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Collapse,
  Button,
} from '@chakra-ui/react';
import { useState } from 'react';
import { LuChartBar, LuChevronDown, LuChevronUp, LuDatabase } from 'react-icons/lu';

const MAX_PREVIEW_ROWS = 12;

function formatCell(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  return String(v);
}

export default function GeniePanel({ genie }) {
  const [showSql, setShowSql] = useState(false);
  const columns = genie?.table?.columns ?? [];
  const rows = genie?.table?.rows ?? [];
  const hasTable = columns.length > 0 && rows.length > 0;
  const previewRows = rows.slice(0, MAX_PREVIEW_ROWS);

  return (
    <Box mt={2.5} w="100%">
      <Box
        px={3}
        py={2.5}
        borderRadius="12px"
        bg="brand.50"
        border="1px solid"
        borderColor="brand.100"
      >
        <HStack spacing={1.5}>
          <Icon as={LuChartBar} color="brand.700" boxSize="13px" />
          <Text fontSize="0.66rem" fontWeight={700} color="brand.700" letterSpacing="0.05em" textTransform="uppercase">
            Genie analytics
          </Text>
        </HStack>
        {genie?.description && (
          <Text fontSize="0.78rem" color="ink.700" mt={1.5} lineHeight={1.45}>
            {genie.description}
          </Text>
        )}
      </Box>

      {hasTable && (
        <Box
          mt={2}
          border="1px solid"
          borderColor="ink.100"
          borderRadius="12px"
          bg="white"
          overflow="hidden"
        >
          <Box overflowX="auto" maxH="320px" overflowY="auto">
            <Table size="sm" variant="simple">
              <Thead bg="ink.50" position="sticky" top={0} zIndex={1}>
                <Tr>
                  {columns.map((c) => (
                    <Th
                      key={c.name}
                      fontSize="0.68rem"
                      color="ink.600"
                      letterSpacing="0.04em"
                      borderColor="ink.100"
                      py={2}
                    >
                      {c.name}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {previewRows.map((row, idx) => (
                  <Tr key={idx} _hover={{ bg: 'brand.50' }}>
                    {row.map((cell, ci) => (
                      <Td key={ci} fontSize="0.78rem" color="ink.800" borderColor="ink.100" py={2}>
                        {formatCell(cell)}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          {rows.length > MAX_PREVIEW_ROWS && (
            <Box px={3} py={1.5} bg="ink.50" borderTop="1px solid" borderColor="ink.100">
              <Text fontSize="0.7rem" color="ink.500">
                Showing {MAX_PREVIEW_ROWS} of {rows.length} rows
              </Text>
            </Box>
          )}
        </Box>
      )}

      {genie?.sql && (
        <Box mt={2}>
          <Button
            size="xs"
            variant="ghost"
            color="ink.600"
            leftIcon={<Icon as={LuDatabase} boxSize="12px" />}
            rightIcon={<Icon as={showSql ? LuChevronUp : LuChevronDown} boxSize="12px" />}
            onClick={() => setShowSql((v) => !v)}
            fontSize="0.72rem"
            _hover={{ bg: 'brand.50', color: 'brand.700' }}
          >
            {showSql ? 'Hide' : 'View'} generated SQL
          </Button>
          <Collapse in={showSql} animateOpacity>
            <Code
              display="block"
              whiteSpace="pre-wrap"
              fontSize="0.72rem"
              p={3}
              mt={1.5}
              borderRadius="8px"
              bg="ink.900"
              color="ink.50"
              fontFamily="mono"
              lineHeight={1.5}
            >
              {genie.sql}
            </Code>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}
