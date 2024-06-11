/**
 * 生产环境 webpack 配置
 */
const pathBuilder = require('path');
// html 模版编译插件
const HtmlWebpackPlugin = require('html-webpack-plugin');
// 基本 webpack 配置
const generateBaseConfig = require('./webpack.base.js');
const antvSelect = require('./plugins/antv-selector.js');
const _ = require('lodash');
const {CleanWebpackPlugin} = require("clean-webpack-plugin");

// 编译生产环境使用的html模版
const buildTemplateHtmlPath = pathBuilder.resolve('template.index.html');
process.env.NODE_ENV = 'production';
module.exports = function (env,mode) {
  const { output: out = '.' } = env;
  const outputParts = out.split('/');
  const config = generateBaseConfig(env, mode||'production');
  const antv = antvSelect(pathBuilder.join(__dirname,'..','..'));
  return {
    ...config,
    entry: {
      bundle: pathBuilder.resolve('src', 'index.ts')
    },
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
        // 使用 agent-reducer/es 进行打包体积优化
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
        {
          test: /\.js$/,
          include: /(node_modules\/typing-qs\/es)/,
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
    plugins: config.plugins.concat([
      new HtmlWebpackPlugin({
        plugin: 'html',
        filename: pathBuilder.resolve(...outputParts, 'index.html'),
        template: buildTemplateHtmlPath,
        inject: true
      }),
      new CleanWebpackPlugin()
    ])
  };
};
