"use strict"


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
    const anss = await doAnalyse("getAnsIdByVoter", voters, "desc");
    console.log(`${anss.length} answers`, anss);
    /**@type {{[x:number]: Answer}}*/
    const ansMap = await doAnalyse("getDetailMapOfIds", "answers", anss.mapToProp("key"), "id");
    /**@type {{[x:number]: Question}}*/
    const qstMap = await doAnalyse("getDetailMapOfIds", "questions", Object.values(ansMap).mapToProp("question"), "id");
    const data = [];
    for (let idx = 0; idx < anss.length; ++idx)
    {
        const cur = anss[idx];
        const ans = ansMap[cur.key];
        const qstid = ans.question;
        const qst = qstMap[qstid];
        const title = qst == null ? qstid : qst.title;
        const dat = { ansid: ans.id, qst: { title: title, aid: ans.id, qid: qstid }, author: ans.author, date: ans.timeC, count: cur.count };
        data.push(dat);
    }

    $("#maintable").DataTable(
        {
            paging: true,
            lengthMenu: [[20, 50, 100, -1], [20, 50, 100, "All"]],
            data: data,
            order: [[4, "desc"]],
            columns:
            [
                { data: "ansid" },
                {
                    data: "qst",
                    render: displayRender(dat => `<a class="bgopen" href="https://www.zhihu.com/question/${dat.qid}/answer/${dat.aid}">${dat.title}</a>`, dat => dat.qid),
                },
                {
                    data: "author",
                    render: displayRender(dat => `<a class="bgopen" href="https://www.zhihu.com/people/${dat}">${dat}</a>`),
                },
                {
                    data: "date",
                    render: displayRender(dat => dat === -1 ? "No record" : new Date(dat * 1000).toLocaleString()),
                },
                { data: "count" }
            ]
        });
}


!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();

    let voters;

    if (qs.artid != null)
    {
        const artid = qs.artid.split("*").map(Number);
        voters = await getVoters(artid, "article");
    }
    else if (qs.votid != null)
    {
        voters = qs.votid.split("*");
    }
    else
    {
        /**@type {number[]}*/
        let ansid;
        if (qs.ansid != null)
        {
            ansid = qs.ansid.split("*").map(Number);
        }
        else if (qs.authorid != null)
        {
            const athid = qs.authorid.split("*");
            ansid = (await doAnalyse("getAnswerByVoter", athid)).mapToProp("key");
        }
        else
            return;
        voters = await getVoters(ansid, "answer");
    }
    if (voters != null)
        AssocByVoters(voters);
}()

