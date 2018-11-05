"use strict"

/**@type {Map<string|number, [number, string, string, number, string, string, string|number, string, number, number, string, number][]>}*/
let wholeData;
/**@type {Map<string|number, number[]>}*/
let stackData;
/**@type {string[]}*/
let allDates = [];
/**@type {string}*/
let additionTitle, baseTitle = "点赞";
let stackX;
let limitCount = 0;

const selUser = $("#selUser")[0], selObj = $("#selObj")[0];

const saveOpt = ({ show: true, feature: { saveAsImage: { show: true, excludeComponents: ["toolbox"], pixelRatio: 2 } } });


function outputJQ()
{
    const origin = [].concat.apply([], Array.from(wholeData.values())).sort((a,b)=>a[0] - b[0]);
    let str = "name,type,value,date\n";
    let zancnt = new Map();
    for(let i=0; i < origin.length; ++i)
    {
        const arr = origin[i];
        const oid = arr[2];
        const cnt = zancnt.get(oid) | 0;
        str += `${oid},empty,${cnt},"${arr[10]}"\n`;
        zancnt.set(oid, cnt + 1);
    }
    DownloadMan.exportDownload(str, "txt", `acts#${additionTitle}#${new Date().Format("yyMMdd-hhmm")}.csv`);
}

function outputJQ2()
{
    let str = "name,type,value,date\n";
    stackX.forEach((time, idx) =>
        {
            Array.from(stackData.entries())
                .forEach(entry => 
                    {
                        if(entry[1][idx] == 0) return;
                        const auth = wholeData.get(entry[0])[0][5];
                        str += `${entry[0]},${auth},${entry[1][idx]},${time}\n`;
                    });
        });
    DownloadMan.exportDownload(str, "txt", `acts#${additionTitle}#${new Date().Format("yyMMdd-hhmm")}.csv`);
}

$(selUser).change(ev => { window.location = `/Timeline.html?uid=${ev.target.value}&only=true`; });
$(selObj).change(ev => { window.location = `/Timeline.html?ansid=${ev.target.value}&only=true`; });

$(document).on("click", "#changeonly", e =>
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();
    if (qs.only === "true")
        qs.only = "false";
    else
        qs.only = "true";
    qs.stack = false;
    window.location = "/Timeline.html?" + _toQueryString(qs);
});
$(document).on("click", "#changestack", e =>
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();
    if (qs.stack === "true")
        qs.stack = "false";
    else
        qs.stack = "true";
    window.location = "/Timeline.html?" + _toQueryString(qs);
});
$(document).on("click", "#export", e =>
{
    const head = "\uFEFF" + "点赞人,点赞目标,点赞时间,目标类型,点赞日期,当日分钟,当日计秒\n";
    const csvstr = Array.from(wholeData.entries())
        .map(entries =>
            entries[1].map(item =>
                [item[1], item[2], item[3], item[4], item[7], item[8], item[11]].join(","))
            .join("\n"))
        .join("\n");
    DownloadMan.exportDownload(head + csvstr, "txt", `acts#${additionTitle}#${new Date().Format("yyMMdd-hhmm")}.csv`);
});

let isCtrl = false, isShift = false;
document.addEventListener("keydown", ev => { isCtrl = ev.ctrlKey; isShift = ev.shiftKey; });
document.addEventListener("keyup", ev => { isCtrl = ev.ctrlKey; isShift = ev.shiftKey; });
const myChart = echarts.init(document.getElementById("graph"), null, { renderer: "canvas" });
myChart.on("click", params =>
{
    if (!isCtrl)
        return;
    if (params.componentType !== "series")
        return;
    chrome.runtime.sendMessage({ action: "openpage", target: "https://www.zhihu.com/people/" + params.data[1], isBackground: true });
});

/**
 * @param {number[]} ansids
 * @param {number[]} artids
 * @returns {Promise<[Zan[], Zan[], Answer[], Article[]]>}
 */
async function fetchAActs(ansids, artids)
{
    chgLoaderState("graphloader", "收集点赞信息");
    const [zananss, zanarts] = await Promise.all([DBfunc("getAny", "zans", "to", ansids), DBfunc("getAny", "zanarts", "to", artids)]);
    chgLoaderState("graphloader", "收集作品信息");
    const [anss, arts] = await Promise.all([DBfunc("getDetailMapOfIds", "answers", ansids, "id"), DBfunc("getDetailMapOfIds", "articles", artids, "id")]);
    return [zananss, zanarts, anss, arts];
}

