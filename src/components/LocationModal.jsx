import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Button,
  HStack,
  Icon,
  Heading,
  Text,
  VStack,
  Flex,
} from '@chakra-ui/react';
import { LuLocateFixed } from 'react-icons/lu';

export default function LocationModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay bg="rgba(15, 23, 42, 0.55)" backdropFilter="blur(6px)" />
      <ModalContent borderRadius="20px" maxW="420px" overflow="hidden">
        <ModalBody py={8} px={6}>
          <VStack spacing={4}>
            <Flex
              w="56px"
              h="56px"
              borderRadius="16px"
              bgGradient="linear(135deg, brand.500, brand.700)"
              align="center"
              justify="center"
              boxShadow="glow"
            >
              <Icon as={LuLocateFixed} color="white" boxSize="28px" />
            </Flex>
            <VStack spacing={1.5} textAlign="center">
              <Heading as="h3" fontSize="1.2rem" color="ink.900">
                Location access blocked
              </Heading>
              <Text color="ink.500" fontSize="0.9rem" lineHeight={1.5}>
                MediMap needs your location to rank facilities by distance. Please enable it in
                your browser settings, then try again.
              </Text>
            </VStack>
            <HStack spacing={2} pt={2} width="full">
              <Button
                onClick={onClose}
                flex={1}
                variant="outline"
                borderColor="ink.200"
                color="ink.700"
                _hover={{ bg: 'ink.50' }}
              >
                Got it
              </Button>
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
