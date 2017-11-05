"use strict"

!async function ()
{
    const qs = window.getQueryString();
    const users = qs.users.split("*");
    console.log(users);
    const anss = await SendMsgAsync({ "action": "analyse", "method": "findAnsIdOfUserVote", "argument": [users, "desc"] });
    console.log(anss);
    const qstMap = await SendMsgAsync({ "action": "analyse", "method": "findQuestMapOfAnswers", "argument": [anss, "question"] });
    const data = [];
    for (let idx = 0; idx < anss.length; ++idx)
    {
        const cur = anss[idx];
        const qst = qstMap[cur.key];
        const link = "https://www.zhihu.com/question/" + qst[0] + "/answer/" + cur.key;
        const dat = { "ansid": cur.key, "qst": { "title": qst[1], "link": link }, "times": cur.count };
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
