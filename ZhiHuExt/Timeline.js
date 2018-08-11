"use strict"

/**@type {Map<string|number, [string,number,string,string,number][]>}*/
let wholeData;
/**@type {string[]}*/
let allDates = [];
/**@type {string}*/
let additionTitle, baseTitle = "点赞";
let stackX;
let limitCount = 0;

const selUser = $("#selUser")[0], selObj = $("#selObj")[0];

const saveOpt = ({ show: true, feature: { saveAsImage: { show: true, excludeComponents: ["toolbox"], pixelRatio: 2 } } });
const yAxis = ({
    splitLine: { lineStyle: { type: 'dashed' } },
    min: 0,
    max: 1440,
    interval: 180,
    name: "当日时间",
    axisLabel: { formatter: val => `${val/60}:00` }
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

function showOnlyAct()
{
    chgLoaderState("graphloader", "加载图表", false);
    const series = Array.from(wholeData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "scatter",
            symbolSize: 5,
            encode: { x: 0, y: 8, tooltip: [5, 6, 10] }
        }));
    const option = {
        title: { text: baseTitle + "记录图-" + additionTitle },
        tooltip: { trigger: "item", formatter: dat => `${dat.data[5]}<br />${dat.data[6]}<br />${dat.data[10]}` },
        toolbox: saveOpt,
        legend: getLegend(wholeData),
        xAxis: {
            splitLine: { lineStyle: { type: 'dashed' } },
            name: "记录序号",
        },
        yAxis: yAxis,
        series: series,
    };
    myChart.setOption(option);
}

function showStack()
{
    chgLoaderState("graphloader", "加载图表", false);
    let objData = wholeData;
    if (limitCount != 0)
        objData = new Map(Array.from(wholeData.entries())
            .sort((a,b) => b[1].last() - a[1].last())
            .slice(0, limitCount));
    const series = Array.from(objData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "line",
            stack: "sum",
            areaStyle: { normal: {} }
        }));
    const option = {
        title: { text: baseTitle + "记录图-" + additionTitle },
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: 'cross',
                label: { backgroundColor: '#6a7985' }
            }
        },
        toolbox: saveOpt,
        legend: getLegend(objData),
        xAxis: {
            type: "category",
            boundaryGap: false,
            name: "时间",
            data: stackX,
            axisLabel: { formatter: dat => { return dat.split(" ")[1]; } }
        },
        yAxis: [{ type: "value" }],
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

