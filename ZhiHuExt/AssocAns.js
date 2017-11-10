"use strict"

!async function ()
{
    /**
     * @param {string} method
     * @param {any[]} args
     */
    async function doAnalyse(method, ...args)
    {
        return await SendMsgAsync({ "action": "analyse", "method": method, "argument": args });
    }

    /**
     * @param {number | number[]} ids
     * @param {"Answer" | "Article"} target
     * @returns {BagArray}
     */
    async function getVoters(ids, target)
    {
        const method = target === "Answer" ? "getAnsVoters" : "getArtVoters";
        const voters = await doAnalyse(method, ids);
        console.log("voters", voters);
        return voters;
    }

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

        const anss = await doAnalyse("getAnswerByVoter", voters, "desc");
        console.log(anss);
        const ansMap = await doAnalyse("getPropMapOfIds", "answers", anss.mapToProp("key"), "question");
        const qstMap = await doAnalyse("getDetailMapOfIds", "questions", Object.values(ansMap), "id");
        const data = [];
        for (let idx = 0; idx < anss.length; ++idx)
        {
            const cur = anss[idx];
            const qstid = ansMap[cur.key];
            const link = "https://www.zhihu.com/question/" + qstid + "/answer/" + cur.key;
            const qst = qstMap[qstid];
            const title = qst == null ? qstid : qst.title;
            const dat = { "ansid": cur.key, "qst": { "title": title, "link": link }, "times": cur.count };
            data.push(dat);
        }

        $("#maintable").DataTable(
            {
                paging: true,
                lengthMenu: [[20, 50, 100, -1], [20, 50, 100, "All"]],
                data: data,
                order: [[2, "desc"]],
                columns: [
                    { data: "ansid" },
                    {
                        data: "qst",
                        render: function (data, type, row)
                        {
                            if (type === 'display')
                                return '<a href="' + data.link + '">' + data.title + '</a>';
                            else
                                return data.link;
                        }
                    },
                    { data: "times" }
                ]
            });
    }

    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();

    let voters;

    if (qs.artid != null)
    {
        const artid = qs.artid.split("*").map(Number);
        voters = await getVoters(artid, "Article");
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
        voters = await getVoters(ansid, "Answer");
    }
    if (voters != null)
        AssocByVoters(voters);
}()
