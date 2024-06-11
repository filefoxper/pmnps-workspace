/**
 * 开发环境 webpack 配置
 */
const pathBuilder = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const WebpackBar = require('webpackbar');
// 建立在基础配置基础上
const generateBaseConfig = require('./webpack.base.js');
const antvSelect = require('./plugins/antv-selector.js');

// 被代理服务器（请求转入服务器）
const localUrl = 'http://192.168.100.12:20000';
// const localUrl = 'http://10.11.4.58:8081';
// const localUrl = 'http://10.11.5.76:8080';  // 祝捷
// const localUrl = 'http://10.11.5.163:8080'; // 虎达
// const localUrl = 'http://10.11.5.159:8080'; // 陈亮
//const localUrl = 'http://10.11.5.152:8085'; // 自远

// 开发环境 html 模版
const templateHtmlPath = pathBuilder.resolve('template.dev.index.html');
process.env.NODE_ENV = 'development';
// 开发环境配置入口
module.exports = function (env) {
  const { output = './dist' } = env;
  const config = generateBaseConfig(env, 'development');
  const outputParts = output.split('/');
  const targetPath = pathBuilder.resolve(...outputParts);
  const antv = antvSelect(pathBuilder.join(__dirname,'..','..'));
  return {
    ...config,
    externals: {},
    optimization: {
      // 开发环境舍弃 minimize 和 minimizer 压缩配置，以达到编译速度提升的效果
      splitChunks: config.optimization.splitChunks
    },
    // 使用开发环境 html 模版
    plugins: config.plugins.concat([
      new ReactRefreshPlugin(),
      new HtmlWebpackPlugin({
        plugin: 'html',
        filename: pathBuilder.resolve(...outputParts, 'index.html'),
        template: templateHtmlPath,
        inject: true
      }),
      new WebpackBar({
        color: 'green', // 默认green，进度条颜色支持HEX
        basic: false, // 默认true，启用一个简单的日志报告器
        profile: false // 默认false，启用探查器。
      })
    ]),
    resolve: {
      ...config.resolve,
      // 使用 agent-reducer/es 进行打包体积优化
      alias: {
        'typing-qs': 'typing-qs/es',
        'agent-reducer': 'agent-reducer/es',
        'use-agent-reducer': 'use-agent-reducer/es',
        ...antv,
        bizcharts: 'bizcharts/es'
      }
    },
    module: {
      rules: config.module.rules.concat([
        {
          test: /\.js$|\.ts$|\.tsx$/,
          include:
            /(node_modules\/agent-reducer\/es|node_modules\/use-agent-reducer\/es)/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true
              }
            }
          ]
        },
        // 通过 include 指定需要欺骗 webpack 为无副作用的 bizcharts/es/index.js
        {
          test: /\.js$/,
          include: /(node_modules\/bizcharts\/es\/index.js)/,
          sideEffects: false,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true
              }
            }
          ]
        },
        // 通过 include 指定除去 index.js 外需要优化编译的 bizcharts 项
        {
          test: /\.js$/,
          include: /(node_modules\/bizcharts\/es)/,
          exclude: /(node_modules\/bizcharts\/es\/index.js)/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true
              }
            }
          ]
        }
      ])
    },
    // 配置开发虚拟服务
    devServer: {
      // 刷新时，让当前域名下的url访问 index.html
      historyApiFallback: true,
      // 热编译
      hot: true,
      // 不检查访问机器IP，即允许其他机器访问开发虚拟服务
      disableHostCheck: true,
      // 服务器主目录配置
      contentBase: targetPath,
      // 虚拟服务器IP
      host: '0.0.0.0',
      serveIndex: false,
      // 虚拟服务器端口
      port: 8080,
      // 指定代理url
      proxy: {
        '/api/*': {
          target: localUrl,
          secure: false
        },
        '/public/*': {
          target: localUrl,
          secure: false
        },
        '/client-api/*': {
          target: 'http://192.168.100.12:8090',
          changeOrigin: true
        }
      }
    }
  };
};
