"use strict"

/**@type {Map<string|number, [string,number,string,string,number][]>}*/
let wholeData;
/**@type {string[]}*/
let allDates = [];
/**@type {string}*/
let additionTitle;
let stackX;

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
    const series = Array.from(wholeData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "scatter",
            symbolSize: 5,
            encode: { x: 0, y: 8, tooltip: [5, 6, 10] }
        }));
    const option = {
        title: { text: "点赞记录图-" + additionTitle },
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
    const series = Array.from(wholeData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "line",
            stack: "sum",
            areaStyle: { normal: {} }
        }));
    const option = {
        title: { text: "点赞记录图-" + additionTitle },
        tooltip: {
            trigger: "axis", axisPointer: {
                type: 'cross',
                label: { backgroundColor: '#6a7985' }
            }
        },
        toolbox: saveOpt,
        legend: getLegend(wholeData),
        xAxis: {
            type: "category",
            boundaryGap: false,
            name: "时间",
            data: stackX
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
    const series = Array.from(wholeData.entries()).map(entry =>
        ({
            name: entry[0],
            data: entry[1],
            type: "scatter",
            symbolSize: 5,
            encode: { x: 7, y: 8, tooltip: [5, 6, 10] }
        }));
    const option = {
        title: { text: "点赞时间图-" + additionTitle },
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

const myChart = echarts.init(document.getElementById("graph"), null, { renderer: "canvas" });


/**
 * @param {Zan[]} zans
 * @param {{[x:number]:User}} umapper
 * @param {{[x:number]:Answer|Article}} mapper
 * @param {"answer"|"article"} type
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
            obj = obj.id;
        else if (type === "article")
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
        return [-1, obj.author, obj.id + "", obj.timeC, "create", usr, o2, `${mon}/${day}`, minu + hour * 60, token, `${mon}/${day} ${hour}:${minu}`, sec + minu * 60 + hour * 3600];
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
        const ansdat = encodeZan(zananss, usrs, anss, "answer");
        const artdat = encodeZan(zanarts, usrs, arts, "article");
        const objdat = encodeObj(Object.values(anss).concat(Object.values(arts)), usrs);
        /**@type {[number,number,string,string,string][]}*/
        const wholeData2 = ansdat.concat(artdat).concat(objdat).sort((a, b) => a[3] - b[3]);
        wholeData2.forEach((x, idx) => x[0] = idx);
        wholeData = wholeData2.groupBy(groupidx);
        if (qs.stack === "true")
        {
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
            stackX = ["init"];
            for (; t1 < tmax; ++idx)
            {
                while (t1 > t2)
                {
                    Array.from(Object.entries(wmap)).forEach(en =>
                    {
                        const va = wholeData.get(en[0]);
                        va.push(en[1]);
                    });
                    const [, , , hour, minu, ,] = Date.getDetailCHN(t2);
                    stackX.push(`${hour}:${minu}`);
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
                const [, , , hour, minu, ,] = Date.getDetailCHN(t2);
                stackX.push(`${hour}:${minu}`);
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
            const uids = new Set(wholeData2.mapToProp(1)).toArray(), aids = new Set(wholeData2.mapToProp(2)).toArray();
            createOption(uids, uids).forEach(opt => frag1.appendChild(opt));
            createOption(aids, aids).forEach(opt => frag2.appendChild(opt));
            selUser.appendChild(frag1);
            selObj.appendChild(frag2);
        }
        $("#changeonly").text(qs.only === "true" ? "切换到分时" : "切换到不分时");
        $("#changestack").text(qs.stack === "true" ? "切换到非堆栈图" : "切换到堆栈累积图");

    }
}()

