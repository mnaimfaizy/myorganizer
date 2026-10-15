/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}

declare global {
  interface Window {
    __MYORGANIZER_RUNTIME__?: {
      API_BASE_URL?: string;
    };

    MYORGANIZER_RUNTIME?: {
      API_BASE_URL?: string;
    };
  }
}

export {};
