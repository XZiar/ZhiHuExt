"use strict"

/**@type {User[]}*/
let allusr = [], refusr = [];
/**@type {string}*/
let additionTitle, title, col;

const selUser = $("#selUser")[0], selObj = $("#selObj")[0];

const saveOpt = ({ show: true, feature: { saveAsImage: { show: true, excludeComponents: ["toolbox"], pixelRatio: 2 } } });


function histdata(data)
{
    /**@type {number[]}*/
    let dataarray;
    if (col === "acnt")
    {
        dataarray = data.map(usr => usr.anscnt + usr.artcnt);
    }
    else
    {
        dataarray = data.mapToProp(col);
    }
    const maxthr = Number($("#maxthr").val());
    if (maxthr == 0)
        dataarray = dataarray.filter(x => x >= 0);
    else
        dataarray = dataarray.filter(x => x >= 0 && x < maxthr);
    return dataarray;
}

function showStat(newdat)
{
    additionTitle = col === "acnt" ? "作品数" : (col === "zancnt" ? "赞数" : "粉丝数");
    console.log("beginshow");

    const bins1 = ecStat.histogram(newdat ? newdat : histdata(allusr));
    const series = [{
        type: 'bar',
        label: {
            normal: {
                show: true,
                position: 'top',
                formatter: params => params.value[1]
            }
        },
        data: bins1.data
    }];
    let minx = bins1.bins[0].x0, maxx = bins1.bins.last().x1;
    if (refusr.length > 0)
    {
        const bins2 = ecStat.histogram(histdata(refusr));
        const ratio = allusr.length / refusr.length;
        bins2.data.forEach(x => x[1] = Math.floor(x[1] * ratio));
        series.push({
            type: 'bar',
            name: "ref",
            label: {
                normal: {
                    show: true,
                    position: 'top',
                    formatter: params => params.value[1]
                }
            },
            data: bins2.data
        });
        minx = Math.min(minx, bins2.bins[0].x0), maxx = Math.max(maxx, bins2.bins.last().x1);
    }
    minx = minx < 0 ? 0 : minx;
    const option = {
        title: { text: title + "---" + additionTitle },
        //color: ['rgb(25, 183, 207)'],
        grid: {
            top: 80,
            containLabel: true
        },
        xAxis: [{
            type: 'value',
            min: minx,
            max: maxx,
            scale: true,
        }],
        yAxis: [{
            min: "dataMin",
            max: "dataMax",
            type: 'log',
        }],
        toolbox: saveOpt,
        series: series
    };
    myChart.clear();
    myChart.setOption(option);
}

function showcloud(words)
{
    const namedata = new SimpleBag(words == null ? allusr.mapToProp("name") : words).toArray("desc")
        .map(x => ({ name: x.key, value: x.count }));
    const gap = words ? 4 : 8;
    console.log("wordcloud", namedata);
    const series = [{
        type: "wordCloud", shape: "circle",
        left: 'center', top: 'center',
        sizeRange: [12, 60],
        rotationRange: [-90, 90],
        rotationStep: 45,
        gridSize: gap,
        drawOutOfBound: false,
        textStyle: {
            normal: {
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                // Color can be a callback function or a color string
                color: function ()
                {
                    // Random color
                    return 'rgb(' + [
                        Math.round(Math.random() * 160),
                        Math.round(Math.random() * 160),
                        Math.round(Math.random() * 160)
                    ].join(',') + ')';
                }
            },
            emphasis: {
                shadowBlur: 10,
                shadowColor: '#333'
            }
        },
        data: namedata
    }];
    myChart.clear();
    myChart.setOption({
        title: { text: title + "---字符云" },
        toolbox: saveOpt,
        series: series
    });
}


$(document).on("click", ".chgobj", ev =>
{
    col = ev.target.dataset.obj;
    showStat();
});
$(".chgobj")[0].draggable = true;
$(".chgobj")[0].ondragover = ev => ev.preventDefault();
$(".chgobj")[0].ondrop = ev =>
{
    ev.preventDefault();
    const dat = JSON.parse(ev.dataTransfer.getData("text"));
    console.log("array-dat", dat);
    showStat(dat);
}
$(document).on("click", "#addrefall", async ev =>
{
    refusr = await DBfunc("getAny", "users", "id", ["#ALL_USER"]);
    console.log(`here get ${refusr.length} ref users`);
    showStat();
});
$("#addrefall")[0].ondragover = ev => ev.preventDefault();
$("#addrefall")[0].ondrop = async ev =>
{
    ev.preventDefault();
    const ansid = Number(ev.dataTransfer.getData("text"));
    const refuids = (await DBfunc("getVoters", ansid, "answer")).mapToProp("key");
    refusr = await DBfunc("getAny", "users", "id", refuids);
    console.log(`here get ${refusr.length} ref users`);
    showStat();
}
$(document).on("click", "#namecloud", ev =>
{
    showcloud();
});
$("#namecloud")[0].ondragover = ev => ev.preventDefault();
$("#namecloud")[0].ondrop = ev =>
{
    ev.preventDefault();
    const words = JSON.parse(ev.dataTransfer.getData("text"));
    console.log("words", words);
    showcloud(words);
}
const myChart = echarts.init(document.getElementById("graph"), null, { renderer: "canvas" });

!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();
    let uids = [];

    if (qs.remotedb != null)
    {
        rdb = qs.remotedb;
        await RemoteDB(rdb);
    }

    if (qs.uid != null)
    {
        uids = qs.uid.split("*");
    }
    else if (qs.usrblob != null)
    {
        uids = (await (await fetch(qs.usrblob)).json()).mapToProp("key");
    }
    else if (qs.ansid != null)
    {
        const aids = qs.ansid.split("*").map(Number);
        uids = (await DBfunc("getVoters", aids, "answer")).mapToProp("key");
    }
    else if (qs.artid != null)
    {
        const aids = qs.artid.split("*").map(Number);
        uids = (await DBfunc("getVoters", aids, "article")).mapToProp("key");
    }
    else if (qs.qid != null)
    {
        const qids = qs.qid.split("*").map(Number);
        uids = (await DBfunc("getVoters", qids, "question")).mapToProp("key");
    }
    else if (qs.athid != null)
    {
        const athids = qs.athid.split("*");
        uids = (await DBfunc("getVotersByAuthor", athids)).mapToProp("key");
    }

    console.log(`receive ${uids.length} uids`);

    allusr = await DBfunc("getAny", "users", "id", uids);
    console.log(`here get ${allusr.length} obj users`);
    console.log("user-data received");

    col = qs.col || "zancnt";
    title = qs.title || "用户分析";

    showStat();
}()

