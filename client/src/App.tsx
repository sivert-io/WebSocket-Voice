import { useAccount } from "@/common";
import { SignUpModal } from "@/signUp";
import { MainApp } from "./components/mainApp";
import { AddNewServer, Nickname, Settings } from "@/settings";
import { Welcome } from "./components/welcome";

export function App() {
  const { isSignedIn } = useAccount();

  if (isSignedIn)
    return (
      <>
        <MainApp />
        <Settings />
        <Nickname />
        <Welcome />
        <AddNewServer />
      </>
    );
  else return <SignUpModal />;
}
