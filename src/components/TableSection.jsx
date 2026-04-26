import {
  Box,
  Flex,
  Heading,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  HStack,
  Button,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { LuLayoutGrid, LuSearch, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import FacilityGrid from './FacilityGrid.jsx';

export default function TableSection({
  items,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  query,
  onQueryChange,
  onOpenDetails,
  userLocation,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize + items.length);

  return (
    <Box
      id="table-section"
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
              <Icon as={LuLayoutGrid} color="brand.700" boxSize="18px" />
            </Flex>
            <Heading as="h2" fontSize={{ base: '1.1rem', md: '1.35rem' }} color="ink.900">
              Facility Directory
            </Heading>
            {!loading && total > 0 && (
              <Badge colorScheme="teal" borderRadius="pill" px={2} fontSize="0.65rem">
                {total.toLocaleString()}
              </Badge>
            )}
          </HStack>
          <Text color="ink.500" fontSize="0.9rem">
            {loading
              ? 'Loading…'
              : total === 0
              ? 'No matches yet'
              : `Showing ${showingFrom}–${showingTo} of ${total.toLocaleString()} facilities`}
          </Text>
        </Box>
        <InputGroup maxW={{ base: '100%', md: '320px' }}>
          <InputLeftElement pointerEvents="none">
            <Icon as={LuSearch} color="ink.400" boxSize="16px" />
          </InputLeftElement>
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search name, city, or state…"
            bg="ink.50"
            border="1px solid"
            borderColor="ink.100"
            borderRadius="pill"
            fontSize="0.9rem"
            _focus={{ borderColor: 'brand.500', bg: 'white', boxShadow: 'none' }}
          />
        </InputGroup>
      </Flex>

      <FacilityGrid
        items={items}
        loading={loading}
        userLocation={userLocation}
        onOpenDetails={onOpenDetails}
      />

      <Flex mt={6} justify="space-between" align="center" wrap="wrap" gap={3}>
        <Text fontSize="0.82rem" color="ink.500">
          Page {page + 1} of {pageCount}
        </Text>
        <HStack spacing={2}>
          <Button
            size="sm"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            isDisabled={page === 0 || loading}
            leftIcon={<Icon as={LuChevronLeft} boxSize="14px" />}
            variant="outline"
            borderColor="ink.100"
            color="ink.700"
            _hover={{ bg: 'brand.50', borderColor: 'brand.300' }}
          >
            Prev
          </Button>
          <Button
            size="sm"
            onClick={() => onPageChange(page + 1)}
            isDisabled={page + 1 >= pageCount || loading}
            rightIcon={<Icon as={LuChevronRight} boxSize="14px" />}
            bg="brand.700"
            color="white"
            _hover={{ bg: 'brand.800' }}
          >
            Next
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}