!async function ()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();
    /**@type {Zan[]}*/
    let zananss = [];
    /**@type {Zan[]}*/
    let zanarts = [];
    /**@type {Zan[]}*/
    let folqsts = [];
    /**@type {{[x:number]:Answer}}*/
    let anss = {};
    /**@type {{[x:number]:Article}}*/
    let arts = {};
    /**@type {{[x:number]:Question}}*/
    let qsts = {};
    /**@type {{[x:number]:User}}*/
    let usrs = {};
    let groupidx = -1;

    if (qs.uid != null)
    {
        const uids = qs.uid.split("*");

        chgLoaderState("graphloader", "收集点赞人点赞对象");
        const pmszanans = DBfunc("getAny", "zans", "from", uids);
        const pmszanart = DBfunc("getAny", "zanarts", "from", uids);
        zananss = await pmszanans; zanarts = await pmszanart;

        additionTitle = uids.length == 1 ? "[用户]-" + uids[0] : "多个用户";
        groupidx = 1;
    }
    else if (qs.athid != null)
    {
        const athids = qs.athid.split("*");

        chgLoaderState("graphloader", "收集作者作品");
        const [ansids, artids] = await Promise.all([DBfunc("getIdByAuthor", athids, "answer"), DBfunc("getIdByAuthor", athids, "article")]);
        const aas = await fetchAActs(ansids, artids);
        zananss = aas[0], zanarts = aas[1], anss = aas[2], arts = aas[3];
        chgLoaderState("graphloader", "收集作者信息");
        usrs = await DBfunc("getDetailMapOfIds", "users", athids, "id");

        const us = Object.values(usrs);
        additionTitle = us.length == 1 ? "[作者]-" + us[0].name : "多个作者";
        groupidx = 2;
    }
    else if (qs.qid != null)
    {
        const qids = qs.qid.split("*").map(Number);

        chgLoaderState("graphloader", "收集问题回答");
        const ansids = await DBfunc("getAnsIdByQuestion", qids);
        const aas = await fetchAActs(ansids, []);
        zananss = aas[0], anss = aas[2];
        chgLoaderState("graphloader", "收集问题信息");
        qsts = await DBfunc("getDetailMapOfIds", "questions", qids, "id");

        const qstvals = Object.values(qsts);
        additionTitle = qstvals.length == 1 ? "[问题]-" + qstvals[0].title : "多个问题";
        groupidx = 2;
    }
    else if (qs.ansid != null)
    {
        const ansids = qs.ansid.split("*").map(Number);

        const aas = await fetchAActs(ansids, []);
        zananss = aas[0], anss = aas[2];

        const as = Object.values(anss);
        additionTitle = as.length == 1 ? "[回答]-" + as[0].id : "多个回答";
        groupidx = 2;
    }
    else if (qs.artid != null)
    {
        const artids = qs.artid.split("*").map(Number);

        const aas = await fetchAActs([], artids);
        zanarts = aas[1], arts = aas[3];

        const as = Object.values(arts);
        additionTitle = as.length == 1 ? "[文章]-" + as[0].title : "多篇文章";
        groupidx = 2;
    }
    else if (qs.qfid != null)
    {
        const qids = qs.qfid.split("*").map(Number);

        chgLoaderState("graphloader", "收集关注记录");
        const pmss = [DBfunc("getAny", "followqsts", "to", qids), DBfunc("getDetailMapOfIds", "questions", qids, "id")];
        /**@type {[Zan[], {[x:number]: Question}]}*/
        const ret = await Promise.all(pmss);

        folqsts = ret[0]; qsts = ret[1];
        baseTitle = "关注";
        const qstvals = Object.values(qsts);
        additionTitle = qstvals.length == 1 ? "[问题]-" + qstvals[0].title : "多个问题";
        groupidx = 2;
    }
    const aths = Object.values(anss).mapToProp("author");
    const athsset = new Set(aths);
    const athsset2 = new Set(Object.values(anss).filter(ans => ans.zancnt >= 100).mapToProp("author"));
    {
        chgLoaderState("graphloader", "收集点赞人信息");
        const voters = new Set(zananss.concat(zanarts).mapToProp("from").concat(aths)).toArray();
        const usrs2 = await DBfunc("getDetailMapOfIds", "users", voters, "id");
        Object.assign(usrs, usrs2);
    }
    if (qs.limit != null)
        limitCount = Number(qs.limit);

    const limzan = Number(qs.limzan) || 100;

    const filtUsers = Object.values(usrs).filter(usr => athsset2.has(usr.id) || usr.zancnt >= limzan);
    const uidxmap = new Map(filtUsers.map((usr, idx) => [usr.id, idx]));
    const nodes = filtUsers.map((usr, idx) => ({ category: athsset.has(usr.id) ? 0 : 1, name: usr.name, symbolSize: Math.log2(usr.follower + 1), value: Math.cbrt(usr.follower + 1), id: idx }));
    const links = zananss.concat(zanarts)
        .filter(zan => uidxmap.has(zan.from) && uidxmap.has(anss[zan.to].author))
        .map(zan => ({ source: uidxmap.get(zan.from), target: uidxmap.get(anss[zan.to].author) }));

    const option = {
        legend: {
            data: ['答主','点赞']
        },
        toolbox: saveOpt,
        series: [{
            type: 'graph',
            layout: 'force',
            animation: false,
            label: {
                normal: {
                    position: 'right',
                    formatter: '{b}'
                }
            },
            draggable: true,
            data: nodes,
            categories: [{ name: "答主", base: "答主", keyword: {} }, { name: "点赞", base: "点赞", keyword: {} }],
            force: {
                // initLayout: 'circular'
                edgeLength: 10,
                repulsion: 50,
                gravity: 0.3
            },
            edges: links
        }]
    };

    chgLoaderState("graphloader", "加载图表", false);
    myChart.setOption(option);
}();

