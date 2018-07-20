"use strict"

let remotedb = false;
let dbid = "";

let finalData;
let mindate = new Date().getTime(), maxdate = -1;
let mainTable;
let sliderHandle, missdate;

/**
 * @param {string[] | BagArray} voters
 */
async function AssocByVoters(voters)
{
    const uid0 = new Set(await toPureArray(voters));
    uid0.delete("");//except anonymous user
    /**@type {string[]}*/
    const uids = uid0.toArray();

    /**@type {[Promise<BagArray>, Promise<BagArray>]}*/
    const pmss = [DBfunc("getIdByVoter", voters, "answer", "desc"), DBfunc("getIdByVoter", voters, "article", "desc")];
    chgLoaderState("tabloader", "收集点赞人点赞对象");
    const [anss, arts] = await Promise.all(pmss);
    await AssocByAAs(anss, arts);
}
/**
 * @param {BagArray} anss
 * @param {BagArray} arts
 */
async function AssocByAAs(anss, arts)
{
    console.log(`${anss.length} answers`, anss);
    console.log(`${arts.length} articles`, arts);
    if (anss.length > 10000)
        anss = anss.filter(x => x.count > 5);
    if (arts.length > 10000)
        arts = arts.filter(x => x.count > 5);
    chgLoaderState("tabloader", "收集回答文章数据");
    /**@type {[Promise<{[x:number]: string}>, Promise<{[x:number]: string}>]}*/
    const pmss1 = [DBfunc("getDetailMapOfIds", "answers", anss.mapToProp("key"), "id", "excerpt"), DBfunc("getDetailMapOfIds", "articles", arts.mapToProp("key"), "id", "excerpt")];
    const [ansMap, artMap] = await Promise.all(pmss1);
    chgLoaderState("tabloader", "收集问题数据");
    /**@type {{[x:number]: string}}*/
    const qstMap = await DBfunc("getPropMapOfIds", "questions", Object.values(ansMap).mapToProp("question"), "title");
    chgLoaderState("tabloader", "收集账号数据");
    /**@type {{[x:string]: string}}*/
    const usrMap = await DBfunc("getPropMapOfIds", "users", Object.values(ansMap).concat(Object.values(artMap)).mapToProp("author"), "name");
    const data = [];
    chgLoaderState("tabloader", "处理数据");
    for (let idx = 0; idx < anss.length; ++idx)
    {
        const cur = anss[idx];
        const ans = ansMap[cur.key];
        if (ans == null)
        {
            data.push({ type: "answer", qid: -1, aid: cur.key, target: { aid: -1 }, author: { name: "", id: "" }, date: -1, zancnt: -1, count: cur.count });
            continue;
        }
        const qstid = ans.question;
        const title = qstMap[qstid] || qstid;
        const athname = usrMap[ans.author];
        const author = { name: athname == null ? ans.author : athname, id: ans.author };
        const dat = { type: "answer", qid: qstid, aid: ans.id, target: { title: title, url:`https://www.zhihu.com/question/${qstid}/answer/${ans.id}`, aid: ans.id }, author: author, date: ans.timeC, zancnt: ans.zancnt, count: cur.count };
        data.push(dat);
    }
    for (let idx = 0; idx < arts.length; ++idx)
    {
        const cur = arts[idx];
        const art = artMap[cur.key];
        if (art == null)
        {
            data.push({ aid: cur.key, target: { aid: -1 }, author: { name: "", id: "" }, date: -1, zancnt: -1, count: cur.count });
            continue;
        }
        const title = art.title;
        const athname = usrMap[art.author];
        const author = { name: athname == null ? art.author : athname, id: art.author };
        const dat = { type: "article", aid: art.id, target: { title: title, url:`https://zhuanlan.zhihu.com/p/${art.id}`, aid: art.id }, author: author, date: art.timeC, zancnt: art.zancnt, count: cur.count };
        data.push(dat);
    }

    chgLoaderState("tabloader", "加载表格", false);
    mainTable = $("#maintable").DataTable(
        {
            paging: true,
            deferRender: true,
            lengthMenu: [[20, 50, 100, -1], [20, 50, 100, "All"]],
            data: data,
            order: [[5, "desc"]],
            columns:
            [
                {
                    data: "aid",
                    orderable: false
                },
                {
                    data: "target",
                    orderable: false,
                    render: displayRender(dat => dat.aid === -1 ? "" : `<a class="bgopen" href="${dat.url}">${dat.title}</a>`, dat => dat.aid)
                },
                {
                    data: "author",
                    orderable: false,
                    render: displayRender(dat => `<a class="bgopen" href="https://www.zhihu.com/people/${dat.id}">${dat.name}</a>`, dat => dat.name)
                },
                {
                    data: "date",
                    render: displayRender(dat => timeString(dat, "No record"))
                },
                { data: "zancnt" },
                { data: "count" }
            ],
            dom: `<"#dummytitle">lfrtip`,
            fnInitComplete: () => initSlider(data)
        });
    finalData = data;
}

function filterTime(setting, data, index)
{
    if (!sliderHandle || !missdate)
        return true;
    const dtime = data[3];
    return dtime === -1 ? mindate.checked : (mindate <= dtime && maxdate >= dtime);
}

