import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";

import { Account, LoginData, RegisterData } from "@/common";

import { AuthApi } from "../api/auth";

function useAccountHook(): Account {
  const [isSignedIn, setIsSignedIn] = useState<boolean | undefined>(undefined);
  const [token, setToken] = useState<undefined | string | null>(
    localStorage.getItem("token")
  );

  const api = new AuthApi();

  async function register(data: RegisterData) {
    // send register request to API and return boolean + message
    try {
      const answer = await api.register(data);
      console.log(answer.data);
      return true;
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      const message = err?.response?.data?.error as string | undefined;
      // Common validation errors from API come as 400
      if (status === 400) throw new Error(message || "Please check the form fields and try again.");
      throw new Error(message || "Registration failed. Please try again.");
    }
  }

  async function login(data: LoginData) {
    // send login request to API with error guidance
    try {
      const answer = await api.login(data);
      setToken(answer.data.token);
      localStorage.setItem("token", answer.data.token);
      return undefined; // no error
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      const message = err?.response?.data?.error as string | undefined;
      if (status === 404) return message || "Account Does Not Exist.";
      if (status === 403) return message || "Email Not Verified. We just sent you a new verification email.";
      if (status === 401) return message || "Invalid Email or Password.";
      return message || "Login Failed.";
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setIsSignedIn(false);
  }

  // Read localstorage/cookie and check if any token exist. Then check if token is valid
  useEffect(() => {
    if (token) {
      // check token now
      const decodedJwt = jwtDecode(token);
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

export const useAccount = singletonHook(init, useAccountHook);
