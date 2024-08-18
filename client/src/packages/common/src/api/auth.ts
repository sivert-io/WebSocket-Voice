// The authentication server the client will query to.
// Note: Gryt Authentication Server is CLOSED-SOURCE and changing this value could result in your client not being able to connect to any servers.
// In order to identify users when connecting to servers, we use Gryt Authentication as a middleware to verify that the user is who they claim to be.
// Without Gryt Authentication, we cannot verify users. Alternatively every server would have to handle their own authentication, which would result
// in a worse user experience. This means you'd have to sign up for an account on each server you join, entrusting your sign in details (such as email
// and password) to every server host you are registered with.
const grytAuthHost = "https://dev.auth.sivert.io";

import axios, { AxiosInstance, AxiosResponse } from "axios";
import { LoginData, RegisterData } from "@/common";

interface RefreshData {
  refreshToken: string;
}

export class AuthApi {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = grytAuthHost;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  public async register(data: RegisterData): Promise<AxiosResponse<any>> {
    const response = await this.axiosInstance.post("/auth/register", data);
    return response;
  }

  public async login(data: LoginData): Promise<AxiosResponse<any>> {
    const response = await this.axiosInstance.post("/auth/login", data);
    return response;
  }

  public async refresh(data: RefreshData): Promise<AxiosResponse<any>> {
    const response = await this.axiosInstance.post("/refresh", data);
    return response;
  }
}
