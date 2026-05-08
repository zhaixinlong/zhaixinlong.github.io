import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '学海无涯',
  description: 'Personal technical knowledge base',
  base: '/',
  lang: 'zh-CN',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '图书', link: '/md/books/programing' },
      { text: '笔记', link: '/md/articles/' },
      { text: '算法', link: '/md/algorithm/' },
    ],

    sidebar: [
      {
        text: '图书',
        items: [
          { text: '编程图书', link: '/md/books/programing' },
        ]
      },
      {
        text: 'Golang',
        items: [
          { text: '笔记', link: '/md/articles/golang/笔记' },
          { text: '单元测试', link: '/md/articles/golang/单元测试' },
          { text: 'Gorm', link: '/md/articles/golang/Gorm' },
        ]
      },
      {
        text: '数据库',
        items: [
          { text: 'Postgres', link: '/md/articles/postgres/笔记' },
          { text: 'MySQL', link: '/md/articles/mysql/sql-mode' },
          { text: 'MongoDB', link: '/md/articles/mongodb/事故-节点重建' },
        ]
      },
      {
        text: '工具',
        items: [
          { text: 'Kong', link: '/md/articles/kong/安装' },
          { text: 'Git Stash', link: '/md/articles/git/stash' },
          { text: 'Python', link: '/md/articles/python/notes' },
        ]
      },
      {
        text: '算法',
        items: [
          { text: '链表合并', link: '/md/algorithm/链表合并' },
          { text: '递归求和', link: '/md/algorithm/递归求和' },
          { text: '斐波那契数列', link: '/md/algorithm/斐波那契数列' },
          { text: '数组去重', link: '/md/algorithm/有序数组-原地删除重复项' },
        ]
      },
      {
        text: '加密',
        items: [
          { text: 'AES-Golang', link: '/md/encrypt/aes-golang' },
          { text: 'AES-NodeJs', link: '/md/encrypt/aes-nodejs' },
          { text: 'DES-EDE3', link: '/md/encrypt/des-ede3-nodejs' },
        ]
      },
      {
        text: '效率',
        items: [
          { text: 'Mac技巧', link: '/md/efficiency/mac' },
          { text: '搜索技巧', link: '/md/efficiency/search' },
          { text: '知识管理', link: '/md/efficiency/knowledge' },
          { text: '关于阅读', link: '/md/efficiency/read' },
          { text: '密码管理', link: '/md/efficiency/password' },
          { text: '编程效率', link: '/md/efficiency/programing' },
          { text: '工具推荐', link: '/md/efficiency/tools' },
        ]
      },
      {
        text: '随笔',
        items: [
          { text: '那人那山那狗', link: '/md/sentiment/那人那山那狗' },
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zhaixinlong/zhaixinlong.github.io' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/zhaixinlong/zhaixinlong.github.io/edit/master/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © zhaixinlong'
    },

    outline: {
      level: [2, 3],
      label: '页面导航'
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '返回顶部',
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    }
  },

  markdown: {
    lineNumbers: true,
  }
})
