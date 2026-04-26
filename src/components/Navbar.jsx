import {
  Box,
  Flex,
  HStack,
  Button,
  Text,
  Icon,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerBody,
  DrawerHeader,
  VStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverHeader,
  PopoverBody,
  Link,
  useDisclosure,
} from '@chakra-ui/react';
import {
  LuActivity,
  LuMenu,
  LuSiren,
  LuHouse,
  LuMessageCircleHeart,
  LuPhone,
  LuLifeBuoy,
  LuMapPin,
  LuChartArea,
} from 'react-icons/lu';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Home', icon: LuHouse },
  { to: '/chat', label: 'AI Assistant', icon: LuMessageCircleHeart },
  { to: '/insights', label: 'NGO Insights', icon: LuChartArea },
];

const EMERGENCY_NUMBERS = [
  { label: 'Ambulance', number: '102', href: 'tel:102', accent: 'danger' },
  { label: 'All Emergency', number: '108', href: 'tel:108', accent: 'danger' },
];

const HELPLINES = [
  { label: 'KIRAN Mental Health (24×7)', number: '1800-599-0019', href: 'tel:18005990019' },
  { label: 'Vandrevala Foundation', number: '+91 9999 666 555', href: 'tel:+919999666555' },
  { label: 'AASRA', number: '+91 9820466726', href: 'tel:+919820466726' },
];

function Brand() {
  return (
    <Flex
      as={RouterLink}
      to="/"
      align="center"
      gap={2.5}
      _hover={{ textDecoration: 'none' }}
    >
      <Box
        as="img"
        src="/logo.png"
        alt="MediMap"
        w="40px"
        h="40px"
        borderRadius="12px"
        boxShadow="glow"
        objectFit="contain"
      />
      <Box lineHeight={1}>
        <Text fontSize="1.1rem" fontWeight={800} color="ink.900" letterSpacing="-0.02em">
          MediMap
        </Text>
        <Text
          fontSize="0.7rem"
          fontWeight={500}
          color="ink.500"
          letterSpacing="0.05em"
          textTransform="uppercase"
        >
          India
        </Text>
      </Box>
    </Flex>
  );
}

function NavLink({ to, label, icon, active, onClick }) {
  return (
    <Flex
      as={RouterLink}
      to={to}
      onClick={onClick}
      px={3.5}
      py={2}
      gap={2}
      align="center"
      fontSize="0.9rem"
      fontWeight={600}
      color={active ? 'brand.700' : 'ink.600'}
      bg={active ? 'brand.50' : 'transparent'}
      borderRadius="10px"
      _hover={{ color: 'brand.700', bg: 'brand.50', textDecoration: 'none' }}
    >
      <Icon as={icon} boxSize="16px" />
      <Text>{label}</Text>
    </Flex>
  );
}

function EmergencyRow({ entry, accent = 'danger' }) {
  return (
    <Flex
      as={Link}
      href={entry.href}
      align="center"
      justify="space-between"
      px={3}
      py={2.5}
      borderRadius="10px"
      bg={`${accent}.50`}
      border="1px solid"
      borderColor={`${accent}.100`}
      _hover={{ bg: `${accent}.500`, color: 'white', textDecoration: 'none' }}
      transition="all 0.15s"
      role="group"
    >
      <Box>
        <Text fontSize="0.78rem" fontWeight={600} color={`${accent}.700`} _groupHover={{ color: 'white' }}>
          {entry.label}
        </Text>
        <Text fontSize="1.05rem" fontWeight={800} color={`${accent}.700`} _groupHover={{ color: 'white' }}>
          {entry.number}
        </Text>
      </Box>
      <Icon
        as={LuPhone}
        boxSize="18px"
        color={`${accent}.600`}
        _groupHover={{ color: 'white' }}
      />
    </Flex>
  );
}

