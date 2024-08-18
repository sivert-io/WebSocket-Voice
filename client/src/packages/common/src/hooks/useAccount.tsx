import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { Account, LoginData, RegisterData } from "@/common";
import { AuthApi } from "../api/auth";
import { jwtDecode } from "jwt-decode";

function accountHook(): Account {
  const [isSignedIn, setIsSignedIn] = useState<boolean | undefined>(undefined);
  const [token, setToken] = useState<undefined | string | null>(
    localStorage.getItem("token")
  );

  const api = new AuthApi();

  async function register(data: RegisterData) {
    // send register request to API
    const answer = await api.register(data);
    console.log(answer.data);
    return answer.data;
  }

  async function login(data: LoginData) {
    // send login request to API
    const answer = await api.login(data);
    console.log(answer.data);
    setToken(answer.data.token);
    localStorage.setItem("token", answer.data.token);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setIsSignedIn(false);
  }

  // Read localstorage/cookie and check if any token exist. Then check if token is valid
  useEffect(() => {
    if (token) {
      console.log(token);

      // check token now
      const decodedJwt = jwtDecode(token);
      console.log(decodedJwt);

      if (decodedJwt.exp && decodedJwt.exp > Date.now() / 1000) {
        setIsSignedIn(true);
      } else {
        console.log("token invalid");

        logout();
      }
    }
  }, [token]);

  return {
    isSignedIn,
    login,
    register,
    logout,
  };
}

const init: Account = {
  isSignedIn: undefined,
  login: async () => {},
  register: async () => false,
  logout: () => {},
};

export const useAccount = singletonHook(init, accountHook);
