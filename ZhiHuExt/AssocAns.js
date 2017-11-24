"use strict"

let finalData;

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
    const anss = await DBfunc("getAnsIdByVoter", voters, "desc");
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

    $("#maintable").DataTable(
        {
            paging: true,
            lengthMenu: [[20, 50, 100, -1], [20, 50, 100, "All"]],
            data: data,
            order: [[5, "desc"]],
            columns:
            [
                { data: "ansid" },
                {
                    data: "qst",
                    render: displayRender(dat => dat.qid == -1 ? "" : `<a class="bgopen" href="https://www.zhihu.com/question/${dat.qid}/answer/${dat.aid}">${dat.title}</a>`,
                        dat => dat.qid),
                },
                {
                    data: "author",
                    render: displayRender(dat => `<a class="bgopen" href="https://www.zhihu.com/people/${dat.id}">${dat.name}</a>`, dat => dat.name),
                },
                {
                    data: "date",
                    render: displayRender(dat => timeString(dat, "No record")),
                },
                { data: "zancnt" },
                { data: "count" }
            ]
        });
    finalData = data;
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
    else if (qs.uid != null)
    {
        const athid = qs.uid.split("*");
        voters = await DBfunc("getVotersByAuthor", athid);
    }
    else if (qs.votid != null)
    {
        voters = qs.votid.split("*");
    }
    else if (qs.ansblob != null)
    {
        const anss = await (await fetch(qs.ansblob)).json()
        AssocByAnswers(anss);
        return;
    }
    if (voters != null)
        AssocByVoters(voters);
}()

