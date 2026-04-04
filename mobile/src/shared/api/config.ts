import Constants from 'expo-constants';

type ExpoConstantsLike = typeof Constants & {
  expoGoConfig?: {
    hostUri?: string;
  };
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string;
      };
    };
  };
};

const constants = Constants as ExpoConstantsLike;

const normalizeHost = (value?: string | null) => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
};

const detectExpoHost = () => {
  const candidates = [
    process.env.EXPO_PUBLIC_DEV_HOST,
    Constants.expoConfig?.hostUri,
    constants.expoGoConfig?.hostUri,
    constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.linkingUri,
  ];

  for (const candidate of candidates) {
    const host = normalizeHost(candidate);
    if (host) return host;
  }

  return null;
};

const expoHost = detectExpoHost();
const fallbackApiUrl = expoHost ? `http://${expoHost}:3000/api` : 'http://10.0.2.2:3000/api';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  fallbackApiUrl;

if (__DEV__) {
  console.log('[api-config] API_URL =', API_URL);
}
