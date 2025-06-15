# Auto_Course_Eval

适用于本校的信息管理系统的教学评价自动打分脚本。

## 配置

1. **填写学号与密码**

在`evaluate.js`文件顶部，找到如下内容，替换为你自己的学号和密码：

```js
const LOGIN_CREDENTIALS = {
    username: 'Your_Student_ID', // <--- 学号
    password: 'Your_Password'    // <--- 密码
};
```

2. **填写学校信息管理系统URL**

同样在`evaluate.js`文件中，找到如下代码，将 URL 替换为你学校的教学评价系统登录页地址：

```js
await page.goto('http://class.****.edu.cn:2333/FuckYou/');
```

## 使用方法

1. 安装依赖（需先安装 [Node.js](https://nodejs.org/)）：

```sh
npm install puppeteer
```

2. 运行脚本：

```sh
node evaluate.js
```

3. 按照命令行提示，手动进入「教学评价」界面并同意所有须知，然后回到命令行按下回车，脚本会自动完成后续评价。

---

**注意事项：**
- 本脚本仅供学习和个人使用，请勿用于任何违反学校规定的用途。
- 若遇到页面结构变动，请根据实际页面调整选择器，虽然懒狗学校一般不会动这坨百年大粪就是了
