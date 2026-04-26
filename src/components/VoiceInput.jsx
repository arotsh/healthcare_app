import { useEffect, useState } from 'react';
import {
  IconButton,
  HStack,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
  Icon,
  Box,
  Button,
  Text,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { LuMic, LuMicOff, LuChevronDown, LuCheck } from 'react-icons/lu';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.js';

export const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)', short: 'EN', native: 'English' },
  { code: 'hi-IN', label: 'Hindi', short: 'हि', native: 'हिन्दी' },
  { code: 'bn-IN', label: 'Bengali', short: 'বাং', native: 'বাংলা' },
  { code: 'ta-IN', label: 'Tamil', short: 'தமி', native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', short: 'తె', native: 'తెలుగు' },
  { code: 'mr-IN', label: 'Marathi', short: 'मरा', native: 'मराठी' },
  { code: 'gu-IN', label: 'Gujarati', short: 'ગુ', native: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'Kannada', short: 'ಕನ್', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam', short: 'മല', native: 'മലയാളം' },
  { code: 'pa-IN', label: 'Punjabi', short: 'ਪੰਜ', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur-IN', label: 'Urdu', short: 'اردو', native: 'اردو' },
];

const STORAGE_KEY = 'medimap.voice.lang';

const micPulse = keyframes`
  0% { transform: scale(0.85); opacity: 0.7; }
  100% { transform: scale(1.6); opacity: 0; }
`;

export function getStoredVoiceLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en-IN';
  } catch {
    return 'en-IN';
  }
}

export default function VoiceInput({ onTranscript, onFinal, isDisabled }) {
  const [lang, setLang] = useState(getStoredVoiceLang);
  const { start, stop, listening, transcript, error, supported } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) onTranscript?.(transcript);
  }, [transcript, onTranscript]);

  if (!supported) return null;

  const setLangPersist = (code) => {
    setLang(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {}
  };

  const toggle = () => {
    if (listening) {
      stop();
    } else {
      start({ lang, onFinal: (final) => onFinal?.(final, lang) });
    }
  };

  const current = VOICE_LANGUAGES.find((l) => l.code === lang) ?? VOICE_LANGUAGES[0];

  return (
    <HStack spacing={1}>
      <Menu placement="top-start">
        <MenuButton
          as={Button}
          size="sm"
          h="40px"
          minW="48px"
          variant="ghost"
          rightIcon={<Icon as={LuChevronDown} boxSize="11px" />}
          fontSize="0.7rem"
          fontWeight={700}
          color="ink.500"
          px={2}
          isDisabled={listening}
          _hover={{ bg: 'ink.50', color: 'brand.700' }}
        >
          {current.short}
        </MenuButton>
        <MenuList fontSize="0.85rem" maxH="320px" overflowY="auto" minW="220px">
          <Box px={3} py={2}>
            <Text fontSize="0.65rem" color="ink.500" letterSpacing="0.05em" textTransform="uppercase">
              Voice language
            </Text>
          </Box>
          {VOICE_LANGUAGES.map((l) => (
            <MenuItem
              key={l.code}
              onClick={() => setLangPersist(l.code)}
              fontWeight={l.code === lang ? 700 : 500}
              color={l.code === lang ? 'brand.700' : 'ink.700'}
              bg={l.code === lang ? 'brand.50' : 'transparent'}
              icon={
                <Icon
                  as={LuCheck}
                  boxSize="14px"
                  visibility={l.code === lang ? 'visible' : 'hidden'}
                />
              }
            >
              <HStack justify="space-between" w="full">
                <Text>{l.native}</Text>
                <Text fontSize="0.7rem" color="ink.400">
                  {l.label}
                </Text>
              </HStack>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>

      <Tooltip
        label={listening ? `Listening… tap to stop` : `Speak in ${current.native}`}
        placement="top"
        hasArrow
      >
        <Box position="relative">
          {listening && (
            <Box
              position="absolute"
              inset="-2px"
              borderRadius="14px"
              bg="danger.500"
              animation={`${micPulse} 1.4s ease-out infinite`}
              pointerEvents="none"
            />
          )}
          <IconButton
            aria-label={listening ? 'Stop recording' : 'Start voice input'}
            icon={<Icon as={listening ? LuMicOff : LuMic} boxSize="18px" />}
            onClick={toggle}
            isDisabled={isDisabled && !listening}
            size="md"
            h="40px"
            w="40px"
            bg={listening ? 'danger.500' : 'white'}
            color={listening ? 'white' : 'brand.700'}
            border="1px solid"
            borderColor={listening ? 'danger.500' : 'ink.100'}
            borderRadius="12px"
            position="relative"
            zIndex={1}
            _hover={{
              bg: listening ? 'danger.600' : 'brand.50',
              borderColor: listening ? 'danger.600' : 'brand.300',
            }}
            transition="all 0.15s"
          />
        </Box>
      </Tooltip>
    </HStack>
  );
}
