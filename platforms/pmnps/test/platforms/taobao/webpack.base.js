/**
 *  webpack 基础配置
 */

// 解决真实文件路径
const pathBuilder = require('path');
// webpack 压缩插件
const TerserPlugin = require('terser-webpack-plugin');
// lodash 优化插件，在我们选择 externals 外联 lodash 库之后，这个插件就没毛软用了
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
// ts 配置文件读取插件
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
// webpack 主要插件入口
const webpack = require('webpack');
// 环境变量配置
const processEnv = require('./process.env.js');

/**
 *  选择 function 配置模式
 * @param env webpack-cli 带入环境变量，如：--env.output - 输出路径，在配置方法第一个入参 env.output 中
 * @param mode 外部传参：'development' | 'production'
 * @return webpack config webpack 编译配置对象
 */
module.exports = function (env, mode) {
  const { custom, output = './dist' } = env;
  // 因为真实运行操作系统的不同，目录分割有可能不同，所以需要将配置中的输出路径解开成数组，然后使用 pathBuilder.resolve 去重组
  const outputParts = output.split('/');
  return {
    // 编译模式：'development' | 'production'，webpack 会根据这个模式对编译大小和速度进行反向优化
    mode: mode === 'development' ? mode : 'production',
    // 开发者工具，因为普遍较慢，这里选择关闭
    devtool: mode !== 'production' ? 'source-map' : undefined,
    // 编译缓存，可加速编译
    cache: true,
    // 编译结果输出方式
    output: {
      crossOriginLoading: 'anonymous',
      // 输出目标目录
      path: pathBuilder.resolve(...outputParts),
      // 输出主包文件名，对于 entry 中配置的 key
      filename: '[name].[chunkhash].js'
    },
    optimization: {
      // 抹除错误警告
      emitOnErrors: true,
      usedExports: true,
      // 采用最小化
      minimize: true,
      minimizer: [
        // 使用压缩插件
        new TerserPlugin({
          // 禁止插件抽取 licence 文件
          extractComments: false
        })
      ],
      // 分包优化
      splitChunks: {
        // 全局优化
        chunks: 'all',
        // 建立全局缓存模块分组
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/](react-router|react-router-dom|moment|agent-reducer|use-agent-reducer|antd)[\\/]/,
            name: 'commons',
            reuseExistingChunk: true,
            chunks: 'all'
          },
          bizcharts: {
            test: /[\\/]node_modules[\\/](bizcharts|@antv)[\\/]/,
            name: 'bizcharts',
            reuseExistingChunk: true,
            chunks: 'all'
          },
        }
      }
    },
    // 指定支持编译的文件，以及路径简化识别配置
    resolve: {
      // 支持编译的入口文件
      // 为什么没有css？
      // 因为 css 被js,jsx,ts,tsx文件引用，
      // 通过 css-loader->style-loader 提取加工，这些 css 文件内容已经生成到 js 代码中了。
      // 为什么有js,jsx,ts,tsx文件?
      // 因为他们才是真正的编译入口文件，在webpack的主导下，babel只能通过babel-loader去加载编译webpack提交的js等入口文件。
      // 所以 .json .txt 其实没必要加进来，它们也有自己相应的loader
      extensions: ['.js', '.ts', '.tsx', '.json', 'txt'],
      // 路径简化识别插件
      plugins: [
        // typescript 路径识别插件，该插件会通过 tsconfig 配置生成简化的别名
        // 如 tsconfig 中 paths:{"@/*": ["src/*"]}
        // 通过该插件，代码中可使用 import {...} from '@/components/....' 这种形式。
        // 这种形式代表了 import {...} from '${root}/src/components/....'
        new TsconfigPathsPlugin({ configFile: './tsconfig.json' })
      ]
    },
    // 模块系统配置
    module: {
      // 文件编译规则
      rules: [
        {
          // 匹配文件名
          test: /\.js$|\.ts$|\.tsx$/,
          // 排除匹配目录
          exclude: /(node_modules|bower_components)/,
          // 使用编译接驳器 babel-loader，
          // babel-loader 会自动寻找 .babelrc，babel.config.js等文件，将配置信息merge成 babel 解析配置信息
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
          // 图片处理
          test: /\.(gif|png|jpg|jpeg|otf)$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'url-loader',
            options: {
              // 超过 1024b 的文件以文件形式被转出，否则被编译成 base64 字符串嵌入js代码
              limit: 1024*6
            }
          }
        },
        {
          // less处理
          test: /\.less$/,
          exclude: /(node_modules|bower_components)/,
          use: [
            // 将 css-loader 提交的 css 内存文件放入 <style>...</style> 字符串中，写入引用的js文件
            'style-loader',
            {
              // 解析 less 提交的 css 内存文件，
              // 通过模块化的方式将css文件中的class名称编译成一个规则的hash字符串，
              // 并将这些字符串与模块化的css引用对象的key相对应，即变成该对象的值，
              // 最后将洗过的 css 内存文件提交给 style-loader
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: '[name]_[local]_[hash:base64:5]'
                }
              }
            },
            'less-loader'
          ]
        },
        // 因为该项目没有css文件，为了防止第三方库引用css产生漏洞，加层保险
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        // 目的跟上面的一样，不过是针对第三方less文件
        {
          test: /\.less$/,
          include: /(node_modules|bower_components)/,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'less-loader'
            }
          ]
        },
        // 文件处理
        {
          test: /\.(ttf|eot|woff|woff2|svg)$/,
          use: ['file-loader']
        }
      ]
    },
    plugins: [
      // 定义环境变量，环境变量可在代码中使用，webpack会根据环境变量忽略不符合当前编译环境的代码
      new webpack.DefinePlugin({
        'process.env': processEnv(mode, custom)
      })
    ]
  };
};
