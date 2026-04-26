import {
  Box,
  Heading,
  Text,
  Button,
  HStack,
  Link,
  VStack,
  Icon,
  Flex,
  Tag,
  TagLeftIcon,
  TagLabel,
  Spinner,
} from '@chakra-ui/react';
import {
  LuLocateFixed,
  LuShieldCheck,
  LuMessageCircleHeart,
  LuArrowRight,
  LuStethoscope,
} from 'react-icons/lu';

export default function Hero({ onFindNearMe, locationStatus, onOpenChat }) {
  const finding = locationStatus === 'pending';
  return (
    <Box
      position="relative"
      borderRadius="card"
      overflow="hidden"
      bgGradient="linear(135deg, brand.700 0%, brand.500 60%, sky.500 100%)"
      color="white"
      p={{ base: 7, md: 14 }}
      boxShadow="medium"
    >
      <Box
        position="absolute"
        top="-120px"
        right="-120px"
        w="380px"
        h="380px"
        borderRadius="full"
        bg="rgba(255, 255, 255, 0.08)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-80px"
        left="-80px"
        w="260px"
        h="260px"
        borderRadius="full"
        bg="rgba(255, 255, 255, 0.06)"
        pointerEvents="none"
      />

      <VStack align="flex-start" spacing={5} maxW="640px" position="relative">
        <Tag
          size="md"
          borderRadius="pill"
          bg="rgba(255, 255, 255, 0.16)"
          color="white"
          backdropFilter="blur(8px)"
          border="1px solid rgba(255,255,255,0.25)"
          px={3}
          py={1.5}
        >
          <TagLeftIcon as={LuShieldCheck} />
          <TagLabel fontWeight={600} fontSize="0.8rem">
            Trusted facility data from Databricks
          </TagLabel>
        </Tag>

        <Heading
          as="h1"
          fontSize={{ base: '2rem', md: '3rem', lg: '3.4rem' }}
          fontWeight={800}
          lineHeight={1.1}
          letterSpacing="-0.025em"
        >
          Find the right care, ranked by what matters.
        </Heading>

        <Text
          fontSize={{ base: '1rem', md: '1.15rem' }}
          color="rgba(255,255,255,0.88)"
          lineHeight={1.55}
        >
          Search 10,000+ Indian healthcare facilities by emergency, surgery, ICU, diagnostics
          and more. Our AI ranks each match by trust, capability, and proximity to you.
        </Text>

        <HStack spacing={3} flexWrap="wrap" pt={2}>
          <Button
            onClick={onFindNearMe}
            isLoading={finding}
            loadingText="Locating you…"
            size="lg"
            leftIcon={!finding && <Icon as={LuLocateFixed} boxSize="18px" />}
            rightIcon={!finding && <Icon as={LuArrowRight} boxSize="18px" />}
            bg="white"
            color="brand.700"
            fontWeight={700}
            px={6}
            _hover={{ bg: 'brand.50', transform: 'translateY(-1px)', boxShadow: 'lg' }}
            _active={{ transform: 'translateY(0)' }}
            transition="all 0.15s"
          >
            Find care near me
          </Button>
          <Button
            onClick={onOpenChat}
            size="lg"
            leftIcon={<Icon as={LuMessageCircleHeart} boxSize="18px" />}
            variant="outline"
            color="white"
            borderColor="rgba(255,255,255,0.4)"
            bg="rgba(255,255,255,0.1)"
            fontWeight={600}
            _hover={{
              bg: 'rgba(255,255,255,0.18)',
              borderColor: 'white',
            }}
          >
            Ask the assistant
          </Button>
        </HStack>

        <HStack
          spacing={6}
          pt={4}
          color="rgba(255,255,255,0.85)"
          fontSize="0.85rem"
          flexWrap="wrap"
        >
          <Flex align="center" gap={2}>
            <Icon as={LuStethoscope} boxSize="14px" />
            <Text>10,000+ verified facilities</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Icon as={LuShieldCheck} boxSize="14px" />
            <Text>Trust + capability scoring</Text>
          </Flex>
          {finding && (
            <Flex align="center" gap={2}>
              <Spinner size="xs" />
              <Text>Requesting your location…</Text>
            </Flex>
          )}
        </HStack>
      </VStack>
    </Box>
  );
}
