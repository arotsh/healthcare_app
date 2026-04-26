import { useEffect, useState } from 'react';
import { Box, Flex, Icon, Text, HStack, CloseButton } from '@chakra-ui/react';
import { LuTriangleAlert } from 'react-icons/lu';

// Listens for `quota:exhausted` window events emitted by API clients when
// they receive a 503 with error: "databricks_quota_exhausted". Shows a
// dismissable banner explaining the situation in plain English.

export default function QuotaBanner() {
  const [shown, setShown] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setMessage(e.detail?.message ?? null);
      setShown(true);
    };
    window.addEventListener('quota:exhausted', handler);
    return () => window.removeEventListener('quota:exhausted', handler);
  }, []);

  if (!shown) return null;

  return (
    <Box
      bg="warning.50"
      borderBottom="1px solid"
      borderColor="warning.200"
      px={{ base: 3, md: 5 }}
      py={2}
    >
      <Flex maxW="1200px" mx="auto" align="center" gap={3}>
        <Icon as={LuTriangleAlert} color="warning.700" boxSize="14px" flexShrink={0} />
        <Text fontSize="0.78rem" color="warning.800" lineHeight={1.45} flex={1}>
          <b>Databricks free-tier daily quota exhausted.</b>{' '}
          {message ||
            'The SQL warehouse, Foundation Model API, and Vector Search are paused until the quota refreshes (~midnight UTC). UI loads, but search/analytics will return errors until then.'}
        </Text>
        <CloseButton size="sm" color="warning.700" onClick={() => setShown(false)} />
      </Flex>
    </Box>
  );
}
