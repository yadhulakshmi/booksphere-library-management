export interface DataEnvironment {
  readonly production: boolean;
  readonly dataMode: 'standalone' | 'api';
  readonly apiBaseUrl: string;
}
