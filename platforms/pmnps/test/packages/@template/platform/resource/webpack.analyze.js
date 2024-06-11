/**
 * 项目包大小及组成分析环境
 */

// webpack 包大小及组成分析插件
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
// 依赖生产环境配置
const generateBuildConfig = require('./webpack.build.js');
const WebpackBar = require("webpackbar");

module.exports = function (env) {
  const config = generateBuildConfig(env);
  return {
    ...config,
    plugins: config.plugins.concat([
      // 添加包大小及组成分析插件
      new BundleAnalyzerPlugin(),
      new WebpackBar({
        color: "green",  // 默认green，进度条颜色支持HEX
        basic: false,   // 默认true，启用一个简单的日志报告器
        profile:false,  // 默认false，启用探查器。
      })
    ])
  };
};
