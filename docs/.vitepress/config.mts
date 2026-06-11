import { defineConfig } from 'vitepress'
import { set_sidebar } from "../utils/auto-gen-sidebar.mjs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lastUpdated: true,
  base: "/",
  title: "Opfelix",
  head: [['link', { rel: 'icon', href: '../../icon/小猫抓.ico' }]],
  description: "Opfelix",

  themeConfig: {
    docFooter: {
      prev: false,
      next: false
    },
    outlineTitle: "目录",
    outline: [2,6],
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主站', link: 'https://opfelix.com' },     
      {
        text: 'Linux',
        items: [
          { text: '文件系统操作', link: '/Linux/1.文件系统操作.md' },
          { text: '用户组及权限', link: '/Linux/2.用户组及权限.md' },
        ]
      },
      {
        text: 'CloudNative',
        items: [
          { text: 'k8s', link: '/CloudNative/k8s/k8s.md' },
        ]
      },
      { text: '博客', link: 'https://www.cnblogs.com/opfelix' },
      // { text: '关于', link: 'https://opfelix.com/about.html' }
    ],
    // sidebar: { 
    //   "/Linux/": set_sidebar("/Linux/"),
    //   "/CloudNative/k8s/": set_sidebar("CloudNative/k8s/")
    // },

    sidebar: false, // 关闭侧边栏
    aside: "left", // 设置右侧侧边栏在左侧显示

    socialLinks: [
      { icon: 'github', link: 'https://github.com/opfelix' }
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: { // 如果你想翻译默认语言，请将此处设为 `root`
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索'
              },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '输入',
                  navigateText: '导航',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          }
        }
      }
    }
  }
})