function HelplineRow({ entry }) {
  return (
    <Flex
      as={Link}
      href={entry.href}
      align="center"
      gap={2}
      px={3}
      py={2}
      borderRadius="8px"
      _hover={{ bg: 'ink.50', textDecoration: 'none' }}
    >
      <Icon as={LuLifeBuoy} color="brand.700" boxSize="14px" />
      <Box>
        <Text fontSize="0.78rem" color="ink.600" lineHeight={1.2}>
          {entry.label}
        </Text>
        <Text fontSize="0.85rem" fontWeight={700} color="ink.900">
          {entry.number}
        </Text>
      </Box>
    </Flex>
  );
}

function EmergencyButton({ onFindER }) {
  return (
    <Popover placement="bottom-end" closeOnBlur>
      <PopoverTrigger>
        <Button
          size="sm"
          px={4}
          leftIcon={<Icon as={LuSiren} boxSize="16px" />}
          bg="danger.50"
          color="danger.600"
          border="1px solid"
          borderColor="danger.100"
          fontWeight={600}
          _hover={{ bg: 'danger.500', color: 'white', borderColor: 'danger.500' }}
          transition="all 0.15s"
        >
          <Text display={{ base: 'none', sm: 'inline' }}>Emergency</Text>
          <Text display={{ base: 'inline', sm: 'none' }}>SOS</Text>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        borderRadius="16px"
        boxShadow="medium"
        border="1px solid"
        borderColor="ink.100"
        w="320px"
        _focus={{ outline: 'none', boxShadow: 'medium' }}
      >
        <PopoverArrow />
        <PopoverHeader borderBottomColor="ink.100" px={4} py={3}>
          <HStack spacing={2}>
            <Icon as={LuSiren} color="danger.500" />
            <Text fontWeight={700} color="ink.900">
              Emergency
            </Text>
          </HStack>
        </PopoverHeader>
        <PopoverBody p={3}>
          <VStack spacing={2} align="stretch">
            {EMERGENCY_NUMBERS.map((e) => (
              <EmergencyRow key={e.number} entry={e} />
            ))}
            <Button
              onClick={onFindER}
              size="md"
              leftIcon={<Icon as={LuMapPin} boxSize="16px" />}
              bgGradient="linear(135deg, brand.500, brand.700)"
              color="white"
              fontWeight={700}
              borderRadius="10px"
              _hover={{ opacity: 0.92 }}
            >
              Find emergency facility near me
            </Button>

            <Box mt={2} pt={3} borderTop="1px solid" borderColor="ink.100">
              <Text fontSize="0.7rem" fontWeight={600} color="ink.500" letterSpacing="0.05em" textTransform="uppercase" mb={1.5}>
                Mental health helplines
              </Text>
              <VStack spacing={0.5} align="stretch">
                {HELPLINES.map((h) => (
                  <HelplineRow key={h.number} entry={h} />
                ))}
              </VStack>
            </Box>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

export default function Navbar({ onEmergency }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { pathname } = useLocation();

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={1000}
      bg="rgba(255, 255, 255, 0.85)"
      backdropFilter="saturate(180%) blur(12px)"
      borderBottom="1px solid"
      borderColor="ink.100"
    >
      <Flex
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={3}
        justify="space-between"
        align="center"
        gap={3}
      >
        <Brand />

        <HStack spacing={1} display={{ base: 'none', md: 'flex' }}>
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} {...l} active={pathname === l.to} />
          ))}
        </HStack>

        <HStack spacing={2}>
          <EmergencyButton onFindER={onEmergency} />
          <IconButton
            display={{ base: 'inline-flex', md: 'none' }}
            aria-label="Open menu"
            icon={<Icon as={LuMenu} boxSize="20px" />}
            onClick={onOpen}
            size="sm"
            variant="ghost"
            color="ink.700"
          />
        </HStack>
      </Flex>

      <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Menu</DrawerHeader>
          <DrawerBody>
            <VStack spacing={1} align="stretch">
              {NAV_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  {...l}
                  active={pathname === l.to}
                  onClick={onClose}
                />
              ))}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
