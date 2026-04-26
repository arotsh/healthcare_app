import { Box, Container, VStack, Heading, Text, Button, HStack, Icon, Flex } from '@chakra-ui/react';
import { LuMessageCircleHeart, LuArrowRight, LuSparkles } from 'react-icons/lu';
import Hero from '../components/Hero.jsx';
import MapSection from '../components/MapSection.jsx';
import TableSection from '../components/TableSection.jsx';

function ChatBanner({ onOpenChat }) {
  return (
    <Box
      borderRadius="card"
      p={{ base: 5, md: 7 }}
      bgGradient="linear(135deg, ink.900 0%, brand.900 100%)"
      color="white"
      position="relative"
      overflow="hidden"
      boxShadow="medium"
    >
      <Box
        position="absolute"
        top="-60px"
        right="-60px"
        w="220px"
        h="220px"
        borderRadius="full"
        bg="rgba(20, 184, 166, 0.18)"
        filter="blur(20px)"
        pointerEvents="none"
      />
      <Flex
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        gap={4}
        flexDir={{ base: 'column', md: 'row' }}
        position="relative"
      >
        <HStack spacing={4} align="flex-start">
          <Flex
            w="48px"
            h="48px"
            borderRadius="14px"
            bgGradient="linear(135deg, brand.400, brand.600)"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Icon as={LuSparkles} color="white" boxSize="22px" />
          </Flex>
          <Box>
            <Heading fontSize={{ base: '1.2rem', md: '1.5rem' }} fontWeight={700} mb={1}>
              Need personalized guidance?
            </Heading>
            <Text color="rgba(255,255,255,0.78)" fontSize="0.95rem" lineHeight={1.5} maxW="500px">
              Describe your symptoms or care need in plain English. Our AI matches you to the
              right facility, ranked by trust, capability, and proximity.
            </Text>
          </Box>
        </HStack>
        <Button
          onClick={onOpenChat}
          size="lg"
          rightIcon={<Icon as={LuArrowRight} boxSize="18px" />}
          leftIcon={<Icon as={LuMessageCircleHeart} boxSize="18px" />}
          bg="white"
          color="brand.700"
          fontWeight={700}
          px={6}
          flexShrink={0}
          _hover={{ bg: 'brand.50', transform: 'translateY(-1px)' }}
          transition="all 0.15s"
        >
          Open AI Assistant
        </Button>
      </Flex>
    </Box>
  );
}

export default function LandingPage({
  items,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  query,
  onQueryChange,
  userLocation,
  locationStatus,
  onFindNearMe,
  onOpenChat,
  onOpenDetails,
}) {
  return (
    <Container maxW="1200px" py={{ base: 4, md: 8 }} px={{ base: 4, md: 6 }}>
      <VStack spacing={{ base: 6, md: 10 }} align="stretch">
        <Hero onFindNearMe={onFindNearMe} locationStatus={locationStatus} onOpenChat={onOpenChat} />
        <ChatBanner onOpenChat={onOpenChat} />
        <MapSection
          items={items}
          userLocation={userLocation}
          onRequestLocation={onFindNearMe}
          onOpenDetails={onOpenDetails}
          locationStatus={locationStatus}
        />
        <TableSection
          items={items}
          total={total}
          loading={loading}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          query={query}
          onQueryChange={onQueryChange}
          onOpenDetails={onOpenDetails}
          userLocation={userLocation}
        />
      </VStack>
    </Container>
  );
}
