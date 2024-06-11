module.exports = api => {
  const defaultPlugins = [
    ['@babel/plugin-transform-runtime'],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    [
      'import',
      {
        libraryName: 'antd',
        libraryDirectory: 'es',
        style: 'css' // `style: true` 会加载 less 文件
      }
    ]
  ];
  const env = api.env();
  return env === 'development'
    ? {
        plugins: ['react-refresh/babel',...defaultPlugins,],
        presets: [
          [
            '@babel/preset-env',
            {
              modules: false,
              targets: {
                chrome: '63'
              },
              useBuiltIns: 'usage',
              corejs: { version: 3, proposals: true }
            }
          ],
          [
            '@babel/preset-react',
            {
              development: true,
            }
          ],
          '@babel/preset-typescript'
        ]
      }
    : env === 'test'?{}:{
        plugins: defaultPlugins,
        presets: [
          [
            '@babel/preset-env',
            {
              modules: false,
              targets: {
                chrome: '63'
              },
              useBuiltIns: 'usage',
              corejs: { version: 3, proposals: true }
            }
          ],
          [
            '@babel/preset-react'
          ],
          '@babel/preset-typescript'
        ]
      };
};
