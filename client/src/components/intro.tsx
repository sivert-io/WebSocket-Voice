import { Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";

interface Props {
  submit: (localNickname: string) => any;
}

export function Intro({ submit }: Props) {
  const [localNickname, setLocalNickname] = useState("");

  return (
    <Card>
      <Flex direction="column" gap="2">
        <Text weight="medium" size="4">
          Choose a nickname
        </Text>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(localNickname);
          }}
        >
          <Flex gap="2">
            <TextField.Root
              minLength={3}
              maxLength={12}
              title="Nickname"
              placeholder="Bulleberg"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
            />
            <Button type="submit">Submit</Button>
          </Flex>
        </form>
      </Flex>
    </Card>
  );
}
