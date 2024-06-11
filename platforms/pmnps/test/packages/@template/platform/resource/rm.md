# generator-dc

## 安装

全局安装 [yeoman](https://yeoman.io) 脚手架工具：

```
npm install -g yo
```

generator-dc 在项目内已经安装好了，如果需要可以安装

```
npm install -i generator-dc
```

## 使用

#### yo dc

主命令，用于生成`webpack+react+react-router+agent-reducer+use-agent-reducer`项目。
在当前项目主目录下运行：

```
/xx/xx > yo dc
```

#### yo dc:route

生成路由命令（只提供目录名，起点 project/src/page）:

```
// 新建路由
/xx/xx > yo dc:route /path
// 新建到子路由（如父路由不存在，父路由也会新建）
/xx/xx > yo dc:route /path/child_path/sub_child_path
// 新建到子路由 并标记当前子路由为 index redirect 路由，即一进父路由就默认跳到指定的子路由
/xx/xx > yo dc:route /path/child_path --redirect
```

#### yo dc:agent

生成 agent 模型（只提供目录名，起点为 project/src）

```
// 新建 agent 模型
/xx/xx > yo dc:agent /path
// 新建 agent 模型，并指定模型名字
/xx/xx > yo dc:agent /path --name name
```

#### yo dc:test

生成测试代码（提供待测完整文件路径或目录名，起点为 project/src）

```
// 按src目录下的待测文件路径来写 path，在test目录下会生成相应路径测试文件
/xx/xx > yo dc:test /path/xxx.ts
// 按src目录下的待测目录路径来写 path，在test目录下会生成相应路径测试目录及内部测试文件
/xx/xx > yo dc:test /path
```
