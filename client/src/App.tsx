import { useAccount } from "@/common";
import { AddNewServer, Nickname, Settings } from "@/settings";
import { SignUpModal } from "@/signUp";
import { DeviceSwitchModal, useServerManagement } from "@/socket";

import { LeaveServer } from "./components/leaveServer";
import { MainApp } from "./components/mainApp";
import { Welcome } from "./components/welcome";

export function App() {
  const { isSignedIn } = useAccount();
  const { showAddServer, setShowAddServer } = useServerManagement();

  if (isSignedIn)
    return (
      <>
        <MainApp />
        <Settings />
        <Nickname />
        <Welcome />
        <AddNewServer showAddServer={showAddServer} setShowAddServer={setShowAddServer} />
        <LeaveServer />
        <DeviceSwitchModal />
      </>
    );
  else return <SignUpModal />;
}
