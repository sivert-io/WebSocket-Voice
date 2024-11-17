import { Button, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { RegisterData, useAccount, Logo } from "@/common";
import { FormEvent, useState } from "react";
import { useReward } from "react-rewards";
import { VerifyEmailContent } from "./verifyEmailContent";

export function SignUpModal() {
  const [showSignUp, setShowSignUp] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Form data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const { register, login } = useAccount();
  const { reward } = useReward("registerModal", "balloons", {
    zIndex: -1,
    colors: ["var(--accent-9)"],
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData: RegisterData = {
      email,
      password,
      confirm_password: repeatPassword,
    };

    try {
      if (showSignUp) {
        if (password !== repeatPassword) {
          setError("Passwords do not match");
          return;
        }

        if (
          email.length === 0 ||
          password.length === 0 ||
          repeatPassword.length === 0
        ) {
          setError("Fields cannot be empty");
          return;
        }

        const success = await register(formData);
        if (success) {
          setShowVerifyEmail(true);
          reward();
        }
      } else {
        if (email.length > 0 && password.length > 0) {
          const error = await login(formData);
          setError(error);
        } else {
          setError("Fields cannot be empty");
        }
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    }
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        padding: "64px",
      }}
      width="100%"
      height="100%"
    >
      <div
        id="registerModal"
        style={{
          position: "absolute",
        }}
      />
      <div>
        {showVerifyEmail ? (
          <VerifyEmailContent />
        ) : (
          <Flex direction="column" gap="6" width="280px">
            <Logo />
            <Flex direction="column" gap="3">
              <Heading>{showSignUp ? "Register" : "Login"}</Heading>
              <form onSubmit={handleSubmit}>
                <Flex direction="column" gap="3">
                  <TextField.Root
                    id="email"
                    placeholder="Email"
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <TextField.Root
                    id="password"
                    placeholder="Password"
                    type="password"
                    autoComplete={
                      showSignUp ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {showSignUp && (
                    <TextField.Root
                      id="repeatPassword"
                      placeholder="Repeat password"
                      type="password"
                      autoComplete="new-password"
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  )}
                  <Button type="submit">
                    {showSignUp ? "Continue" : "Sign in"}
                  </Button>
                  {error && (
                    <Text color="red" size="1" weight="medium">
                      {error}
                    </Text>
                  )}
                </Flex>
              </form>
            </Flex>
            <Button
              onClick={() => {
                setShowSignUp(!showSignUp);
                setError(undefined);
              }}
              variant="ghost"
              size="1"
            >
              {showSignUp
                ? "I already have an account"
                : "Register a new account"}
            </Button>
          </Flex>
        )}
      </div>
    </Flex>
  );
}
