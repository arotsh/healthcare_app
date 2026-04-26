import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Input,
  IconButton,
  HStack,
  Button,
  VStack,
  Icon,
  Spinner,
  Wrap,
  WrapItem,
  Tag,
  Badge,
  Tooltip,
} from '@chakra-ui/react';
import {
  LuMessageCircleHeart,
  LuSendHorizontal,
  LuActivity,
  LuMapPin,
  LuLocateFixed,
  LuTriangleAlert,
  LuTrash2,
  LuShieldCheck,
  LuVolume2,
  LuVolumeX,
  LuLifeBuoy,
  LuChartBar,
  LuExternalLink,
} from 'react-icons/lu';
import { sendChat } from '../api/chat.js';
import FacilityCards from '../components/FacilityCards.jsx';
import GeniePanel from '../components/GeniePanel.jsx';
import ChainOfThought from '../components/ChainOfThought.jsx';
import VoiceInput, { getStoredVoiceLang } from '../components/VoiceInput.jsx';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis.js';
import MarkdownText from '../components/MarkdownText.jsx';

const initialMessage = {
  role: 'assistant',
  content:
    "Hi, I'm MediBot. Tell me what care you need (emergency, surgery, ICU, MRI, maternity, cardiology...) and where, and I'll rank the right facilities for you.",
};

const INTENT_LABELS = {
  needs_emergency: 'Emergency',
  needs_surgery: 'Surgery',
  needs_diagnostics: 'Diagnostics',
  needs_critical_care: 'ICU',
  needs_maternal: 'Maternal',
  needs_specialty: 'Specialty',
};

const SUGGESTIONS = [
  'Emergency hospitals with ICU and surgery in Bihar',
  'MRI and CT scan in Mumbai',
  'Maternity and neonatal care in Patna',
  'Cardiology specialists in Bangalore',
  'How many hospitals are there in each state?',
  'Top 10 cities with the most ICU-capable facilities',
];

function ParsedIntent({ parsed }) {
  if (!parsed) return null;
  const flags = Object.entries(INTENT_LABELS)
    .filter(([key]) => parsed[key])
    .map(([, label]) => label);
  if (flags.length === 0 && !parsed.location_text) return null;
  return (
    <Wrap spacing={1.5} mt={3}>
      {parsed.location_text && (
        <WrapItem>
          <Tag size="sm" colorScheme="purple" variant="subtle" borderRadius="pill">
            <Icon as={LuMapPin} boxSize="11px" mr={1} />
            {parsed.location_text}
          </Tag>
        </WrapItem>
      )}
      {flags.map((label) => (
        <WrapItem key={label}>
          <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="pill">
            {label}
          </Tag>
        </WrapItem>
      ))}
    </Wrap>
  );
}

function SpeakButton({ text, lang, tts }) {
  if (!tts.supported || !text) return null;
  return (
    <IconButton
      aria-label={tts.speaking ? 'Stop speaking' : 'Read aloud'}
      icon={<Icon as={tts.speaking ? LuVolumeX : LuVolume2} boxSize="13px" />}
      onClick={() => (tts.speaking ? tts.cancel() : tts.speak(text, lang))}
      size="xs"
      variant="ghost"
      color="ink.400"
      borderRadius="8px"
      h="22px"
      minW="22px"
      _hover={{ bg: 'brand.50', color: 'brand.700' }}
    />
  );
}

