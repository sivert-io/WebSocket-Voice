import { useAccount } from "@/common";
import { SignUpModal } from "@/signUp";
import { MainApp } from "./components/mainApp";

export function App() {
  const { isSignedIn } = useAccount();

  if (isSignedIn) return <MainApp />;
  else return <SignUpModal />;
}
