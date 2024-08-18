import { Flex, Heading } from "@radix-ui/themes";

export function Logo() {
  return (
    <Flex justify="center" align="center" gap="3">
      <Heading size="8">Gryt.chat</Heading>
      <img src="/logo.svg" alt="Gryt Logo" width={48} height={48} />
    </Flex>
  );
}
