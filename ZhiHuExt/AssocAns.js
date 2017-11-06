"use strict"

!async function ()
{
    /**
     * @param {string} method
     * @param {any[]} args
     */
    function payload(method, ...args)
    {
        return { "action": "analyse", "method": method, "argument": args };
    }
    const qs = _getQueryString();
    const ansid = qs.ansid.includes("*") ? qs.ansid.split("*") : qs.ansid;
    const users = await SendMsgAsync(payload("getAnsVoters", qs.ansid))
    console.log(users);
    const anss = await SendMsgAsync(payload("findAnsIdOfUserVote", users, "desc"));
    console.log(anss);
    const ansMap = await SendMsgAsync(payload("getPropMapOfIds", "answers", anss.mapToProp("key"), "question"));
    const qstMap = await SendMsgAsync(payload("getDetailMapOfIds", "questions", Object.values(ansMap), "id"));
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
            paging: false,
            data: data,
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

}()
