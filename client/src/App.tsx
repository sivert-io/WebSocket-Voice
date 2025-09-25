import { useAccount } from "@/common";
import { AddNewServer, Nickname, Settings, useSettings } from "@/settings";
import { SignUpModal } from "@/signUp";
import { DeviceSwitchModal, useServerManagement } from "@/socket";

import { DebugOverlay } from "./components/debugOverlay";
import { LeaveServer } from "./components/leaveServer";
import { MainApp } from "./components/mainApp";
import { Welcome } from "./components/welcome";

export function App() {
  const { isSignedIn } = useAccount();
  const { showAddServer, setShowAddServer } = useServerManagement();
  const { showDebugOverlay } = useSettings();

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
        <DebugOverlay isVisible={showDebugOverlay} />
      </>
    );
  else return <SignUpModal />;
}
