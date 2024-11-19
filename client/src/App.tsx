import { useAccount } from "@/common";
import { SignUpModal } from "@/signUp";
import { MainApp } from "./components/mainApp";
import { Nickname, Settings } from "@/settings";

export function App() {
  const { isSignedIn } = useAccount();

  if (isSignedIn)
    return (
      <>
        <MainApp />
        <Settings />
        <Nickname />
      </>
    );
  else return <SignUpModal />;
}
