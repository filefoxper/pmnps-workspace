/**
 * 生产环境 webpack 配置
 */
const pathBuilder = require('path');
// html 模版编译插件
const HtmlWebpackPlugin = require('html-webpack-plugin');
// 基本 webpack 配置
const generateBaseConfig = require('./webpack.base.js');
const _ = require('lodash');
const {CleanWebpackPlugin} = require("clean-webpack-plugin");

// 编译生产环境使用的html模版
const buildTemplateHtmlPath = pathBuilder.resolve('template.index.html');
process.env.NODE_ENV = 'production';
module.exports = function (env,mode) {
  const { output: out = './dist' } = env;
  const outputParts = out.split('/');
  const config = generateBaseConfig(env, mode||'production');
  return {
    ...config,
    entry: {
      bundle: pathBuilder.resolve('src', 'index.tsx')
    },
    resolve: {
      ...config.resolve,
    },
    module: {
      rules: config.module.rules
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