function initSlider(data)
{
    const divhtml =
        `<div style="float:left; margin-right:20px;">
        <div id="drange" style="float:left; margin:0 20px; width:300px;"></div>
        <div style="float:left">包含-1<input id="missdate" type="checkbox" checked /></div>
        <p id="rangetxt" style="float:left; margin:0 8px; font-weight: bolder; font-size: larger;"></p>
        </div>`;
    $("#dummytitle")[0].innerHTML = divhtml;
    sliderHandle = $("#drange")[0];
    missdate = $("#missdate")[0];
    const rangetext = $("#rangetxt")[0];
    
    const toDate = t => new Date(t * 1000).FormatCHN("yy/MM/dd");
    data.filter(x => x.date > 0).forEach(x => { mindate = Math.min(mindate, x.date); maxdate = Math.max(maxdate, x.date); });
    rangetext.textContent = toDate(mindate) + "  ~  " + toDate(maxdate);
    const dateRange = { "min": [mindate], "max": [maxdate] };
    if (mindate < maxdate - 3600 * 24 * 365) // a-year before
        dateRange["5%"] = [maxdate - 3600 * 24 * 365];
    if (mindate < maxdate - 3600 * 24 * 180) // 3-month before
        dateRange["30%"] = [maxdate - 3600 * 24 * 180];
    if (mindate < maxdate - 3600 * 24 * 30) // a-month before
        dateRange["60%"] = [maxdate - 3600 * 24 * 30];
    noUiSlider.create(sliderHandle,
        {
            start: [0, maxdate],
            range: dateRange,
            connect: true
        });
    sliderHandle.noUiSlider.on("update", (value, handle, unencode) =>
    {
        [mindate, maxdate] = unencode;
        rangetext.textContent = toDate(mindate) + "  ~  " + toDate(maxdate);
    });
    sliderHandle.noUiSlider.on("set", (value, handle, unencode) =>
    {
        [mindate, maxdate] = unencode;
        mainTable.draw(false);
    });
    $(missdate).on("change", e => mainTable.draw(false));
}

$(document).on("click", "#stat", e =>
{
    chrome.runtime.sendMessage({ action: "openpage", target: window.location.href.replace("AssocAns", "StatVoter"), isBackground: true });
});
$(document).on("click", "#export", e =>
{
    const head = "\uFEFF" + "answerId,questionId,articleId,标题,作者,authorId,日期,回答赞数,计数\n";
    let txt = head;
    const defDate = timeString(0);
    for (let idx = 0; idx < arts.length; ++idx)
    {
        if(dat.type === "answer")
            txt += `${dat.aid},${dat.qid},-1,"${dat.target.title}","${dat.author.name}",${dat.author.id},${timeString(dat.date, defDate)},${dat.zancnt},${dat.count}\n`;
        else
            txt += `-1,-1,${dat.aid},"${dat.target.title}","${dat.author.name}",${dat.author.id},${timeString(dat.date, defDate)},${dat.zancnt},${dat.count}\n`;
    }
    const time = new Date().Format("yyyyMMdd-hhmm");
    DownloadMan.exportDownload(txt, "txt", `AssocAns-${time}.csv`);
});

!async function()
{
    $.fn.dataTableExt.afnFiltering.push(filterTime);
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();

    let voters;

    if (qs.artid != null)
    {
        const artid = qs.artid.split("*").map(Number);
        chgLoaderState("tabloader", "收集文章点赞人");
        voters = await DBfunc("getVoters", artid, "article");
    }
    else if (qs.ansid != null)
    {
        const ansid = qs.ansid.split("*").map(Number);
        chgLoaderState("tabloader", "收集回答点赞人");
        voters = await DBfunc("getVoters", ansid, "answer");
    }
    else if (qs.qid != null)
    {
        const qid = qs.qid.split("*").map(Number);
        chgLoaderState("tabloader", "收集回答");
        const ansid = await DBfunc("getAnsIdByQuestion", qid);
        chgLoaderState("tabloader", "收集回答点赞人");
        voters = await DBfunc("getVoters", ansid, "answer");
    }
    else if (qs.athid != null)
    {
        const athid = qs.athid.split("*");
        chgLoaderState("tabloader", "收集作者点赞人");
        voters = await DBfunc("getVotersByAuthor", athid);
    }
    else if (qs.uid != null)
    {
        voters = qs.uid.split("*");
    }
    else if (qs.vid != null)
    {
        voters = qs.vid.split("*");
    }
    else if (qs.ansblob != null)
    {
        chgLoaderState("tabloader", "加载回答数据");
        const anss = await (await fetch(qs.ansblob)).json();
        AssocByAAs(anss, []);
        return;
    }
    else if (qs.artblob != null)
    {
        chgLoaderState("tabloader", "加载文章数据");
        const arts = await (await fetch(qs.artblob)).json();
        AssocByAAs([], arts);
        return;
    }
    else if (qs.remotedb != null && qs.ranl != null)
    {
        dbid = qs.remotedb;
        remotedb = true;
        await RemoteDB(dbid);
        const anss = await RemoteDB(dbid, "someAnalyse", "assocans", qs.ranl.split("*"));
        AssocByAAs(anss);
        return;
    }
    if (voters != null)
        AssocByVoters(voters);
}()

