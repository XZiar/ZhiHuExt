"use strict"

/**@type {Map<string|number, [number, string, string, number, string, string, string|number, string, number, number, string, number, number, number][]>}*/
let wholeData;
/**@type {string[]}*/
let allDates = [];
/**@type {string}*/
let additionTitle;
let yidx = 11, xidx = 0;
let objname = "点赞";

const selUser = $("#selUser")[0], selObj = $("#selObj")[0];

const saveOpt = ({ show: true, feature: { saveAsImage: { show: true, excludeComponents: ["toolbox"], pixelRatio: 2 } } });
const yAxis = ({
    type: 'log',
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
        title: { text: "点赞人"+objname+"趋势图-" + additionTitle },
        tooltip: { trigger: "item", formatter: dat => `${dat.data[5]}<br />${dat.data[6]}<br />${dat.data[10]}` },
        toolbox: saveOpt,
        legend: getLegend(wholeData),
        xAxis: xax,
        yAxis: yAxis,
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

const myChart = echarts.init(document.getElementById("graph"), null, { renderer: "canvas" });


/**
 * @param {Zan[]} zans
 * @param {{[x:number]:User}} umapper
 * @param {{[x:number]:Answer|Article}} mapper
 * @param {"answer"|"article"} type
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
            obj = obj.id;
        else if (type === "article")
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
        return [-1, obj.author, obj.id + "", obj.timeC, "create", usr.name, o2, `${mon}/${day}`, minu + hour * 60, token, `${mon}/${day} ${hour}:${minu}`, usr.zancnt, usr.anscnt + usr.artcnt, usr.follower];
    });
}

!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();
    /**@type {Zan[]}*/
    let zananss = [], zanarts = [];
    /**@type {{[x:number]:Answer}}*/
    let anss = {};
    /**@type {{[x:number]:Article}}*/
    let arts = {};
    /**@type {{[x:number]:User}}*/
    let usrs = {};
    let groupidx = -1;

    if (qs.uid != null)
    {
        const uids = qs.uid.split("*");
        const ret = await doAnalyse("outputUserActs", uids, true);
        zananss = ret.zananss, zanarts = ret.zanarts, usrs = ret.users;
        const us = Object.values(usrs);
        additionTitle = us.length == 1 ? "[用户]-" + us[0].name : "多个用户";
        groupidx = 1;
    }
    else if (qs.athid != null)
    {
        const athids = qs.athid.split("*");
        const ret = await doAnalyse("outputAuthorActs", athids, true);
        zananss = ret.zananss, zanarts = ret.zanarts, anss = ret.anss, arts = ret.arts, usrs = ret.users;
        const us = Object.values(usrs);
        additionTitle = us.length == 1 ? "[作者]-" + us[0].name : "多个作者";
        groupidx = 2;
    }
    else if (qs.qid != null)
    {
        const qids = qs.qid.split("*").map(Number);
        const ret = await doAnalyse("outputQuestActs", qids, true);
        zananss = ret.zans, anss = ret.anss;
        const qsts = Object.values(ret.qsts);
        additionTitle = qsts.length == 1 ? "[问题]-" + qsts[0].title : "多个问题";
        groupidx = 2;
    }
    else if (qs.ansid != null)
    {
        const aids = qs.ansid.split("*").map(Number);
        const ret = await doAnalyse("outputAActs", aids, "answer", true);
        zananss = ret.zans, anss = ret.objs;
        const as = Object.values(anss);
        additionTitle = as.length == 1 ? "[回答]-" + as[0].id : "多个回答";
        groupidx = 2;
    }
    else if (qs.artid != null)
    {
        const aids = qs.artid.split("*").map(Number);
        const ret = await doAnalyse("outputAActs", aids, "article", true);
        zanarts = ret.zans, arts = ret.objs;
        const as = Object.values(arts);
        additionTitle = as.length == 1 ? as[0].title : "多篇文章";
        groupidx = 2;
    }

    if (zananss.length > 0 || zanarts.length > 0)
    {
        const unames = zananss.concat(zanarts).mapToProp("from");
        usrs = await DBfunc("getDetailMapOfIds", "users", unames, "id", "head", "hl");
        const ansdat = encodeZan(zananss, usrs, anss, "answer");
        const artdat = encodeZan(zanarts, usrs, arts, "article");
        const objdat = encodeObj(Object.values(anss).concat(Object.values(arts)), usrs);
        const wholeData2 = ansdat.concat(artdat).concat(objdat).sort((a, b) => a[3] - b[3]);
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