function MessageRow({ msg, onOpenDetails, userLocation, tts, voiceLang }) {
  const isUser = msg.role === 'user';
  return (
    <Flex gap={3} align="flex-start" w="100%" justify={isUser ? 'flex-end' : 'flex-start'}>
      {!isUser && (
        <Box
          as="img"
          src="/logo.png"
          alt="MediBot"
          w="36px"
          h="36px"
          borderRadius="10px"
          boxShadow="glow"
          objectFit="contain"
          flexShrink={0}
        />
      )}

      <Box flex={1} minW={0} maxW={isUser ? '78%' : '100%'} display="flex" flexDirection="column" alignItems={isUser ? 'flex-end' : 'flex-start'}>
        <Box
          bg={
            isUser
              ? 'brand.700'
              : msg.isCrisis
              ? 'danger.50'
              : msg.isRedirect
              ? 'warning.50'
              : msg.isClarification
              ? 'sky.50'
              : msg.isAnalytics
              ? 'brand.50'
              : 'white'
          }
          color={isUser ? 'white' : 'ink.800'}
          border={isUser ? 'none' : '1px solid'}
          borderColor={
            msg.isCrisis
              ? 'danger.500'
              : msg.isRedirect
              ? 'warning.500'
              : msg.isClarification
              ? 'sky.200'
              : msg.isAnalytics
              ? 'brand.200'
              : 'ink.100'
          }
          borderLeftWidth={msg.isCrisis ? '4px' : undefined}
          px={4}
          py={3}
          borderRadius="16px"
          borderTopLeftRadius={isUser ? '16px' : '6px'}
          borderTopRightRadius={isUser ? '6px' : '16px'}
          fontSize="0.95rem"
          boxShadow={isUser ? 'none' : 'soft'}
          maxW="100%"
          wordBreak="break-word"
          overflowWrap="anywhere"
        >
          {msg.isClarification && (
            <Text fontSize="0.7rem" fontWeight={700} color="sky.600" letterSpacing="0.05em" textTransform="uppercase" mb={1}>
              Quick question
            </Text>
          )}
          {msg.isRedirect && (
            <Text fontSize="0.7rem" fontWeight={700} color="warning.600" letterSpacing="0.05em" textTransform="uppercase" mb={1}>
              Out of scope
            </Text>
          )}
          {msg.isCrisis && (
            <HStack mb={2} spacing={1.5}>
              <Icon as={LuLifeBuoy} color="danger.600" boxSize="14px" />
              <Text fontSize="0.7rem" fontWeight={700} color="danger.600" letterSpacing="0.05em" textTransform="uppercase">
                Support resources
              </Text>
            </HStack>
          )}
          {msg.isAnalytics && (
            <HStack mb={2} spacing={1.5}>
              <Icon as={LuChartBar} color="brand.700" boxSize="14px" />
              <Text fontSize="0.7rem" fontWeight={700} color="brand.700" letterSpacing="0.05em" textTransform="uppercase">
                Data answer · Genie
              </Text>
            </HStack>
          )}
          {isUser ? (
            <Text whiteSpace="pre-wrap" lineHeight={1.55}>
              {msg.content}
            </Text>
          ) : (
            <Box fontSize="0.92rem" color="ink.800">
              <MarkdownText>{msg.content}</MarkdownText>
            </Box>
          )}
          {!isUser && <ParsedIntent parsed={msg.parsed} />}
          {!isUser && msg.content && (
            <Flex justify="flex-end" mt={1.5} mr="-4px">
              <SpeakButton text={msg.content} lang={voiceLang} tts={tts} />
            </Flex>
          )}
        </Box>
        {!isUser && msg.facilities?.length > 0 && (
          <Box w="100%" mt={2}>
            <FacilityCards
              facilities={msg.facilities}
              onOpenDetails={onOpenDetails}
              userLocation={userLocation}
            />
          </Box>
        )}
        {!isUser && msg.chainOfThought && (
          <Box w="100%">
            <ChainOfThought cot={msg.chainOfThought} agent={msg.agent} />
          </Box>
        )}
        {!isUser && msg.genie && (
          <Box w="100%">
            <GeniePanel genie={msg.genie} />
          </Box>
        )}
        {!isUser && msg.traceUrl && (
          <HStack spacing={1} mt={1.5} fontSize="0.66rem" color="ink.400">
            <Icon as={LuExternalLink} boxSize="10px" />
            <Text
              as="a"
              href={msg.traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              _hover={{ color: 'brand.600', textDecoration: 'underline' }}
            >
              MLflow trace
            </Text>
          </HStack>
        )}
      </Box>

      {isUser && (
        <Flex
          w="36px"
          h="36px"
          borderRadius="10px"
          align="center"
          justify="center"
          flexShrink={0}
          bg="ink.900"
          color="white"
        >
          <Text fontSize="0.65rem" fontWeight={700} letterSpacing="0.05em">
            YOU
          </Text>
        </Flex>
      )}
    </Flex>
  );
}

function PendingRow() {
  return (
    <Flex gap={3} align="flex-start">
      <Box
        as="img"
        src="/logo.png"
        alt="MediBot"
        w="36px"
        h="36px"
        borderRadius="10px"
        boxShadow="glow"
        objectFit="contain"
        flexShrink={0}
      />
      <Box
        bg="white"
        border="1px solid"
        borderColor="ink.100"
        px={4}
        py={3}
        borderRadius="16px"
        borderTopLeftRadius="6px"
        boxShadow="soft"
      >
        <HStack spacing={2}>
          <Spinner size="xs" color="brand.500" />
          <Text fontSize="0.85rem" color="ink.500">
            Searching facility signals…
          </Text>
        </HStack>
      </Box>
    </Flex>
  );
}

export default function ChatPage({
  pendingPrompt,
  userLocation,
  locationStatus,
  onRequestLocation,
  onOpenDetails,
  chatHistory,
  setChatHistory,
}) {
  const [messages, setMessages] = useState(
    chatHistory && chatHistory.length > 0 ? chatHistory : [initialMessage]
  );
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [clarifyCount, setClarifyCount] = useState(0);
  const [genieConversationId, setGenieConversationId] = useState(null);
  const [voiceLang, setVoiceLang] = useState(getStoredVoiceLang);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const lastPendingTsRef = useRef(null);
  const tts = useSpeechSynthesis();

  useEffect(() => {
    setChatHistory(messages);
  }, [messages, setChatHistory]);

  const submit = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setError(null);
    setDraft('');
    const next = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setPending(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const data = await sendChat(
        next.map(({ role, content }) => ({ role, content })),
        {
          signal: ctrl.signal,
          userLat: userLocation?.lat,
          userLon: userLocation?.lng,
          clarifyCount,
          genieConversationId,
        }
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || '(no reply)',
          facilities: data.agent?.results ?? [],
          parsed: data.agent?.parsed_query ?? null,
          chainOfThought: data.agent?.chain_of_thought ?? null,
          agent: data.agent ?? null,
          genie: data.genie ?? null,
          traceUrl: data.trace_url ?? null,
          isClarification: !!data.isClarification,
          isRedirect: !!data.isRedirect,
          isCrisis: !!data.isCrisis,
          isAnalytics: !!data.isAnalytics,
        },
      ]);
      setClarifyCount(data.isClarification ? data.clarifyCount ?? clarifyCount + 1 : 0);
      if (data.genie?.conversation_id) {
        setGenieConversationId(data.genie.conversation_id);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry — the assistant errored: ${err.message}` },
      ]);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!pendingPrompt?.text) return;
    if (lastPendingTsRef.current === pendingPrompt.ts) return;
    lastPendingTsRef.current = pendingPrompt.ts;
    submit(pendingPrompt.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  const clearChat = () => {
    setMessages([initialMessage]);
    setError(null);
    setClarifyCount(0);
    setGenieConversationId(null);
  };

  return (
    <Box bg="transparent" h="calc(100vh - 65px)">
      <Container maxW="880px" h="100%" py={{ base: 0, md: 5 }} px={{ base: 0, md: 5 }}>
        <Flex
          direction="column"
          h="100%"
          bg="white"
          borderRadius={{ base: 0, md: 'card' }}
          border={{ base: 'none', md: '1px solid' }}
          borderColor="ink.100"
          boxShadow={{ base: 'none', md: 'soft' }}
          overflow="hidden"
        >
          {/* Header */}
          <Flex
            justify="space-between"
            align="center"
            px={{ base: 4, md: 6 }}
            py={4}
            borderBottom="1px solid"
            borderColor="ink.100"
            flexShrink={0}
            bg="white"
          >
            <HStack spacing={3}>
              <Flex
                w="40px"
                h="40px"
                borderRadius="12px"
                bgGradient="linear(135deg, brand.500, brand.700)"
                color="white"
                align="center"
                justify="center"
                boxShadow="glow"
              >
                <Icon as={LuMessageCircleHeart} boxSize="20px" />
              </Flex>
              <Box>
                <Heading fontSize={{ base: '1rem', md: '1.15rem' }} color="ink.900">
                  MediBot Assistant
                </Heading>
                <HStack spacing={1.5} color="ink.500" fontSize="0.75rem">
                  <Badge
                    colorScheme="green"
                    variant="subtle"
                    borderRadius="pill"
                    px={2}
                    fontSize="0.65rem"
                  >
                    online
                  </Badge>
                  <Text>•</Text>
                  <Text>10K facilities ranked live</Text>
                </HStack>
              </Box>
            </HStack>

            <HStack spacing={2}>
              <Tooltip
                label={
                  userLocation
                    ? 'Distance is included in ranking'
                    : 'Enable location to rank by distance'
                }
                placement="bottom-end"
                hasArrow
              >
                <IconButton
                  aria-label="Toggle location"
                  icon={<Icon as={LuLocateFixed} boxSize="16px" />}
                  onClick={onRequestLocation}
                  isLoading={locationStatus === 'pending'}
                  size="sm"
                  variant="ghost"
                  color={userLocation ? 'success.600' : 'ink.500'}
                  bg={userLocation ? 'success.50' : 'transparent'}
                  _hover={{ bg: userLocation ? 'success.50' : 'brand.50' }}
                />
              </Tooltip>
              <Tooltip label="Clear chat" placement="bottom-end" hasArrow>
                <IconButton
                  aria-label="Clear chat"
                  icon={<Icon as={LuTrash2} boxSize="16px" />}
                  onClick={clearChat}
                  size="sm"
                  variant="ghost"
                  color="ink.500"
                  _hover={{ bg: 'danger.50', color: 'danger.600' }}
                />
              </Tooltip>
            </HStack>
          </Flex>

          {/* Messages */}
          <Box flex={1} overflowY="auto" bg="ink.50" px={{ base: 3, md: 6 }} py={5} ref={scrollRef}>
            <VStack spacing={5} align="stretch" maxW="100%">
              {messages.map((msg, idx) => (
                <MessageRow
                  key={idx}
                  msg={msg}
                  onOpenDetails={onOpenDetails}
                  userLocation={userLocation}
                  tts={tts}
                  voiceLang={voiceLang}
                />
              ))}
              {pending && <PendingRow />}
            </VStack>
          </Box>

          {/* Footer (suggestions + input) */}
          <Box flexShrink={0} bg="white" borderTop="1px solid" borderColor="ink.100">
            {messages.length <= 1 && (
              <Box px={{ base: 3, md: 5 }} pt={3}>
                <Wrap spacing={2}>
                  {SUGGESTIONS.map((s) => (
                    <WrapItem key={s}>
                      <Button
                        onClick={() => submit(s)}
                        isDisabled={pending}
                        size="sm"
                        variant="outline"
                        borderColor="ink.100"
                        bg="ink.50"
                        color="ink.700"
                        borderRadius="pill"
                        fontSize="0.78rem"
                        fontWeight={500}
                        _hover={{ borderColor: 'brand.300', color: 'brand.700', bg: 'brand.50' }}
                      >
                        {s}
                      </Button>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            )}
            {error && (
              <Box px={{ base: 3, md: 5 }} pt={3}>
                <HStack
                  bg="danger.50"
                  border="1px solid"
                  borderColor="danger.100"
                  px={3}
                  py={2}
                  borderRadius="10px"
                  fontSize="0.8rem"
                  color="danger.600"
                  spacing={2}
                >
                  <Icon as={LuTriangleAlert} boxSize="14px" flexShrink={0} />
                  <Text noOfLines={2}>{error}</Text>
                </HStack>
              </Box>
            )}
            <Flex p={{ base: 3, md: 4 }} gap={2} align="center">
              <VoiceInput
                isDisabled={pending}
                onTranscript={(t) => setDraft(t)}
                onFinal={(finalText, lang) => {
                  setVoiceLang(lang);
                  setDraft('');
                  submit(finalText);
                }}
              />
              <Input
                flex={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit(draft)}
                placeholder='Type or tap the mic — "I need emergency surgery in Mumbai"'
                isDisabled={pending}
                bg="ink.50"
                border="1px solid"
                borderColor="ink.100"
                borderRadius="12px"
                fontSize="0.95rem"
                size="md"
                h="40px"
                _focus={{ borderColor: 'brand.500', bg: 'white', boxShadow: 'none' }}
                _placeholder={{ color: 'ink.400' }}
              />
              <IconButton
                aria-label="Send"
                icon={<Icon as={LuSendHorizontal} boxSize="18px" />}
                onClick={() => submit(draft)}
                isDisabled={pending || !draft.trim()}
                bgGradient="linear(135deg, brand.500, brand.700)"
                color="white"
                _hover={{ opacity: 0.9, transform: 'translateY(-1px)' }}
                _active={{ transform: 'translateY(0)' }}
                borderRadius="12px"
                transition="all 0.15s"
                size="md"
                h="40px"
                w="40px"
              />
            </Flex>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
