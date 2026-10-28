import type { Messages } from ".";

// The Chinese text of the public interface.
export const zh: Messages = {
  languageSwitch: "语言",
  search: {
    label: "搜索文章",
    submit: "搜索",
    title: "搜索",
    enterWord: "请输入要搜索的词。",
    containing: (query) => `包含“${query}”的文章`,
    noMatch: (query) => `没有包含“${query}”的文章。`,
  },
  home: { title: "文章", empty: "还没有文章。" },
  allPosts: "全部文章",
  translationIn: { zh: "另有中文版：", en: "另有英文版：" },
  tags: { label: "标签", tagged: (tag) => `标签为“${tag}”的文章` },
  pager: {
    label: "分页",
    newer: "较新",
    older: "较旧",
    current: (page, count) => `第 ${page} / ${count} 页`,
  },
  notFound: {
    title: "未找到",
    heading: "页面不存在",
    body: "这个页面不存在，或已不再公开。",
  },
  comments: {
    list: (count) => `评论（${count}）`,
    title: "发表评论",
    note: "无需注册。评论经作者审核后显示。",
    nickname: "昵称",
    message: "留言",
    trap: "此栏请留空",
    submit: "发送评论",
    sent: "谢谢！你的评论正在等待审核，作者通过后即会显示。",
    invalidForm: "表单无效，请刷新页面。",
    refusals: {
      automated: () => "这条评论看起来是自动发送的，未被提交。",
      nicknameMissing: () => "请输入昵称。",
      nicknameTooLong: (limits) =>
        `昵称请不要超过 ${limits.nicknameMaxLength.toLocaleString("zh")} 个字符。`,
      messageMissing: () => "请输入留言。",
      messageTooLong: (limits) =>
        `留言请不要超过 ${limits.messageMaxLength.toLocaleString("zh")} 个字符。`,
      closed: () => "这篇文章不接受评论。",
      rateLimited: (limits) =>
        `你的评论发送得太频繁了，请 ${limits.windowMinutes} 分钟后再试。`,
    },
  },
};
