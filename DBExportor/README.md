# 知乎疯牛病 --- 数据库工具

基于Asp.net core 2.0的[知乎疯牛病插件](../)数据库导入导出工具。

## 使用说明
自行编译，运行即可。

可输入参数`-dXXXX`, 其中XXXX为导入导出时搜索的文件目录，默认为当前运行目录。强烈建议指定。
Visual Studio中调试运行时，此参数默认指向`E:\Backups`（Windows开发环境默认设置）。

导入导出文件名为`ZhiHuExtDB-XXX.json`，其中XXX为时间标识，用于指定导入导出的目标文件。

## 功能说明

 * 配合插件的导出功能，通过大数据库进行分段传输以规避崩溃风险，并对数据进行整合导出（既然是大数据库了，耗时自然很长）。
 * 提供数据导入功能，通过大数据库进行分段传输以规避崩溃风险。但是大数据库的导入比导出还要慢，能不用就别用吧（血泪的教训）。
 * 提供实验性的RemoteDB功能。在IndexedDB性能不足以完成部分快速查询时，本工具可以利用优化的内存数据库（呸，其实就是几个Dictionary和Lookup）来提升查询效率。
   可以在部分页面通过加入remotedb=XXX参数进行连接。其中XXX为时间标识。 

## License

知乎疯牛病 (including its component) is licensed under the [MIT license](../License.txt).