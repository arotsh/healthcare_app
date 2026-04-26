import ReactMarkdown from 'react-markdown';
import {
  Text,
  Link,
  UnorderedList,
  OrderedList,
  ListItem,
  Box,
  Code,
} from '@chakra-ui/react';

const components = {
  p: ({ children }) => (
    <Text mb={2} lineHeight={1.55} _last={{ mb: 0 }}>
      {children}
    </Text>
  ),
  strong: ({ children }) => (
    <Text as="strong" fontWeight={700} color="ink.900">
      {children}
    </Text>
  ),
  em: ({ children }) => (
    <Text as="em" fontStyle="italic">
      {children}
    </Text>
  ),
  ul: ({ children }) => (
    <UnorderedList mb={2} pl={4} spacing={1.5}>
      {children}
    </UnorderedList>
  ),
  ol: ({ children }) => (
    <OrderedList mb={2} pl={4} spacing={1.5}>
      {children}
    </OrderedList>
  ),
  li: ({ children }) => (
    <ListItem fontSize="0.92rem" lineHeight={1.55}>
      {children}
    </ListItem>
  ),
  a: ({ href, children }) => (
    <Link
      href={href}
      color="brand.700"
      fontWeight={600}
      textDecoration="underline"
      target={href?.startsWith('tel:') || href?.startsWith('mailto:') ? undefined : '_blank'}
      rel="noopener noreferrer"
      _hover={{ color: 'brand.800' }}
    >
      {children}
    </Link>
  ),
  code: ({ children }) => (
    <Code fontSize="0.85rem" bg="ink.100" px={1.5} py={0.5} borderRadius="6px">
      {children}
    </Code>
  ),
  blockquote: ({ children }) => (
    <Box
      borderLeftWidth="3px"
      borderLeftColor="brand.300"
      bg="brand.50"
      pl={3}
      py={2}
      my={2}
      borderRadius="0 8px 8px 0"
      fontSize="0.88rem"
      color="ink.700"
    >
      {children}
    </Box>
  ),
};

export default function MarkdownText({ children }) {
  return <ReactMarkdown components={components}>{children ?? ''}</ReactMarkdown>;
}
