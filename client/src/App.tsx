import { useAccount } from "@/common";
import { SignUpModal } from "@/signUp";
import { MainApp } from "./components/mainApp";
import { AddNewServer, Nickname, Settings } from "@/settings";
import { Welcome } from "./components/welcome";
import { LeaveServer } from "./components/leaveServer";

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
        <LeaveServer />
      </>
    );
  else return <SignUpModal />;
}
