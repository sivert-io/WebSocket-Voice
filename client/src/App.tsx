import { useAccount } from "@/common";
import { AddNewServer, Nickname, Settings } from "@/settings";
import { SignUpModal } from "@/signUp";

import { LeaveServer } from "./components/leaveServer";
import { MainApp } from "./components/mainApp";
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
        <LeaveServer />
      </>
    );
  else return <SignUpModal />;
}