function showAct()
{
    chgLoaderState("graphloader", "加载图表", false);
    const series = Array.from(wholeData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "scatter",
            symbolSize: 5,
            encode: { x: 7, y: 8, tooltip: [5, 6, 10] }
        }));
    const option = {
        title: { text: baseTitle + "时间图-" + additionTitle },
        tooltip: { trigger: "item", formatter: dat => `${dat.data[5]}<br />${dat.data[6]}<br />${dat.data[10]}` },
        toolbox: saveOpt,
        legend: getLegend(wholeData),
        xAxis: {
            splitLine: { lineStyle: { type: 'dashed' } },
            type: "category",
            data: allDates,
            name: "日期"
        },
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
 * @param {Zan[]} zans
 * @param {{[x:number]:User}} umapper
 * @param {{[x:number]:Answer|Article|Question}} mapper
 * @param {"answer"|"article"|"question"} type
 * @returns {[number, string, string, number, string, string, string|number, string, number, number, string, number][]}
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
        usr = usr ? usr.name : zan.from;
        return [-1, zan.from, zan.to + "", zan.time, type, usr, obj, `${mon}/${day}`, minu + hour * 60, token, `${mon}/${day} ${hour}:${minu}`, sec + minu * 60 + hour * 3600];
    });
}
/**
 * @param {Answer[]|Article[]} objs
 * @param {{[x:number]:User}} umapper
 * @returns {[number, string, string, number, string, string, string|number, string, number, number, string, number][]}
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
        usr = usr ? usr.name : obj.author;
        return [-1, obj.author+"[作者]", obj.id + "", obj.timeC, "create", usr, o2, `${mon}/${day}`, minu + hour * 60, token, `${mon}/${day} ${hour}:${minu}`, sec + minu * 60 + hour * 3600];
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

    if(qs.limit != null)
        limitCount = Number(qs.limit);

    if (zananss.length + zanarts.length + folqsts.length > 0)
    {
        chgLoaderState("graphloader", "统计数据");

        const ansdat = encodeZan(zananss, usrs, anss, "answer");
        const artdat = encodeZan(zanarts, usrs, arts, "article");
        const qstdat = encodeZan(folqsts, usrs, qsts, "question");
        const objdat = encodeObj(Object.values(anss).concat(Object.values(arts)), usrs);
        /**@type {[number,number,string,string,string][]}*/
        const wholeData2 = ansdat.concat(artdat).concat(qstdat).concat(objdat).sort((a, b) => a[3] - b[3]);
        wholeData2.forEach((x, idx) => x[0] = idx);
        wholeData = wholeData2.groupBy(groupidx);
        if (qs.stack === "true")
        {
            chgLoaderState("graphloader", "构建堆栈数据");
            $("#export").remove();
            const step = Number(qs.step || 1800);
            const wmap = {};
            for (const k of wholeData.keys())
            {
                wmap[k] = 0;
                wholeData.set(k, [0]);
            }
            const tmin = wholeData2[0][3], tmax = wholeData2.last()[3];
            let t1 = tmin, t2 = tmin + step, idx = 0;
            {
                const [, mon, day, hour, minu, ,] = Date.getDetailCHN(t1);
                stackX = [`${mon}/${day} ${hour}:${minu}`];
            }
            for (; t1 < tmax; ++idx)
            {
                while (t1 > t2)
                {
                    Array.from(Object.entries(wmap)).forEach(en =>
                    {
                        const va = wholeData.get(en[0]);
                        va.push(en[1]);
                    });
                    const [, mon, day, hour, minu, ,] = Date.getDetailCHN(t2);
                    stackX.push(`${mon}/${day} ${hour}:${minu}`);
                    t2 += step;
                }
                const p = wholeData2[idx];
                wmap[p[groupidx]] += 1;
                t1 = p[3];
            }
            Array.from(Object.entries(wmap)).forEach(en =>
            {
                const va = wholeData.get(en[0]);
                va.push(en[1]);
            });
            {
                const [, mon, day, hour, minu, ,] = Date.getDetailCHN(t2);
                stackX.push(`${mon}/${day} ${hour}:${minu}`);
            }
            showStack();
        }
        else if (qs.only === "true")
        {
            showOnlyAct();
        }
        else
        {
            allDates = new Set(wholeData2.mapToProp(9)).toArray().sort((a, b) => a - b).map(x => `${Math.floor(x / 100) % 100}/${x % 100}`);
            showAct();

            selUser.innerHTML = "", selObj.innerHTML = "";
            const frag1 = document.createDocumentFragment(), frag2 = document.createDocumentFragment();
            frag1.appendChild(createOption("", "只看某用户")); frag2.appendChild(createOption("", "只看某回答/文章"));
            /**@type {Set}*/
            const uids = new Set(wholeData2.mapToProp(1)).toArray(), aids = new Set(wholeData2.mapToProp(2)).toArray();
            if (uids.size < 1000)
            {
                createOption(uids, uids).forEach(opt => frag1.appendChild(opt));
                createOption(aids, aids).forEach(opt => frag2.appendChild(opt));
                selUser.appendChild(frag1);
                selObj.appendChild(frag2);
            }
        }
        $("#changeonly").text(qs.only === "true" ? "切换到分时" : "切换到不分时");
        $("#changestack").text(qs.stack === "true" ? "切换到非堆栈图" : "切换到堆栈累积图");

    }
}()

