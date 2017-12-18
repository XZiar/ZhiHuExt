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
    if (voters[0].hasOwnProperty("count"))
        voters = voters.mapToProp("key");
    const uid0 = new Set(voters);
    uid0.delete("");//except anonymous user
    /**@type {string[]}*/
    const uids = uid0.toArray();

    /**@type {BagArray}*/
    const anss = await DBfunc("getIdByVoter", voters, "answer", "desc");
    await AssocByAnswers(anss);
}
/**
 * @param {BagArray} anss
 */
async function AssocByAnswers(anss)
{
    console.log(`${anss.length} answers`, anss);
    if (anss.length > 10000)
        anss = anss.filter(x => x.count > 5);
    /**@type {{[x:number]: Answer}}*/
    const ansMap = await DBfunc("getDetailMapOfIds", "answers", anss.mapToProp("key"), "id", "excerpt");
    /**@type {{[x:number]: string}}*/
    const qstMap = await DBfunc("getPropMapOfIds", "questions", Object.values(ansMap).mapToProp("question"), "title");
    /**@type {{[x:string]: string}}*/
    const usrMap = await DBfunc("getPropMapOfIds", "users", Object.values(ansMap).mapToProp("author"), "name");
    const data = [];
    for (let idx = 0; idx < anss.length; ++idx)
    {
        const cur = anss[idx];
        const ans = ansMap[cur.key];
        if (ans == null)
        {
            data.push({ ansid: cur.key, qst: { qid: -1 }, author: { name: "", id: "" }, date: -1, zancnt: -1, count: cur.count });
            continue;
        }
        const qstid = ans.question;
        const title = qstMap[qstid] || qstid;
        const athname = usrMap[ans.author];
        const author = { name: athname == null ? ans.author : athname, id: ans.author };
        const dat = { ansid: ans.id, qst: { title: title, aid: ans.id, qid: qstid }, author: author, date: ans.timeC, zancnt: ans.zancnt, count: cur.count };
        data.push(dat);
    }

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
                    data: "ansid",
                    orderable: false
                },
                {
                    data: "qst",
                    orderable: false,
                    render: displayRender(dat => dat.qid == -1 ? "" : `<a class="bgopen" href="https://www.zhihu.com/question/${dat.qid}/answer/${dat.aid}">${dat.title}</a>`,
                        dat => dat.qid),
                },
                {
                    data: "author",
                    orderable: false,
                    render: displayRender(dat => `<a class="bgopen" href="https://www.zhihu.com/people/${dat.id}">${dat.name}</a>`, dat => dat.name),
                },
                {
                    data: "date",
                    render: displayRender(dat => timeString(dat, "No record")),
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
    if (mindate < maxdate - 3600 * 24 * 365)
        dateRange["5%"] = [maxdate - 3600 * 24 * 365];
    if (mindate < maxdate - 3600 * 24 * 180)
        dateRange["30%"] = [maxdate - 3600 * 24 * 180];
    if (mindate < maxdate - 3600 * 24 * 30)
        dateRange["60%"] = [maxdate - 3600 * 24 * 180];
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
    const head = "\uFEFF" + "answerId,questionId,标题,作者,authorId,日期,回答赞数,计数\n";
    let txt = head;
    const defDate = timeString(0);
    finalData.forEach(dat => txt += `${dat.ansid},${dat.qst.qid},"${dat.qst.title}","${dat.author.name}",${dat.author.id},${timeString(dat.date, defDate)},${dat.zancnt},${dat.count}\n`);
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
        voters = await DBfunc("getVoters", artid, "article");
    }
    else if (qs.ansid != null)
    {
        const ansid = qs.ansid.split("*").map(Number);
        voters = await DBfunc("getVoters", ansid, "answer");
    }
    else if (qs.qid != null)
    {
        const qid = qs.qid.split("*").map(Number);
        const ansid = await DBfunc("getAnsIdByQuestion", qid);
        voters = await DBfunc("getVoters", ansid, "answer");
    }
    else if (qs.athid != null)
    {
        const athid = qs.athid.split("*");
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
        const anss = await (await fetch(qs.ansblob)).json();
        AssocByAnswers(anss);
        return;
    }
    else if (qs.remotedb != null && qs.ranl != null)
    {
        dbid = qs.remotedb;
        remotedb = true;
        await RemoteDB(dbid);
        const anss = await RemoteDB(dbid, "someAnalyse", "assocans", qs.ranl.split("*"))
        AssocByAnswers(anss);
        return;
    }
    if (voters != null)
        AssocByVoters(voters);
}()

