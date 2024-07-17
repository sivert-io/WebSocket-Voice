export type LoginData = {
  email: string;
  password: string;
};

export type RegisterData = {
  email: string;
  password: string;
  confirm_password: string;
};

export interface Account {
  isSignedIn?: boolean;
  register: (data: any) => Promise<boolean>;
  login: (data: any) => any;
  logout: () => any;
}
