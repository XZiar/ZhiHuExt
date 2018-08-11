"use strict"

/**@type {Map<string|number, [number, string, string, number, string, string, string|number, string, number, number, string, number, number, number][]>}*/
let wholeData;
/**@type {string[]}*/
let allDates = [];
/**@type {string}*/
let additionTitle, baseTitle = "点赞", objname = "点赞";
let yidx = 11, xidx = 0;

const selUser = $("#selUser")[0], selObj = $("#selObj")[0];

const saveOpt = ({ show: true, feature: { saveAsImage: { show: true, excludeComponents: ["toolbox"], pixelRatio: 2 } } });
const yax = ({
    type: 'log',
    logBase: 10,
    min: 1,
    name: "计数"
});

function getLegend(dat)
{
    const legends = Array.from(dat.keys());
    return ({
        left: "30%",
        right: "10%",
        type: legends.length > 5 ? "scroll" : "plain",
        data: legends
    });
}

function showAct()
{
    chgLoaderState("graphloader", "加载图表", false);
    const series = Array.from(wholeData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "scatter",
            symbolSize: 5,
            encode: { x: xidx, y: yidx, tooltip: [5, 6, 10] }
        }));
    const xax = xidx == 0 ? 
        {
            splitLine: { lineStyle: { type: 'dashed' } },
            name: "记录序号",
        } :
        {
            splitLine: { lineStyle: { type: 'dashed' } },
            name: "时间",
            axisLabel: { formatter: val => `${Math.floor(val / 60)}:${Math.floor(val % 60)}` }
        }
    const option = {
        title: { text: baseTitle+"人"+objname+"趋势图-" + additionTitle },
        tooltip: { trigger: "item", formatter: dat => `${dat.data[5]}<br />${dat.data[6]}<br />${dat.data[10]}` },
        toolbox: saveOpt,
        legend: getLegend(wholeData),
        xAxis: xax,
        yAxis: yax,
        series: series,
        dataZoom: [{
            id: "dataZoomX",
            type: "slider",
            xAxisIndex: [0],
            filterMode: "empty"
        }]
    };
    myChart.setOption(option);
}

$(document).on("click", "#showzan", e =>
{
    yidx = 11; objname = "点赞"; showAct();
});
$(document).on("click", "#showa", e =>
{
    yidx = 12; objname = "作品"; showAct();
});
$(document).on("click", "#showfol", e =>
{
    yidx = 13; objname = "关注"; showAct();
});
$(document).on("click", "#chgxax", e =>
{
    if (xidx == 0)
    {
        e.target.textContent = "依照记录";
        xidx = 3;
    }
    else
    {
        e.target.textContent = "依照时间";
        xidx = 0;
    }
    showAct();
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
 * @param {Zan[]} zans
 * @param {{[x:number]:User}} umapper
 * @param {{[x:number]:Answer|Article|Question}} mapper
 * @param {"answer"|"article"|"question"} type
 * @returns {[number, string, string, number, string, string, string|number, string, number, number, string, number, number, number][]}
 */
function encodeZan(zans, umapper, mapper, type)
{
    return zans.filter(zan => zan.time > 0).map(zan =>
    {
        const [year, mon, day, hour, minu, sec,] = Date.getDetailCHN(zan.time);
        const token = year * 10000 + mon * 100 + day;
        let obj = mapper[zan.to];
        if (!obj)
            obj = zan.to;
        else if (type === "answer")
            obj = `${obj.author}[${obj.id}]`;
        else if (type === "article")
            obj = obj.title;
        else if (type === "question")
            obj = obj.title;
        else
            obj = zan.to;
        let usr = umapper[zan.from];
        if (!usr)
            usr = { name: zan.from, zancnt: 0, anscnt: 0, artcnt: 0, follower: 0 };
        return [-1, zan.from, zan.to + "", zan.time, type, usr.name, obj, `${mon}/${day}`, minu + hour * 60, token, `${mon}/${day} ${hour}:${minu}`, usr.zancnt, usr.anscnt + usr.artcnt, usr.follower];
    });
}
/**
 * @param {Answer[]|Article[]} objs
 * @param {{[x:number]:User}} umapper
 * @returns {[number, string, string, number, string, string, string|number, string, number, number, string, number, number, number][]}
 */
function encodeObj(objs, umapper)
{
    return objs.filter(obj => obj.timeC > 0).map(obj =>
    {
        const [year, mon, day, hour, minu, sec,] = Date.getDetailCHN(obj.timeC);
        const token = year * 10000 + mon * 100 + day;
        let o2 = obj;
        if (o2.question)
            o2 = obj.id;
        else if (o2.title)
            o2 = obj.title;
        else
            o2 = obj.id;
        let usr = umapper[obj.author];
        if (!usr)
            usr = { name: obj.author, zancnt: 0, anscnt: 0, artcnt: 0, follower: 0 };
        return [-1, obj.author + "[作者]", obj.id + "", obj.timeC, "create", usr.name, o2, `${mon}/${day}`, minu + hour * 60, token, `${mon}/${day} ${hour}:${minu}`, usr.zancnt, usr.anscnt + usr.artcnt, usr.follower];
    });
}

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

!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();
    /**@type {Zan[]}*/
    let zananss = [], zanarts = [], folqsts = [];
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
        chgLoaderState("graphloader", "收集点赞人信息");
        usrs = await DBfunc("getDetailMapOfIds", "users", uids, "id");

        const us = Object.values(usrs);
        additionTitle = us.length == 1 ? "[用户]-" + us[0].name : "多个用户";
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

    if (zananss.length + zanarts.length + folqsts.length > 0)
    {
        chgLoaderState("graphloader", "统计数据");

        const unames = zananss.concat(zanarts).concat(folqsts).mapToProp("from");
        usrs = await DBfunc("getDetailMapOfIds", "users", unames, "id", "head", "hl");
        const ansdat = encodeZan(zananss, usrs, anss, "answer");
        const artdat = encodeZan(zanarts, usrs, arts, "article");
        const qstdat = encodeZan(folqsts, usrs, qsts, "question");
        const objdat = encodeObj(Object.values(anss).concat(Object.values(arts)), usrs);
        const wholeData2 = ansdat.concat(artdat).concat(qstdat).concat(objdat).sort((a, b) => a[3] - b[3]);
        wholeData2.forEach((x, idx) => x[0] = idx);
        wholeData = wholeData2.groupBy(groupidx);
        Array.from(wholeData.entries()).forEach(entry =>
        {
            const arr = entry[1];
            const mintime = arr.reduce((a, c) => a < c[3] ? a : c[3], arr[0][3]);
            arr.forEach(item => item[3] = Math.floor((item[3] - mintime) / 60));
        });
        showAct();
    }
}()

