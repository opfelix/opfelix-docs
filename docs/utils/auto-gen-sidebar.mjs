// utils/auto-gen-sidebar.mjs
import path from "node:path";
import fs from "node:fs";

// 文档根目录固定为 docs/
const DIR_PATH = path.resolve(process.cwd(), "docs");

// 白名单：过滤非文章目录/文件
const WHITE_LIST = [
  "index.md",
  ".vitepress",
  "node_modules",
  ".idea",
  "assets",
  "img",
  "0.目录.md",
];

// 判断是否是文件夹
const isDirectory = (p) => fs.lstatSync(p).isDirectory();

// 数组差集
const intersections = (arr1, arr2) => arr1.filter((item) => !arr2.includes(item));

// 🔢 按数字前缀排序（01、02 优先）
const sortByNumberPrefix = (arr) => {
  return arr.sort((a, b) => {
    const numA = parseInt(a.name.match(/^\d+/)?.[0] || "9999");
    const numB = parseInt(b.name.match(/^\d+/)?.[0] || "9999");
    return numA - numB;
  });
};

/**
 * 递归生成侧边栏（支持三级、默认折叠、数字排序）
 * @param {string[]} params - 当前目录下的文件/文件夹名
 * @param {string} dirPath - 当前目录绝对路径
 * @param {string} pathname - 路由前缀（如 /Linux）
 */
function getList(params, dirPath, pathname) {
  const res = [];

  // 先排序：数字前缀优先
  const sorted = sortByNumberPrefix(params.map((name) => ({ name })));

  for (const { name } of sorted) {
    const fullPath = path.join(dirPath, name);

    if (isDirectory(fullPath)) {
      // 子目录：递归 + 默认折叠
      const children = fs.readdirSync(fullPath);
      res.push({
        text: name.replace(/^\d+[._-]?/, ""), // 去掉开头数字
        collapsible: true,
        collapsed: true, // 🔽 默认折叠
        items: getList(children, fullPath, `${pathname}/${name}`),
      });
    } else {
      // 只处理 md 文件
      if (!name.endsWith(".md")) continue;
      const pageName = name.replace(/\.md$/, "");
      res.push({
        text: pageName.replace(/^\d+[._-]?/, ""), // 去掉开头数字
        link: `${pathname}/${pageName}`,
      });
    }
  }

  return res;
}

/**
 * 对外：根据 pathname 生成侧边栏
 * @param {string} pathname - 路由前缀，如 "/Linux"
 */
export const set_sidebar = (pathname) => {
  const dirPath = path.join(DIR_PATH, pathname.replace(/^\//, ""));

  // 🛡️ 目录不存在直接返回空，不报错
  if (!fs.existsSync(dirPath)) {
    console.warn(`[sidebar] 目录不存在，跳过：${dirPath}`);
    return [];
  }

  const files = fs.readdirSync(dirPath);
  const items = intersections(files, WHITE_LIST);

  return getList(items, dirPath, pathname);
};