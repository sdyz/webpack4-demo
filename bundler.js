// bundler.js
const fs = require("fs");
const path = require("path");
const paser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");
const config = require("./webpack.config");

const moduleAnalyser = (filename) => {
  // step1 通过 nodejs fs 模块，获取文件内容
  const content = fs.readFileSync(filename, "utf-8");

  // step2 paser.parse 将 JS代码转化成抽象语法树 AST (js对象)
  const ast = paser.parse(content, {
    sourceType: "module",
  });

  // step3 存放依赖对象
  const dependencies = {};
  // traverse 方法可以快速找到import节点
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename); // './src'
      const newFile = "./" + path.join(dirname, node.source.value); // ./src/message.js
      dependencies[node.source.value] = newFile;
    },
  });

  // step4 将AST编译成浏览器可以运行的代码
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });

  // 将模块分析结果返回
  return {
    filename,
    dependencies,
    code,
  };
};

// step5 对所有模块进行分析，递归分析依赖结果
const getDependenciesGragh = (entry) => {
  // 获取入口文件分析结果，存入一个数组
  const entryModule = moduleAnalyser(entry); // { filename, dependencies, code}
  const graphArray = [entryModule];
  // 递归开始
  for (let i = 0; i < graphArray.length; i++) {
    const { dependencies } = graphArray[i]; //  { './message.js': './src/message.js' }
    if (dependencies) {
      for (let j in dependencies) {
        graphArray.push(moduleAnalyser(dependencies[j]));
        // 此时graphArray长度+1，继续循环遍历，直到把所有依赖一层层push进graghArray，递归结束
      }
    }
  }
  // 格式转化
  const dependencyGraph = {};
  graphArray.forEach((item) => {
    dependencyGraph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code,
    };
  });
  return dependencyGraph;
};

// step6 通过 dependencyGraph 生成可以在浏览器运行的代码
const generateCode = (entry) => {
  const graph = JSON.stringify(getDependenciesGragh(entry));
  return `
  (function(graph){
    function require(module){
      function localRequire(relativePath){
        return require(graph[module].dependencies[relativePath])
      }
      var exports = {};
      (function(require,exports,code){
        eval(code)
      })(localRequire,exports,graph[module].code)
      return exports;
    }
    require('${entry}')
  })(${graph});
  `;
};

const code = generateCode("./src/index.js");
console.log("code: ", code);

// step7 输出文件到 dist 目录下
const filePath = path.join(config.output.path, config.output.filename);
fs.writeFileSync(filePath, code, "utf-8");
