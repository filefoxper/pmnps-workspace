const IS_DEV = process.env.NODE_ENV === 'development';

const IS_WINDOWS = process.platform === 'win32';

export const env = {
  isDevelopment: IS_DEV,
  platform: IS_WINDOWS ? 'windows' : 'others'
};
