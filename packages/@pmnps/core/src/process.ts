const IS_DEV = process.env.NODE_ENV === 'development';

const IS_WINDOWS = process.platform === 'win32';

export {
    IS_DEV,
    IS_WINDOWS
}
