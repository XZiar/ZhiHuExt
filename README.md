# 知乎疯牛病

想要解决知乎spam信息的chrome插件（兼爬虫）

## 安装方法

强烈建议安装前看完下面的功能说明，这有可能是你唯一能够获得操作说明的地方！

1. 直接clone/下载本repo到本地，在chrome扩展页面开启开发者模式，加载“已解压的扩展程序”。
2. 到[Release处](https://github.com/XZiar/ZhiHuExt/releases/latest)下载打包好的crx插件。

更新日志[在此](./ChangeLog.md)

## 注意

由于作者太懒，尚未动手写使用说明。
 
 * 插件开发环境为最新稳定版chrome，不保证能在旧版chrome或其他Chromium核心浏览器上正常使用。插件要求chrome版本最低为58。

 * **所有标注着“广告”的按钮都是一键举报（以垃圾广告的理由）**，无法撤销，点击前请三思。

 * Chrome的IndexedDB特性决定了，频繁更新/写入数据库会有大量写入放大。通俗地说，大量使用插件捕获数据会带来大量磁盘写入，SSD用户请注意。

 * 插件本身不会主动上传任何数据，但由于其无差别地捕获所有数据，本地数据库内的信息仍可能存在隐私风险，分享数据库请谨慎。
 
 * 已知bug：在`用户信息页面`/`问题回答页面`翻页后，按钮不更新，需要手动刷新页面，不然按钮功能会错乱。

 * 插件所利用的API均为个人研究所得，请勿用于其他目的，知乎保留（我也说不清是什么的）权力。
 
 * 插件利用了一些很hacky的手段收集数据，可能存在隐私风险。且知乎前后端的变更都容易影响插件稳定性。

## 部分功能说明

 * 插件没有提示信息，但每次对数据库的写入都会在工具栏按钮上显示蓝色下标。

 * 插件运行后，“反作弊限制”的用户界面会被解除限制，但“该账号已停用”的用户无能为力。

 * 将链接/头像拖到页面右下角的`垃圾桶`按钮即为人工标注负面用户/问题/回答/文章。通过插件举报的用户/问题/回答/文章也会被自动标注入数据库。

 * 将页面右下角橙色`知`按钮拖放到问题描述区域/回答内容区域即可导出问题/回答（前100回答）的备份。回答的备份默认捕获此回答包含的图片。问题的备份则不，按住ctrl拖放则会捕获问题下回答包含的图片。
   捕获的图片以base64存在json内，可以通过[这个python工具](./ExtraTools/ExtractImg.py)导出(python3.0限定)。

 * `分析`功能用于捕获回答/文章的点赞记录（不带时间戳），并对本地数据库标注情况进行分析。直接点击会向服务器请求最近（最多2w条）点赞记录，ctrl+点击会请求最早（最多2w条）点赞记录，shift+点击会从本地数据库获取记录。
   ctrl+shift+点击会利用本地数据库数据，打开点赞列表（会卡），可用于还原销赞，并且带时间戳的点赞会根据具体时间进行排列，并显示点赞时间。

 * 分析的结果为`A(B)/C`，即C个点赞用户中B个被标记用户与A个被封禁用户。AB不重叠，优先计入A。检测后按钮颜色随“正常”用户比例变化。

 * `爬`按钮即爬取用户动态，点击将爬取最近7页，ctrl+点击将爬取最近70页，shift+点击会爬取最近270页。爬取的记录限制在2017年后。此功能容易被反爬虫限制。

 * 在用户个人信息页面，将`爬`按钮拖放到关注用户数上，会爬取该用户的关注者或被关注者。这是目前唯一利用了关注信息的地方/渠道。

 * `时间图`/`点赞人分析`需要带时间戳的点赞记录支持。目前这一数据只能通过爬用户动态获得，即在点赞列表点击“检测”，在用户界面点击“爬”，或通过自动爬虫爬取。
 
 * `启发`需要回答/问题的点赞记录，不需要时间戳，可以通过点击`分析`获得。

 * `自动爬虫`功能比较混乱，且具体等待时间参数需要人工尝试，不然容易被反爬虫限制。
   多机爬取可勾选“单独记录数据”，数据将不会被记录到本地数据库，可通过导入/导出按钮导入/导出数据。数据冗余大，传输时建议压缩一下。

 * 本地数据库过大时，导入导出页面的`快速导入`/`快速导出`功能将不可靠（容易导致插件崩溃），需要用[自带工具](./DBExportor/)进行导出。
   工具基于Asp.net core 2.1，请自行准备编译环境。

## Dependency
 * [Dexie.js](http://dexie.org/) A Minimalistic Wrapper for IndexedDB [Apache License 2.0](./License/Dexie.license)
 * [jQuery](https://jquery.com/) jQuery JavaScript Library [MIT License](https://jquery.org/license/)
 * [clipboard.js](https://clipboardjs.com/) Modern copy to clipboard [MIT License](https://zenorocha.mit-license.org/)
 * [DataTables](https://datatables.net/) Table plug-in for jQuery [MIT License](https://datatables.net/license/mit)
 * [echarts](http://echarts.baidu.com/) A powerful, interactive charting and visualization library for browser [BSD-3 License](./License/echarts.license)
 * [noUiSlider](https://refreshless.com/nouislider/) A lightweight JavaScript range slider library [MIT License](https://github.com/leongersen/noUiSlider/blob/master/LICENSE)
 * [css-loader](https://github.com/raphaelfabeni/css-loader) Simple loaders for your web applications using only one div and pure CSS [MIT License](https://github.com/raphaelfabeni/css-loader)
 * [3d-force-graph](https://github.com/vasturiano/3d-force-graph) 3D force-directed graph component using ThreeJS/WebGL [MIT License](https://github.com/vasturiano/3d-force-graph/blob/master/LICENSE)
 * 
## License

知乎疯牛病 (including its component) is licensed under the [MIT license](License.txt).