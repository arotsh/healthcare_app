import { useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Icon,
  Collapse,
  Button,
  Flex,
} from '@chakra-ui/react';
import {
  LuBrain,
  LuChevronDown,
  LuChevronUp,
  LuMessageSquare,
  LuSparkles,
  LuDatabase,
  LuShieldCheck,
} from 'react-icons/lu';

function Step({ idx, icon, title, children }) {
  return (
    <HStack align="flex-start" spacing={3} w="100%">
      <Flex
        w="22px"
        h="22px"
        borderRadius="6px"
        bg="brand.50"
        color="brand.700"
        align="center"
        justify="center"
        flexShrink={0}
        fontSize="0.65rem"
        fontWeight={700}
        mt={0.5}
      >
        {idx}
      </Flex>
      <Box flex={1} minW={0}>
        <HStack spacing={1.5} mb={0.5}>
          <Icon as={icon} boxSize="12px" color="ink.600" />
          <Text fontSize="0.72rem" fontWeight={700} color="ink.800" letterSpacing="0.02em">
            {title}
          </Text>
        </HStack>
        <Box fontSize="0.74rem" color="ink.600" lineHeight={1.5}>
          {children}
        </Box>
      </Box>
    </HStack>
  );
}

export default function ChainOfThought({ cot, agent }) {
  const [open, setOpen] = useState(false);
  if (!cot) return null;

  const intents = cot.step_1_parse?.intents ?? [];
  const verifyRate = cot.step_4_verify?.rate;

  return (
    <Box mt={2} w="100%">
      <Button
        size="xs"
        variant="ghost"
        leftIcon={<Icon as={LuBrain} boxSize="13px" />}
        rightIcon={<Icon as={open ? LuChevronUp : LuChevronDown} boxSize="12px" />}
        onClick={() => setOpen((v) => !v)}
        color="ink.600"
        fontSize="0.74rem"
        fontWeight={600}
        h="28px"
        px={2}
        _hover={{ bg: 'brand.50', color: 'brand.700' }}
      >
        {open ? 'Hide' : 'Show'} chain of thought
      </Button>
      <Collapse in={open} animateOpacity>
        <Box
          mt={1.5}
          p={3}
          bg="white"
          border="1px solid"
          borderColor="ink.100"
          borderRadius="12px"
        >
          <VStack spacing={2.5} align="stretch">
            <Step idx={1} icon={LuMessageSquare} title="Parsed your request">
              {intents.length > 0 ? (
                <>Detected intents: <b>{intents.join(', ')}</b></>
              ) : (
                <>No specific intent — general healthcare search</>
              )}
              {cot.step_1_parse?.location && (
                <> · Location filter: <b>{cot.step_1_parse.location}</b></>
              )}
              {cot.step_1_parse?.top_k != null && (
                <> · Asked for top {cot.step_1_parse.top_k}</>
              )}
            </Step>

            <Step idx={2} icon={LuSparkles} title="Semantic retrieval (Mosaic Vector Search)">
              {cot.step_2_semantic?.used ? (
                <>
                  Searched 10K facility profiles → narrowed to{' '}
                  <b>{cot.step_2_semantic.candidates}</b> semantic candidates
                  {' '}(pool size {cot.step_2_semantic.pool_size}).
                </>
              ) : (
                <>Vector search unavailable — used structured signals only.</>
              )}
            </Step>

            <Step idx={3} icon={LuDatabase} title="Weighted SQL ranking">
              {cot.step_3_sql_rank?.scored_signals > 0 ? (
                <>
                  Scored on <b>{cot.step_3_sql_rank.scored_signals}</b> capability dimension(s)
                </>
              ) : (
                <>Used overall facility score (no specific intent)</>
              )}
              {cot.step_3_sql_rank?.location_filtered && <> · location filter applied</>}
              {' '}· Returned <b>{cot.step_3_sql_rank?.result_count ?? 0}</b> ranked facilities.
            </Step>

            <Step idx={4} icon={LuShieldCheck} title="Self-verification">
              {cot.step_4_verify?.checked > 0 ? (
                <>
                  Re-checked claims against evidence for top{' '}
                  <b>{cot.step_4_verify.checked}</b> result(s) →{' '}
                  <b>{cot.step_4_verify.verified}</b> verified
                  {verifyRate != null && ` (${Math.round(verifyRate * 100)}% rate)`}.
                </>
              ) : (
                <>No results to verify.</>
              )}
            </Step>

            {agent?.semantic_pool > 0 && (
              <Box pt={2} borderTop="1px solid" borderColor="ink.100">
                <Text fontSize="0.66rem" color="ink.400" letterSpacing="0.03em">
                  Hybrid retrieval: semantic recall narrows the candidate pool, structured scoring ranks within it,
                  verification audits the top picks.
                </Text>
              </Box>
            )}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  );
}
